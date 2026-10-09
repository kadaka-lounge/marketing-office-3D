import { getOffice } from '@/lib/office/server/service';
import { errorResponse, jsonResponse, requireAccess } from '@/lib/office/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { requireAccess(request); return jsonResponse(getOffice()); }
  catch (error) { return errorResponse(error); }
}
