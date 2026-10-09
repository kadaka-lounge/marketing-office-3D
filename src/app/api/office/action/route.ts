import { performAction } from '@/lib/office/server/service';
import { checkOrigin, errorResponse, jsonResponse, readBody, requireAccess } from '@/lib/office/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;
export async function POST(request: Request) {
  try { checkOrigin(request); requireAccess(request); return jsonResponse(await performAction(await readBody(request))); }
  catch (error) { return errorResponse(error); }
}
