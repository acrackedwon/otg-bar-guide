import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE = 'otg_guide_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

function secret(): string {
  return process.env.SESSION_SECRET || process.env.SITE_PASSWORD || 'otg-dev-secret';
}

function sign(expiresAt: number): string {
  const mac = createHmac('sha256', secret()).update(String(expiresAt)).digest('hex');
  return `${expiresAt}.${mac}`;
}

function equals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passwordMatches(input: unknown): boolean {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return true; // 비밀번호 미설정 시 게이트 비활성 (로컬 개발용)
  return typeof input === 'string' && equals(input, expected);
}

export function issueSession(res: VercelResponse): void {
  const expiresAt = Date.now() + MAX_AGE * 1000;
  const value = sign(expiresAt);
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`,
  );
}

export function clearSession(res: VercelResponse): void {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export function hasValidSession(req: VercelRequest): boolean {
  if (!process.env.SITE_PASSWORD) return true;
  const raw = req.headers.cookie || '';
  const hit = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  if (!hit) return false;
  const value = hit.slice(COOKIE.length + 1);
  const [expiresRaw] = value.split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return equals(value, sign(expiresAt));
}
