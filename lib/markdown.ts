import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Block,
  type ContentPayload,
  type Entry,
  DEFAULT_LANG,
  type Lang,
  parseVideoUrl,
} from './content.js';

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
function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const SEPARATOR = /^\|?[\s:|-]+\|[\s:|-]*$/;

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let note: string[] = [];
  let table: string[][] = [];

  const flushNote = () => {
    if (note.length) {
      blocks.push({ type: 'note', text: note.join(' ') });
      note = [];
    }
  };

  const flushTable = () => {
    if (table.length) {
      const [head, ...rows] = table;
      blocks.push({ type: 'table', head, rows });
      table = [];
    }
  };

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    flushNote();
    flushTable();
  };

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flush();
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      if (paragraph.length || note.length) flush();
      if (!SEPARATOR.test(line)) table.push(splitRow(line));
      continue;
    }
    flushTable();

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      if (paragraph.length) flush();
      note.push(quote[1].trim());
      continue;
    }
    flushNote();

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue; // 구분선은 버린다

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

function contentRoot(): string | null {
  const candidates = [
    join(process.cwd(), 'content'),
    join(process.cwd(), '..', 'content'),
    new URL('../content', import.meta.url).pathname,
  ];
  return candidates.find((dir) => existsSync(dir)) ?? null;
}

/** 프런트매터 키는 한국어와 영어를 모두 받는다. */
const KEYS = {
  title: ['제목', 'title'],
  category: ['분류', 'category'],
  summary: ['요약', 'summary'],
  order: ['순서', 'order'],
  video: ['영상', 'video'],
  published: ['공개', 'published'],
} as const;

function pick(meta: FrontMatter, names: readonly string[]): string | undefined {
  for (const name of names) {
    if (meta[name] !== undefined) return meta[name];
  }
  return undefined;
}

function readDir(dir: string): Map<string, Entry> {
  const found = new Map<string, Entry>();
  if (!existsSync(dir)) return found;

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
    const { meta, body } = splitFrontMatter(readFileSync(join(dir, file), 'utf8'));

    if ((pick(meta, KEYS.published) ?? 'true').toLowerCase() === 'false') continue;

    const title = pick(meta, KEYS.title) ?? '';
    if (!title) continue;

    const order = Number(pick(meta, KEYS.order));
    const id = file.replace(/\.md$/, '');

    found.set(id, {
      id,
      title,
      category: pick(meta, KEYS.category) || '기타',
      summary: pick(meta, KEYS.summary) ?? '',
      order: Number.isFinite(order) ? order : 999,
      cover: meta['대표사진'] || meta['cover'] || null,
      video: parseVideoUrl(pick(meta, KEYS.video)),
      blocks: parseBody(body),
    });
  }
  return found;
}

/**
 * 요청한 언어의 글을 읽는다. 아직 번역되지 않은 항목은 기본 언어(한국어)로
 * 대신 보여준다 — 빈 화면보다는 낫기 때문이다.
 */
export function loadContent(lang: Lang = DEFAULT_LANG): ContentPayload {
  const root = contentRoot();
  const fallback = root ? readDir(join(root, DEFAULT_LANG)) : new Map<string, Entry>();
  const wanted = root && lang !== DEFAULT_LANG ? readDir(join(root, lang)) : fallback;

  const entries: Entry[] = [];
  for (const [id, base] of fallback) entries.push(wanted.get(id) ?? base);
  for (const [id, entry] of wanted) if (!fallback.has(id)) entries.push(entry);

  entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, lang));
  return { source: 'files', lang, updatedAt: new Date().toISOString(), entries };
}
