/** 영상은 항상 {제공자, 영상ID}로만 저장한다.
 *  나중에 유튜브 → Cloudflare Stream 등으로 갈아탈 때 이 타입만 유지하면 된다. */
export type VideoProvider = 'youtube' | 'cloudflare' | 'vimeo';

export interface VideoRef {
  provider: VideoProvider;
  id: string;
}

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'number'; text: string }
  | { type: 'image'; url: string; caption: string };

export interface Entry {
  id: string;
  title: string;
  category: string;
  summary: string;
  order: number;
  cover: string | null;
  video: VideoRef | null;
  blocks: Block[];
}

export interface ContentPayload {
  source: 'notion' | 'sample';
  updatedAt: string;
  entries: Entry[];
}

/** 유튜브 링크를 {provider, id}로 정규화. 인식 못하면 null. */
export function parseVideoUrl(url: string | null | undefined): VideoRef | null {
  if (!url) return null;
  const trimmed = url.trim();
  const yt = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (yt) return { provider: 'youtube', id: yt[1] };
  const cf = trimmed.match(/cloudflarestream\.com\/([A-Za-z0-9]+)/);
  if (cf) return { provider: 'cloudflare', id: cf[1] };
  const vm = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { provider: 'vimeo', id: vm[1] };
  return null;
}

/** 노션 미설정 상태에서도 사이트가 동작하도록 하는 예시 콘텐츠. */
export const SAMPLE: Entry[] = [
  {
    id: 'sample-negroni',
    title: '네그로니',
    category: '칵테일',
    summary: '진 30 / 캄파리 30 / 스위트 베르무트 30, 스터, 오렌지 필.',
    order: 1,
    cover: null,
    video: null,
    blocks: [
      { type: 'heading', text: '레시피' },
      { type: 'bullet', text: '진 30ml' },
      { type: 'bullet', text: '캄파리 30ml' },
      { type: 'bullet', text: '스위트 베르무트 30ml' },
      { type: 'heading', text: '만드는 법' },
      { type: 'number', text: '믹싱 글라스에 얼음을 채운다.' },
      { type: 'number', text: '재료를 넣고 20초간 스터한다.' },
      { type: 'number', text: '큰 얼음을 넣은 락 글라스에 따르고 오렌지 필을 짠다.' },
    ],
  },
  {
    id: 'sample-open',
    title: '오픈 준비',
    category: '운영',
    summary: '영업 시작 60분 전부터의 표준 절차.',
    order: 1,
    cover: null,
    video: null,
    blocks: [
      { type: 'number', text: '제빙기 확인, 얼음 분리 및 정리.' },
      { type: 'number', text: '바 스테이션 세팅 — 지거, 스트레이너, 스푼, 리넨.' },
      { type: 'number', text: '가니시 준비 (레몬·오렌지 필, 올리브).' },
      { type: 'number', text: '백바 병 라벨 정면 정렬, 재고 부족분 기록.' },
      { type: 'number', text: '음악·조명 세팅, 화장실 점검.' },
    ],
  },
];
