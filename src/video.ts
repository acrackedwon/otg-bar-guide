import type { VideoRef } from '../lib/content.js';

/** {제공자, 영상ID} → 임베드 URL. 제공자를 바꿔도 이 함수만 고치면 된다. */
export function embedUrl(video: VideoRef): string | null {
  switch (video.provider) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&playsinline=1`;
    case 'cloudflare':
      return `https://iframe.videodelivery.net/${video.id}`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${video.id}`;
    default:
      return null;
  }
}
