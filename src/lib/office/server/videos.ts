import {setTimeout as delay} from 'node:timers/promises';
import {createFile,MP4BoxBuffer} from 'mp4box';
import {requestComfyMedia,checkComfyConnection} from './comfyui';
import {videoConnection} from './backend';
import {OfficeError} from './validation';
const ROUTER='https://router.huggingface.co/fal-ai';
const MAX_VIDEO_BYTES=64*1024*1024;
export async function boundedVideoBody(response:Response,limit=MAX_VIDEO_BYTES){
 if(Number(response.headers.get('content-length'))>limit)throw new OfficeError('Respons video terlalu besar.',502);
 const reader=response.body?.getReader();if(!reader)throw new OfficeError('Respons video kosong.',502);
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new OfficeError('Respons video terlalu besar.',502);}chunks.push(value);}
 return Buffer.concat(chunks);
}
export function validateMP4(bytes:Buffer){
 try{
  // Reject truncated containers before parsing metadata. Require media data, not just a signature.
  const boxes=new Set<string>();let position=0;let count=0;
  while(position<bytes.length){if(++count>10000||position+8>bytes.length)throw new Error('box');let size=bytes.readUInt32BE(position);const type=bytes.toString('ascii',position+4,position+8);let header=8;
   if(size===1){if(position+16>bytes.length)throw new Error('size');const large=bytes.readBigUInt64BE(position+8);if(large>BigInt(bytes.length))throw new Error('size');size=Number(large);header=16;}
   if(size===0)size=bytes.length-position;if(size<header||position+size>bytes.length)throw new Error('truncated');if(type==='mdat'&&size===header)throw new Error('empty');boxes.add(type);position+=size;
  }
  if(!['ftyp','moov','mdat'].every(box=>boxes.has(box)))throw new Error('container');
  const file=createFile();let failed=false;file.onError=()=>{failed=true;};
  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(Uint8Array.from(bytes).buffer,0));file.flush();
  const info=file.getInfo();const track=info.videoTracks[0];const duration=track?.duration/track?.timescale;
  if(failed||!track||!Number.isFinite(duration)||duration<=0||duration>120||!track.video||track.video.width<=0||track.video.height<=0||track.video.width>4096||track.video.height>4096||!track.nb_samples)throw new Error('track');
  return {width:track.video.width,height:track.video.height,durationSeconds:duration};
 }catch{throw new OfficeError('Provider tidak mengembalikan MP4 dengan track video yang valid (maksimal 120 detik). Aset sebelumnya tetap tersedia.',502);}
}
async function api(url:string,init:RequestInit,signal:AbortSignal){
 let response:Response;try{response=await fetch(url,{...init,signal,redirect:'error'});}catch{throw new OfficeError('Koneksi video berakhir atau melewati batas waktu. Job provider mungkin masih berjalan; periksa sebelum membuat ulang.',502);}
 if(!response.ok)throw new OfficeError(`Provider video gagal (HTTP ${response.status}). Periksa token, izin Inference Providers, akses model, saldo, dan ketersediaan provider.`,502);return response;
}
async function json(response:Response){try{return JSON.parse((await boundedVideoBody(response,1024*1024)).toString('utf8'));}catch(error){if(error instanceof OfficeError)throw error;throw new OfficeError('Respons provider video tidak valid.',502);}}
function queuePath(value:unknown){
 if(typeof value!=='string')throw new OfficeError('Provider tidak memberikan referensi job video.',502);
 let url:URL;try{url=new URL(value);}catch{throw new OfficeError('Referensi job video tidak valid.',502);}
 if(url.protocol!=='https:'||url.username||url.password||!['queue.fal.run','fal.run'].includes(url.hostname)||!/^\/[a-zA-Z0-9/_-]+\/requests\/[a-zA-Z0-9_-]+$/.test(url.pathname)||url.pathname.split('/').some(p=>p==='..'))throw new OfficeError('Referensi job video tidak diizinkan.',502);
 // Never follow the returned host with an HF token. Route polling through HF only.
 return url.pathname;
}
function assetURL(value:unknown){
 if(typeof value!=='string'||value.length>4000)throw new OfficeError('Provider tidak memberikan URL video.',502);
 let url:URL;try{url=new URL(value);}catch{throw new OfficeError('URL video tidak valid.',502);}
 if(url.protocol!=='https:'||url.username||url.password||!['fal.media','huggingface.co','hf.co'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw new OfficeError('Host aset video tidak didukung.',502);return url.href;
}
export function stripVideoMetadata(input:Buffer){
 const bytes=Buffer.from(input);let count=0;const containers=new Set(['moov','trak','mdia','minf','stbl','edts','mvex','moof','traf']);
 function walk(start:number,end:number,depth=0){if(depth>32)throw new OfficeError('Struktur MP4 terlalu dalam.',502);let position=start;while(position<end){if(++count>100000||position+8>end)throw new OfficeError('Struktur MP4 tidak valid.',502);let size=bytes.readUInt32BE(position);let header=8;const type=bytes.toString('ascii',position+4,position+8);if(size===1){if(position+16>end)throw new OfficeError('Struktur MP4 tidak valid.',502);const large=bytes.readBigUInt64BE(position+8);if(large>BigInt(end-position))throw new OfficeError('Struktur MP4 tidak valid.',502);size=Number(large);header=16;}if(!size)size=end-position;if(size<header||position+size>end)throw new OfficeError('Struktur MP4 tidak valid.',502);
  // Keep box sizes/offsets stable so media samples remain unchanged.
  if(['udta','meta','uuid'].includes(type)){bytes.write('free',position+4,'ascii');bytes.fill(0,position+header,position+size);}else if(containers.has(type))walk(position+header,position+size,depth+1);position+=size;}}
 walk(0,bytes.length);return bytes;
}
export async function requestVideo(prompt:string){
 const c=videoConnection();if(c.provider==='comfyui'){const bytes=stripVideoMetadata(await requestComfyMedia(c,prompt,'video'));validateMP4(bytes);return bytes;}if(!c.key)throw new OfficeError('Video Hugging Face belum dikonfigurasi. Buka Backend & API → Model Video.',409);
 if(!c.key.startsWith('hf_'))throw new OfficeError('Gunakan token Hugging Face yang diawali hf_.',409);
 if(!['Wan-AI/Wan2.2-T2V-A14B','Wan-AI/Wan2.1-T2V-14B'].includes(c.model))throw new OfficeError('Pilih preset model Wan yang didukung.',409);
 const signal=AbortSignal.timeout(8*60*1000);const headers={Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'};
 const modelInfo=await json(await api(`https://huggingface.co/api/models/${c.model}?expand[]=inferenceProviderMapping`,{headers},signal));
 const mappings=modelInfo.inferenceProviderMapping;const mapping=Array.isArray(mappings)?mappings.find(m=>m.provider==='fal-ai'):mappings?.['fal-ai'];
 if(!mapping||mapping.status!=='live'||mapping.task!=='text-to-video'||typeof mapping.providerId!=='string'||!/^[-a-zA-Z0-9_/\.]+$/.test(mapping.providerId)||mapping.providerId.split('/').some((p:string)=>!p||p==='.'||p==='..'))throw new OfficeError('Model ini belum dilayani oleh fal-ai untuk text-to-video melalui Hugging Face. Pilih preset Wan lain atau periksa ketersediaan Inference Providers.',409);
 const submission=await json(await api(`${ROUTER}/${mapping.providerId}?_subdomain=queue`,{method:'POST',headers,body:JSON.stringify({prompt:prompt.slice(0,8000),aspect_ratio:c.aspectRatio,resolution:'720p'})},signal));
 if(typeof submission.request_id!=='string')throw new OfficeError('Provider tidak memberikan ID job video.',502);
 const path=queuePath(submission.response_url);if(!path.endsWith(`/requests/${submission.request_id}`))throw new OfficeError('Referensi job video tidak sesuai ID.',502);let status=submission.status;
 while(status!=='COMPLETED'){
  if(!['IN_QUEUE','IN_PROGRESS'].includes(status))throw new OfficeError('Job video gagal atau status tidak dikenali. Aset sebelumnya tetap tersedia.',502);
  try{await delay(2000,undefined,{signal});}catch{throw new OfficeError('Waktu tunggu video berakhir. Job mungkin masih berjalan di provider; periksa sebelum membuat ulang.',502);}
  const poll=await json(await api(`${ROUTER}${path}/status?_subdomain=queue`,{headers},signal));status=poll.status;
 }
 const result=await json(await api(`${ROUTER}${path}?_subdomain=queue`,{headers},signal));
 const bytes=await boundedVideoBody(await api(assetURL(result.video?.url),{method:'GET'},signal));
 validateMP4(bytes);return bytes;
}
export async function testVideoProvider(){
 const c=videoConnection();if(c.provider==='comfyui')return {...await checkComfyConnection(c),provider:c.provider,model:c.model};if(!c.key)throw new OfficeError('Token video Hugging Face belum dikonfigurasi.',409);
 if(!c.key.startsWith('hf_'))throw new OfficeError('Gunakan token Hugging Face yang diawali hf_.',409);
 const signal=AbortSignal.timeout(15000);
 await json(await api('https://huggingface.co/api/whoami-v2',{headers:{Authorization:`Bearer ${c.key}`}},signal));
 const result=await json(await api(`https://huggingface.co/api/models/${c.model}?expand[]=inferenceProviderMapping`,{headers:{Authorization:`Bearer ${c.key}`}},signal));
 const mappings=result.inferenceProviderMapping;const available=Array.isArray(mappings)?mappings.some(m=>m.provider==='fal-ai'&&m.status==='live'&&m.task==='text-to-video'):mappings?.['fal-ai']?.status==='live'&&mappings?.['fal-ai']?.task==='text-to-video';
 if(!available)throw new OfficeError('Model belum tersedia untuk text-to-video melalui fal-ai di Hugging Face.',409);
 return {ok:true,model:c.model,checkedAt:new Date().toISOString(),message:'Pemetaan model tersedia. Izin inferensi dan saldo diverifikasi saat membuat video.'};
}
