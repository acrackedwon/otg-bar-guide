import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasValidSession } from '../lib/auth.js';
import { isLang, DEFAULT_LANG } from '../lib/content.js';
import { loadContent } from '../lib/markdown.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!hasValidSession(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  try {
    const requested = req.query.lang;
    const lang = isLang(requested) ? requested : DEFAULT_LANG;
    const payload = loadContent(lang);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
}
