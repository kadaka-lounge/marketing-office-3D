import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { OfficeError } from './validation';

const cookieName = 'kadaka_office_session';
const digest = (value: string) => createHash('sha256').update(`kadaka-office-session:${value}`).digest('hex');
function equal(left: string, right: string) { return timingSafeEqual(Buffer.from(digest(left)), Buffer.from(digest(right))); }
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new OfficeError('Permintaan lintas situs tidak diizinkan.', 403);
  if (origin) {
    try {
      const source = new URL(origin);
      const expectedHost = request.headers.get('host') || new URL(request.url).host;
      if (!['http:', 'https:'].includes(source.protocol) || source.host !== expectedHost) throw new Error('different origin');
    }
    catch { throw new OfficeError('Origin permintaan tidak sesuai.', 403); }
  }
}
export function requireAccess(request: Request) {
  const token = process.env.OFFICE_ACCESS_TOKEN;
  if (!token) return;
  const value = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
  if (!value || !equal(value, digest(token))) throw new OfficeError('Masuk dengan access token kantor terlebih dahulu.', 401);
}
export async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new OfficeError('Gunakan Content-Type application/json.', 415);
  if (Number(request.headers.get('content-length')) > 128 * 1024) throw new OfficeError('Permintaan terlalu besar.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OfficeError('Body JSON diperlukan.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 128 * 1024) { await reader.cancel(); throw new OfficeError('Permintaan terlalu besar.', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new OfficeError('Body JSON tidak valid.'); }
}
export function errorResponse(error: unknown) {
  if (error instanceof OfficeError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('[office] Internal error:', error instanceof Error ? error.name : 'Unknown');
  return NextResponse.json({ error: 'Terjadi kesalahan internal saat memproses kantor.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}
export function jsonResponse(value: unknown) { return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } }); }
export async function createSession(request: Request) {
  checkOrigin(request);
  const input = await readBody(request);
  if (!input || typeof input !== 'object' || typeof input.token !== 'string' || input.token.length > 4096 || Object.keys(input).some(k => k !== 'token')) throw new OfficeError('Access token tidak valid.');
  const token = process.env.OFFICE_ACCESS_TOKEN;
  if (!token) return jsonResponse({ ok: true });
  if (!equal(input.token, token)) throw new OfficeError('Access token tidak cocok.', 401);
  const response = jsonResponse({ ok: true });
  response.cookies.set(cookieName, digest(token), { httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:', path: '/', maxAge: 60 * 60 * 12 });
  return response;
}
