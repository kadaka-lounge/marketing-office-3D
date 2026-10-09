import {checkOrigin,requireAccess,jsonResponse,errorResponse} from '@/lib/office/server/http';
import {tiktokCreator} from '@/lib/office/server/tiktok';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{checkOrigin(request);requireAccess(request);return jsonResponse({ok:true,creator:await tiktokCreator()});}catch(error){return errorResponse(error);}}
