import {checkOrigin,requireAccess,jsonResponse,errorResponse} from '@/lib/office/server/http';
import {testVideoProvider} from '@/lib/office/server/videos';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{checkOrigin(request);requireAccess(request);return jsonResponse(await testVideoProvider());}catch(error){return errorResponse(error);}}
