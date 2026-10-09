import { exportCampaign } from '@/lib/office/server/service';
import { errorResponse, requireAccess } from '@/lib/office/server/http';
import { OfficeError } from '@/lib/office/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    requireAccess(request);
    const campaignId = new URL(request.url).searchParams.get('campaignId');
    if (!campaignId || !/^[a-zA-Z0-9_-]{1,100}$/.test(campaignId)) throw new OfficeError('campaignId yang valid diperlukan.');
    return new Response(JSON.stringify(exportCampaign(campaignId), null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${campaignId}-publication-pack.json"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
