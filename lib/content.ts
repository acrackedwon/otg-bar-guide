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
  source: 'files';
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
