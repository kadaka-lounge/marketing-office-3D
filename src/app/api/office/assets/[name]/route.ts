import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, readState } from '@/lib/office/server/store';
import { errorResponse, requireAccess } from '@/lib/office/server/http';
import { OfficeError } from '@/lib/office/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    requireAccess(request); const { name } = await context.params;
    if (!/^image-[0-9a-f-]{36}\.png$/.test(name) || !readState().artifacts.some(a => a.imageUrl === `/api/office/assets/${name}`)) throw new OfficeError('Aset tidak ditemukan.', 404);
    let bytes: Buffer;
    try { bytes = await readFile(path.join(dataDirectory(), 'assets', name)); }
    catch { throw new OfficeError('Aset tidak ditemukan.', 404); }
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}
