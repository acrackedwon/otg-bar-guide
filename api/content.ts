import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasValidSession } from '../lib/auth.js';
import { loadContent } from '../lib/notion.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!hasValidSession(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  try {
    const payload = await loadContent();
    // 노션 이미지 URL은 만료되므로 길게 캐시하지 않는다.
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
}
