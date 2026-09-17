import {
  type Block,
  type ContentPayload,
  type Entry,
  DEFAULT_LANG,
  isLang,
  type Lang,
  LANGUAGES,
} from '../lib/content.js';
import { embedUrl } from './video.js';

const app = document.querySelector<HTMLDivElement>('#app')!;

/** 화면 문구. 새 언어를 추가하면 여기에도 한 벌 넣는다. */
const UI = {
  ko: {
    subtitle: '직원 가이드',
    password: '비밀번호',
    enter: '들어가기',
    wrongPassword: '비밀번호가 맞지 않습니다.',
    connectFailed: '접속에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    serverFailed: '서버에 연결하지 못했습니다.',
    loadFailed: '콘텐츠를 불러오지 못했습니다.',
    loading: '불러오는 중…',
    empty: '아직 내용이 없습니다.',
    logout: '나가기',
    hasVideo: '영상 있음',
  },
  en: {
    subtitle: 'Staff Guide',
    password: 'Password',
    enter: 'Enter',
    wrongPassword: 'Incorrect password.',
    connectFailed: 'Connection failed. Please try again in a moment.',
    serverFailed: 'Could not reach the server.',
    loadFailed: 'Could not load the guide.',
    loading: 'Loading…',
    empty: 'Nothing here yet.',
    logout: 'Sign out',
    hasVideo: 'Video',
  },
} as const satisfies Record<Lang, Record<string, string>>;

const LANG_KEY = 'otg-guide-lang';

function storedLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* 사파리 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다 */
  }
  return navigator.language?.startsWith('ko') ? 'ko' : DEFAULT_LANG;
}

let lang: Lang = storedLang();
let payload: ContentPayload | null = null;
let activeCategory = '';
let activeGroup: string | null = null;
let activeEntryId: string | null = null;

function t(): (typeof UI)[Lang] {
  return UI[lang];
}

function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    /* 저장에 실패해도 이번 세션 동안은 동작한다 */
  }
  document.documentElement.lang = next;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 본문 안의 **굵게** 표시만 해석한다. esc() 뒤에 적용해야 안전하다. */
function inline(value: string): string {
  return esc(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/* ---------------- 로그인 ---------------- */

function renderGate(message = ''): void {
  app.innerHTML = `
    <div class="gate">
      <div class="gate__mark">ON THE GROUND</div>
      <p class="gate__sub">${esc(t().subtitle)}</p>
      <form id="gate-form">
        <input type="password" id="gate-input" placeholder="${esc(t().password)}" autocomplete="current-password" />
        <p class="error">${esc(message)}</p>
        <button type="submit">${esc(t().enter)}</button>
      </form>
      ${langSwitch()}
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
        renderGate(t().wrongPassword);
        return;
      }
      await boot();
    } catch {
      renderGate(t().connectFailed);
    } finally {
      button.disabled = false;
    }
  });

  bindLangSwitch(() => renderGate());
  input.focus();
}

/* ---------------- 언어 전환 ---------------- */

function langSwitch(): string {
  const buttons = LANGUAGES.map(
    (entry) =>
      `<button class="lang__btn" data-lang="${entry.code}" aria-pressed="${
        entry.code === lang
      }" title="${esc(entry.label)}">${esc(entry.short)}</button>`,
  ).join('');
  return `<div class="lang">${buttons}</div>`;
}

function bindLangSwitch(after: () => void): void {
  app.querySelectorAll<HTMLButtonElement>('.lang__btn').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.lang;
      if (!isLang(next) || next === lang) return;
      setLang(next);
      after();
    });
  });
}

/* ---------------- 목록 ---------------- */

function categories(entries: Entry[]): string[] {
  const seen: string[] = [];
  for (const entry of entries) if (!seen.includes(entry.category)) seen.push(entry.category);
  return seen;
}

/** 현재 분류 안의 하위 구분. 하나 이하면 하위 탭을 그리지 않는다. */
function groups(): string[] {
  const seen: string[] = [];
  for (const entry of payload?.entries ?? []) {
    if (entry.category !== activeCategory) continue;
    const name = entry.group;
    if (name && !seen.includes(name)) seen.push(name);
  }
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
        <div class="top__actions">
          ${langSwitch()}
          <button class="top__logout" id="logout">${esc(t().logout)}</button>
        </div>
      </div>
      ${activeEntryId ? '' : `<div class="tabs" role="tablist">${tabs}</div>`}
    </header>
    <main class="wrap">${inner}</main>`;
}

function renderList(): void {
  const sub = groups();
  if (sub.length > 1 && (activeGroup === null || !sub.includes(activeGroup))) {
    activeGroup = sub[0];
  }
  if (sub.length <= 1) activeGroup = null;

  const entries = (payload?.entries ?? []).filter(
    (e) => e.category === activeCategory && (activeGroup === null || e.group === activeGroup),
  );

  const subtabs =
    sub.length > 1
      ? `<div class="subtabs" role="tablist">${sub
          .map(
            (name) =>
              `<button class="subtab" role="tab" data-group="${esc(name)}" aria-selected="${
                name === activeGroup
              }">${esc(name)}</button>`,
          )
          .join('')}</div>`
      : '';
  const cards = entries
    .map(
      (entry) => `
        <button class="card" data-entry="${esc(entry.id)}">
          <h2>${esc(entry.title)}</h2>
          ${entry.summary ? `<p>${esc(entry.summary)}</p>` : ''}
          ${entry.video ? `<p class="card__badge">${esc(t().hasVideo)}</p>` : ''}
        </button>`,
    )
    .join('');

  app.innerHTML = chrome(
    `${subtabs}<div class="list">${cards || `<p class="empty">${esc(t().empty)}</p>`}</div>`,
  );
  bindChrome();

  app.querySelectorAll<HTMLButtonElement>('.subtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeGroup = tab.dataset.group!;
      renderList();
    });
  });

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
      out.push(`<li>${inline(block.text)}</li>`);
      continue;
    }
    closeList();
    if (block.type === 'heading') out.push(`<h3>${esc(block.text)}</h3>`);
    else if (block.type === 'paragraph') out.push(`<p>${inline(block.text)}</p>`);
    else if (block.type === 'note') out.push(`<p class="note">${inline(block.text)}</p>`);
    else if (block.type === 'table') {
      const head = block.head.map((cell) => `<th>${inline(cell)}</th>`).join('');
      const rows = block.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
        .join('');
      out.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`);
    }
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
      <button class="back" id="back">← ${esc(entry.group ?? entry.category)}</button>
      <h1>${esc(entry.title)}</h1>
      ${entry.summary ? `<p class="summary">${esc(entry.summary)}</p>` : ''}
      ${video}${cover}
      ${renderBlocks(entry.blocks)}
    </div>`);
  bindChrome();

  document.querySelector<HTMLButtonElement>('#back')!.addEventListener('click', () => {
    if (entry.group) activeGroup = entry.group;
    activeEntryId = null;
    window.scrollTo(0, 0);
    renderList();
  });
}

/* ---------------- 공통 ---------------- */

function bindChrome(): void {
  bindLangSwitch(() => void boot());

  document.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    payload = null;
    activeEntryId = null;
    renderGate();
  });

  app.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.category!;
      activeGroup = null;
      renderList();
    });
  });
}

async function boot(): Promise<void> {
  app.innerHTML = `<p class="empty">${esc(t().loading)}</p>`;
  let res: Response;
  try {
    res = await fetch(`/api/content?lang=${lang}`);
  } catch {
    renderGate(t().serverFailed);
    return;
  }
  if (res.status === 401) {
    renderGate();
    return;
  }
  if (!res.ok) {
    app.innerHTML = `<p class="empty">${esc(t().loadFailed)}</p>`;
    return;
  }
  payload = (await res.json()) as ContentPayload;
  const cats = categories(payload.entries);
  if (!cats.includes(activeCategory)) activeCategory = cats[0] ?? '';
  activeEntryId = null;
  renderList();
}

setLang(lang);
void boot();
