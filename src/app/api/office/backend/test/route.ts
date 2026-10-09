import {checkOrigin,requireAccess,jsonResponse,errorResponse} from '@/lib/office/server/http';
import {testBackendConnection} from '@/lib/office/server/providers';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{checkOrigin(request);requireAccess(request);return jsonResponse(await testBackendConnection());}catch(error){return errorResponse(error);}}
