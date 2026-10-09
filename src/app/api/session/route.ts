import { createSession, errorResponse } from '@/lib/office/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try { return await createSession(request); }
  catch (error) { return errorResponse(error); }
}
