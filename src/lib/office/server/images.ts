import sharp from 'sharp';
import {InferenceClient} from '@huggingface/inference';
import {imageConnection} from './backend';
import {OfficeError} from './validation';
import type {ImageAspectRatio} from '../types';
const MAX_BYTES=32*1024*1024;
const DIMENSIONS:Record<ImageAspectRatio,[number,number]>={'1:1':[1024,1024],'4:5':[768,960],'9:16':[576,1024],'16:9':[1024,576]};
export const IMAGE_LABELS={openai:'GPT Image',imagen:'Google Imagen',huggingface:'Hugging Face FLUX.1'};
async function boundedBytes(response:Response,limit=MAX_BYTES){
 if(Number(response.headers.get('content-length'))>limit)throw new OfficeError('Respons gambar terlalu besar.',502);
 const reader=response.body?.getReader();if(!reader)throw new OfficeError('Respons gambar kosong.',502);
 const chunks:Uint8Array[]=[];let length=0;
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new OfficeError('Respons gambar terlalu besar.',502);}chunks.push(value);}
 return Buffer.concat(chunks);
}
function decodeBase64(value:unknown){
 if(typeof value!=='string'||!value||value.length>Math.ceil(MAX_BYTES*4/3)+4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new OfficeError('Provider tidak mengembalikan data gambar yang valid.',502);
 const bytes=Buffer.from(value,'base64');if(bytes.length>MAX_BYTES)throw new OfficeError('Respons gambar terlalu besar.',502);return bytes;
}
async function fetchAPI(url:string,init:RequestInit,signal:AbortSignal){
 try{
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new OfficeError('Endpoint gambar harus menggunakan HTTPS tanpa kredensial URL.',409);
  const response=await fetch(url,{...init,redirect:'error',signal});
  if(!response.ok){const hint=response.status===404?'Model atau endpoint tidak tersedia. Periksa ID dan akses model pada provider yang dipilih.':'Periksa kunci, izin model, billing, dan kuota provider.';throw new OfficeError(`Provider gambar gagal (HTTP ${response.status}). ${hint}`,502);}
  return response;
 }catch(error){if(error instanceof OfficeError)throw error;throw new OfficeError('Provider gambar tidak dapat dihubungi atau melewati batas waktu.',502);}
}
async function readJSON(response:Response){try{return JSON.parse((await boundedBytes(response,48*1024*1024)).toString('utf8'));}catch(error){if(error instanceof OfficeError)throw error;throw new OfficeError('Provider gambar tidak mengembalikan JSON yang valid.',502);}}
async function normalizedPNG(bytes:Buffer,ratio:ImageAspectRatio){
 try{
  const image=sharp(bytes,{limitInputPixels:16*1024*1024,animated:false});const metadata=await image.metadata();
  if(!metadata.format||!['png','jpeg','webp'].includes(metadata.format)||!metadata.width||!metadata.height)throw new Error('invalid');
  const [width,height]=DIMENSIONS[ratio];return await image.rotate().resize(width,height,{fit:'cover'}).png().toBuffer();
 }catch{throw new OfficeError('Provider tidak mengembalikan gambar PNG/JPEG/WebP yang valid. Aset sebelumnya tetap tersedia.',502);}
}
const ASSET_HOSTS=['fal.media','replicate.delivery','huggingface.co','hf.co'];
async function hfImageBytes(payload:Record<string,unknown>,signal:AbortSignal){
 const data=payload.data as {b64_json?:unknown;url?:unknown}[]|undefined;
 if(data?.[0]?.b64_json)return decodeBase64(data[0].b64_json);
 const output=payload.output;
 if(typeof output==='string'&&output.startsWith('data:')){const match=output.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new OfficeError('Format gambar Hugging Face tidak didukung.',502);return decodeBase64(match[1]);}
 const images=payload.images as {url?:unknown}[]|undefined;
 const url=data?.[0]?.url||images?.[0]?.url||(Array.isArray(output)?output[0]:output);
 if(typeof url!=='string'||url.length>4000)throw new OfficeError('Hugging Face tidak memberikan data atau URL gambar yang valid.',502);
 let parsed:URL;try{parsed=new URL(url);}catch{throw new OfficeError('URL aset Hugging Face tidak valid.',502);}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||!ASSET_HOSTS.some(host=>parsed.hostname===host||parsed.hostname.endsWith(`.${host}`)))throw new OfficeError('Host aset Hugging Face belum didukung. Gunakan provider yang mengembalikan gambar base64 atau CDN fal.media / replicate.delivery.',502);
 // Asset downloads carry no API token and cannot redirect to another host.
 return boundedBytes(await fetchAPI(url,{method:'GET'},signal));
}
export async function requestConfiguredImage(prompt:string):Promise<Buffer>{
 const c=imageConnection();const label=IMAGE_LABELS[c.provider];if(!c.key)throw new OfficeError(`${label} belum dikonfigurasi. Simpan kunci pada Backend & API → Model Gambar.`,409);
 const signal=AbortSignal.timeout(180000);const [width,height]=DIMENSIONS[c.aspectRatio];let bytes:Buffer;
 if(c.provider==='huggingface'){
  if(!c.key.startsWith('hf_'))throw new OfficeError('Gunakan token Hugging Face yang diawali hf_ dengan izin Inference Providers.',409);
  try{
   const client=new InferenceClient(c.key,{signal,retry_on_error:false,fetch:async(input,init)=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    const u=new URL(url);if(!['huggingface.co','router.huggingface.co'].includes(u.hostname))throw new OfficeError('Endpoint inference Hugging Face tidak diizinkan.',502);
    const response=await fetchAPI(url,init||{},signal);
    const contentType=response.headers.get('content-type')||'';
    const body=await boundedBytes(response,contentType.startsWith('application/json')?48*1024*1024:MAX_BYTES);
    // Normalize binary HF-Inference responses before the SDK's JSON output handling.
    if(contentType.startsWith('image/'))return Response.json({data:[{b64_json:body.toString('base64')}]});
    return new Response(body,{headers:response.headers,status:response.status});
   }});
   const result=await client.textToImage({model:c.model,provider:'auto',inputs:prompt.slice(0,12000),parameters:{width,height}},{outputType:'json'});
   bytes=await hfImageBytes(result,signal);
  }catch(error){if(error instanceof OfficeError)throw error;throw new OfficeError('Hugging Face gagal membuat gambar. Periksa izin Inference Providers, persetujuan akses FLUX.1, provider tersedia, dan saldo kredit.',502);}
 }else if(c.provider==='imagen'){
  const response=await fetchAPI(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:predict`,{method:'POST',headers:{'x-goog-api-key':c.key,'Content-Type':'application/json'},body:JSON.stringify({instances:[{prompt:prompt.slice(0,12000)}],parameters:{sampleCount:1,aspectRatio:c.aspectRatio==='4:5'?'3:4':c.aspectRatio,outputOptions:{mimeType:'image/png'}}})},signal);
  const body=await readJSON(response);bytes=decodeBase64(body?.predictions?.[0]?.bytesBase64Encoded);
 }else{
  const size=c.aspectRatio==='1:1'?'1024x1024':c.aspectRatio==='16:9'?'1536x1024':'1024x1536';
  const response=await fetchAPI('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:c.model,prompt:prompt.slice(0,12000),n:1,size,output_format:'png'})},signal);
  const body=await readJSON(response);bytes=decodeBase64(body?.data?.[0]?.b64_json);
 }
 return normalizedPNG(bytes,c.aspectRatio);
}
export async function testImageProvider(){
 const c=imageConnection();const buffer=await requestConfiguredImage('A simple blue circle on a plain white background, minimal geometric illustration, no text.');
 const metadata=await sharp(buffer).metadata();return {ok:true,provider:c.provider,model:c.model,width:metadata.width,height:metadata.height,checkedAt:new Date().toISOString()};
}
