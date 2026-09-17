import { Client } from '@notionhq/client';
import { type Block, type ContentPayload, type Entry, SAMPLE, parseVideoUrl } from './content.js';

/* 노션 데이터베이스 속성 이름 (노션에서 이 이름 그대로 만들어야 한다) */
const PROP = {
  title: '제목',
  category: '분류',
  summary: '요약',
  order: '순서',
  video: '영상',
  published: '공개',
} as const;

type AnyObj = Record<string, any>;

function plain(rich: AnyObj[] | undefined): string {
  if (!Array.isArray(rich)) return '';
  return rich.map((r) => r?.plain_text ?? '').join('').trim();
}

function fileUrl(file: AnyObj | null | undefined): string | null {
  if (!file) return null;
  if (file.type === 'external') return file.external?.url ?? null;
  if (file.type === 'file') return file.file?.url ?? null;
  return null;
}

function toBlocks(raw: AnyObj[]): Block[] {
  const out: Block[] = [];
  for (const b of raw) {
    switch (b.type) {
      case 'paragraph': {
        const text = plain(b.paragraph?.rich_text);
        if (text) out.push({ type: 'paragraph', text });
        break;
      }
      case 'heading_1':
      case 'heading_2':
      case 'heading_3': {
        const text = plain(b[b.type]?.rich_text);
        if (text) out.push({ type: 'heading', text });
        break;
      }
      case 'bulleted_list_item': {
        const text = plain(b.bulleted_list_item?.rich_text);
        if (text) out.push({ type: 'bullet', text });
        break;
      }
      case 'numbered_list_item': {
        const text = plain(b.numbered_list_item?.rich_text);
        if (text) out.push({ type: 'number', text });
        break;
      }
      case 'to_do': {
        const text = plain(b.to_do?.rich_text);
        if (text) out.push({ type: 'bullet', text });
        break;
      }
      case 'quote': {
        const text = plain(b.quote?.rich_text);
        if (text) out.push({ type: 'paragraph', text });
        break;
      }
      case 'image': {
        const url = fileUrl(b.image);
        if (url) out.push({ type: 'image', url, caption: plain(b.image?.caption) });
        break;
      }
      case 'video': {
        // 노션에 붙인 영상 링크도 {provider, id}로 정규화해 본문 대신 영상 슬롯으로 쓰지 않고 무시.
        break;
      }
      default:
        break;
    }
  }
  return out;
}

async function pageBlocks(notion: Client, pageId: string): Promise<Block[]> {
  const raw: AnyObj[] = [];
  let cursor: string | undefined;
  do {
    const res: AnyObj = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    raw.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return toBlocks(raw);
}

function readProp(props: AnyObj, name: string): AnyObj | undefined {
  return props?.[name];
}

export async function loadContent(): Promise<ContentPayload> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    return { source: 'sample', updatedAt: new Date().toISOString(), entries: SAMPLE };
  }

  const notion = new Client({ auth: token });
  const pages: AnyObj[] = [];
  let cursor: string | undefined;
  do {
    const res: AnyObj = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const entries: Entry[] = [];
  for (const page of pages) {
    const props = page.properties ?? {};
    const published = readProp(props, PROP.published);
    if (published?.type === 'checkbox' && published.checkbox === false) continue;

    const titleProp = readProp(props, PROP.title);
    const title = titleProp?.type === 'title' ? plain(titleProp.title) : '';
    if (!title) continue;

    const categoryProp = readProp(props, PROP.category);
    const category =
      categoryProp?.type === 'select'
        ? categoryProp.select?.name ?? '기타'
        : categoryProp?.type === 'multi_select'
          ? categoryProp.multi_select?.[0]?.name ?? '기타'
          : '기타';

    const summaryProp = readProp(props, PROP.summary);
    const summary = summaryProp?.type === 'rich_text' ? plain(summaryProp.rich_text) : '';

    const orderProp = readProp(props, PROP.order);
    const order = orderProp?.type === 'number' ? orderProp.number ?? 999 : 999;

    const videoProp = readProp(props, PROP.video);
    const videoUrl =
      videoProp?.type === 'url'
        ? videoProp.url
        : videoProp?.type === 'rich_text'
          ? plain(videoProp.rich_text)
          : null;

    entries.push({
      id: page.id,
      title,
      category,
      summary,
      order,
      cover: fileUrl(page.cover),
      video: parseVideoUrl(videoUrl),
      blocks: await pageBlocks(notion, page.id),
    });
  }

  entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ko'));
  return { source: 'notion', updatedAt: new Date().toISOString(), entries };
}
