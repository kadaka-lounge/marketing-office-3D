import {z} from 'zod';
import {checkOrigin,requireAccess,readBody,jsonResponse,errorResponse} from '@/lib/office/server/http';
import {testProviderConnection} from '@/lib/office/server/providers';
import {OfficeError} from '@/lib/office/server/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  checkOrigin(request);requireAccess(request);
  const input=z.object({provider:z.enum(['claude','gemini','openai','meta'])}).strict().safeParse(await readBody(request));
  if(!input.success)throw new OfficeError('Provider uji tidak valid.');
  return jsonResponse(await testProviderConnection(input.data.provider));
 }catch(error){return errorResponse(error);}
}
