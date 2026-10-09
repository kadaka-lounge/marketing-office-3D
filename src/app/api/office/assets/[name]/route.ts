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
    const video=/^video-[0-9a-f-]{36}\.mp4$/.test(name);
    if ((!video&&!/^image-[0-9a-f-]{36}\.png$/.test(name)) || !readState().artifacts.some(a => (video?a.videoUrl:a.imageUrl) === `/api/office/assets/${name}`)) throw new OfficeError('Aset tidak ditemukan.', 404);
    let bytes: Buffer;
    try { bytes = await readFile(path.join(dataDirectory(), 'assets', name)); }
    catch { throw new OfficeError('Aset tidak ditemukan.', 404); }
    const headers:Record<string,string>={'Content-Type':video?'video/mp4':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Length':String(bytes.length)};
    if(video){
      headers['Accept-Ranges']='bytes';const range=request.headers.get('range');
      if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0;let end=bytes.length-1;
        if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...headers,'Content-Length':'0','Content-Range':`bytes */${bytes.length}`}});
        if(!match[1])start=Math.max(0,bytes.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Length':'0','Content-Range':`bytes */${bytes.length}`}});
        headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;headers['Content-Length']=String(end-start+1);return new Response(new Uint8Array(bytes.subarray(start,end+1)),{status:206,headers});
      }
    }
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) { return errorResponse(error); }
}
