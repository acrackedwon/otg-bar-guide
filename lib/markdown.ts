import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Block, type ContentPayload, type Entry, parseVideoUrl } from './content.js';

/** content/*.md 를 읽어 사이트 데이터로 바꾼다. 외부 서비스 의존 없음. */

interface FrontMatter {
  [key: string]: string;
}

function splitFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const meta: FrontMatter = {};
  if (!text.startsWith('---\n')) return { meta, body: text };

  const end = text.indexOf('\n---', 4);
  if (end === -1) return { meta, body: text };

  for (const line of text.slice(4, end).split('\n')) {
    const at = line.indexOf(':');
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) meta[key] = value;
  }

  const rest = text.slice(end + 4);
  return { meta, body: rest.startsWith('\n') ? rest.slice(1) : rest };
}

/** 가이드에 필요한 만큼의 마크다운만 해석한다: 제목, 목록, 사진, 문단. */
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flush();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', text: heading[1].trim() });
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      flush();
      blocks.push({ type: 'image', url: image[2], caption: image[1].trim() });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flush();
      blocks.push({ type: 'bullet', text: bullet[1].trim() });
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flush();
      blocks.push({ type: 'number', text: numbered[1].trim() });
      continue;
    }

    paragraph.push(line);
  }

  flush();
  return blocks;
}

function contentDir(): string | null {
  const candidates = [
    join(process.cwd(), 'content'),
    join(process.cwd(), '..', 'content'),
    new URL('../content', import.meta.url).pathname,
  ];
  return candidates.find((dir) => existsSync(dir)) ?? null;
}

export function loadContent(): ContentPayload {
  const dir = contentDir();
  const entries: Entry[] = [];

  if (dir) {
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
      const { meta, body } = splitFrontMatter(readFileSync(join(dir, file), 'utf8'));

      if ((meta['공개'] ?? 'true').toLowerCase() === 'false') continue;

      const title = meta['제목'] ?? '';
      if (!title) continue;

      const order = Number(meta['순서']);

      entries.push({
        id: file.replace(/\.md$/, ''),
        title,
        category: meta['분류'] || '기타',
        summary: meta['요약'] ?? '',
        order: Number.isFinite(order) ? order : 999,
        cover: meta['대표사진'] || null,
        video: parseVideoUrl(meta['영상']),
        blocks: parseBody(body),
      });
    }
  }

  entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ko'));
  return { source: 'files', updatedAt: new Date().toISOString(), entries };
}
