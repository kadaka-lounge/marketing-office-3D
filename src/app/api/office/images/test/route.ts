import {checkOrigin,requireAccess,jsonResponse,errorResponse} from '@/lib/office/server/http';
import {testImageProvider} from '@/lib/office/server/images';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{checkOrigin(request);requireAccess(request);return jsonResponse(await testImageProvider());}catch(error){return errorResponse(error);}}
