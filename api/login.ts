import type { VercelRequest, VercelResponse } from '@vercel/node';
import { issueSession, passwordMatches } from '../lib/auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!passwordMatches(body?.password)) {
    res.status(401).json({ ok: false, error: '비밀번호가 맞지 않습니다.' });
    return;
  }
  issueSession(res);
  res.status(200).json({ ok: true });
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
