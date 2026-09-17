import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasValidSession } from '../lib/auth.js';
import { loadContent } from '../lib/markdown.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!hasValidSession(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  try {
    const payload = loadContent();
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
}
