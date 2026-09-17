import type { Block, ContentPayload, Entry } from '../lib/content.js';
import { embedUrl } from './video.js';

const app = document.querySelector<HTMLDivElement>('#app')!;

let payload: ContentPayload | null = null;
let activeCategory = '';
let activeEntryId: string | null = null;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------- 로그인 ---------------- */

function renderGate(message = ''): void {
  app.innerHTML = `
    <div class="gate">
      <div class="gate__mark">ON THE GROUND</div>
      <p class="gate__sub">직원 가이드</p>
      <form id="gate-form">
        <input type="password" id="gate-input" placeholder="비밀번호" autocomplete="current-password" />
        <p class="error">${esc(message)}</p>
        <button type="submit">들어가기</button>
      </form>
    </div>`;

  const form = document.querySelector<HTMLFormElement>('#gate-form')!;
  const input = document.querySelector<HTMLInputElement>('#gate-input')!;
  const button = form.querySelector('button')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input.value }),
      });
      if (!res.ok) {
        renderGate('비밀번호가 맞지 않습니다.');
        return;
      }
      await boot();
    } catch {
      renderGate('접속에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      button.disabled = false;
    }
  });

  input.focus();
}

/* ---------------- 목록 ---------------- */

function categories(entries: Entry[]): string[] {
  const seen: string[] = [];
  for (const entry of entries) if (!seen.includes(entry.category)) seen.push(entry.category);
  return seen;
}

function chrome(inner: string): string {
  const cats = categories(payload?.entries ?? []);
  const tabs = cats
    .map(
      (cat) =>
        `<button class="tab" role="tab" data-category="${esc(cat)}" aria-selected="${
          cat === activeCategory
        }">${esc(cat)}</button>`,
    )
    .join('');
  return `
    <header class="top">
      <div class="top__row">
        <span class="top__title">ON THE GROUND</span>
        <button class="top__logout" id="logout">나가기</button>
      </div>
      ${activeEntryId ? '' : `<div class="tabs" role="tablist">${tabs}</div>`}
    </header>
    <main class="wrap">${inner}</main>`;
}

function renderList(): void {
  const entries = (payload?.entries ?? []).filter((e) => e.category === activeCategory);
  const cards = entries
    .map(
      (entry) => `
        <button class="card" data-entry="${esc(entry.id)}">
          <h2>${esc(entry.title)}</h2>
          ${entry.summary ? `<p>${esc(entry.summary)}</p>` : ''}
          ${entry.video ? '<p class="card__badge">영상 있음</p>' : ''}
        </button>`,
    )
    .join('');

  app.innerHTML = chrome(
    `<div class="list">${cards || '<p class="empty">아직 내용이 없습니다.</p>'}</div>`,
  );
  bindChrome();

  app.querySelectorAll<HTMLButtonElement>('.card').forEach((card) => {
    card.addEventListener('click', () => {
      activeEntryId = card.dataset.entry!;
      window.scrollTo(0, 0);
      renderDetail();
    });
  });
}

/* ---------------- 상세 ---------------- */

function renderBlocks(blocks: Block[]): string {
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const block of blocks) {
    if (block.type === 'bullet' || block.type === 'number') {
      const want = block.type === 'bullet' ? 'ul' : 'ol';
      if (listType !== want) {
        closeList();
        out.push(`<${want}>`);
        listType = want;
      }
      out.push(`<li>${esc(block.text)}</li>`);
      continue;
    }
    closeList();
    if (block.type === 'heading') out.push(`<h3>${esc(block.text)}</h3>`);
    else if (block.type === 'paragraph') out.push(`<p>${esc(block.text)}</p>`);
    else if (block.type === 'image') {
      out.push(
        `<figure><img src="${esc(block.url)}" alt="${esc(block.caption)}" loading="lazy" />${
          block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''
        }</figure>`,
      );
    }
  }
  closeList();
  return out.join('');
}

function renderDetail(): void {
  const entry = (payload?.entries ?? []).find((e) => e.id === activeEntryId);
  if (!entry) {
    activeEntryId = null;
    renderList();
    return;
  }

  const src = entry.video ? embedUrl(entry.video) : null;
  const video = src
    ? `<div class="video"><iframe src="${esc(src)}" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(entry.title)}"></iframe></div>`
    : '';
  const cover = !src && entry.cover ? `<img src="${esc(entry.cover)}" alt="" />` : '';

  app.innerHTML = chrome(`
    <div class="detail">
      <button class="back" id="back">← ${esc(entry.category)}</button>
      <h1>${esc(entry.title)}</h1>
      ${entry.summary ? `<p class="summary">${esc(entry.summary)}</p>` : ''}
      ${video}${cover}
      ${renderBlocks(entry.blocks)}
    </div>`);
  bindChrome();

  document.querySelector<HTMLButtonElement>('#back')!.addEventListener('click', () => {
    activeEntryId = null;
    window.scrollTo(0, 0);
    renderList();
  });
}

/* ---------------- 공통 ---------------- */

function bindChrome(): void {
  document.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    payload = null;
    activeEntryId = null;
    renderGate();
  });

  app.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.category!;
      renderList();
    });
  });
}

async function boot(): Promise<void> {
  app.innerHTML = '<p class="empty">불러오는 중…</p>';
  let res: Response;
  try {
    res = await fetch('/api/content');
  } catch {
    renderGate('서버에 연결하지 못했습니다.');
    return;
  }
  if (res.status === 401) {
    renderGate();
    return;
  }
  if (!res.ok) {
    app.innerHTML = '<p class="empty">콘텐츠를 불러오지 못했습니다.</p>';
    return;
  }
  payload = (await res.json()) as ContentPayload;
  const cats = categories(payload.entries);
  if (!cats.includes(activeCategory)) activeCategory = cats[0] ?? '';
  activeEntryId = null;
  renderList();
}

void boot();
