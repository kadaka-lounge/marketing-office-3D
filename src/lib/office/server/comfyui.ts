import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {isLocalEndpoint} from '../endpoints';
import {parseComfyWorkflow,validateComfyBindings,type ComfyGraph} from '../comfy-workflow';
import {OfficeError} from './validation';
interface Connection {baseUrl?:string;key?:string;comfy:{workflow?:string;promptNodeId:string;promptInput:string;outputNodeId:string};}
async function bounded(response:Response,limit:number){if(Number(response.headers.get('content-length'))>limit)throw new OfficeError('Respons ComfyUI terlalu besar.',502);const reader=response.body?.getReader();if(!reader)throw new OfficeError('Respons ComfyUI kosong.',502);const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new OfficeError('Respons ComfyUI terlalu besar.',502);}chunks.push(value);}return Buffer.concat(chunks);}
async function api(c:Connection,path:string,signal:AbortSignal,body?:unknown){
 if(!c.baseUrl)throw new OfficeError('Endpoint ComfyUI belum dikonfigurasi.',409);
 let base:URL;try{base=new URL(c.baseUrl);}catch{throw new OfficeError('Endpoint ComfyUI tidak valid.',409);}
 if((base.protocol!=='https:'&&!isLocalEndpoint(base.href))||base.username||base.password||base.search||base.hash)throw new OfficeError('Endpoint ComfyUI harus HTTPS atau HTTP loopback tanpa kredensial URL.',409);
 if(!c.key&&!isLocalEndpoint(base.href))throw new OfficeError('Kunci endpoint ComfyUI HTTPS nonlokal diperlukan.',409);
 let r:Response;try{r=await fetch(`${c.baseUrl}${path}`,{method:body?'POST':'GET',headers:{...(c.key?{Authorization:`Bearer ${c.key}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal});}catch{throw new OfficeError('ComfyUI tidak dapat dihubungi atau waktu tunggu berakhir. Job mungkin masih berjalan; periksa ComfyUI sebelum mencoba ulang.',502);}
 if(!r.ok)throw new OfficeError(`ComfyUI gagal (HTTP ${r.status}). Periksa endpoint, kunci, workflow, dan model pada server.`,502);return r;
}
async function json(r:Response,limit=4*1024*1024){try{return JSON.parse((await bounded(r,limit)).toString('utf8'));}catch(error){if(error instanceof OfficeError)throw error;throw new OfficeError('Respons JSON ComfyUI tidak valid.',502);}}
function graphFor(c:Connection){if(!c.comfy.workflow)throw new OfficeError('Tambahkan workflow API pada pengaturan ComfyUI terlebih dahulu.',409);try{const graph=parseComfyWorkflow(c.comfy.workflow);validateComfyBindings(graph,c.comfy.promptNodeId,c.comfy.promptInput,c.comfy.outputNodeId);return graph;}catch(error){throw new OfficeError(error instanceof Error?error.message:'Workflow tidak valid.',409);}}
async function checkNodes(c:Connection,graph:ComfyGraph,signal:AbortSignal){
 const info=await json(await api(c,'/object_info',signal),16*1024*1024);
 for(const node of Object.values(graph)){
  const schema=info[node.class_type];if(!schema)throw new OfficeError(`Node ${node.class_type} belum terpasang di ComfyUI.`,409);
  const inputs={...schema.input?.required,...schema.input?.optional};
  for(const [name,value] of Object.entries(node.inputs)){const choices=inputs[name]?.[0];if(typeof value==='string'&&Array.isArray(choices)&&!choices.includes(value))throw new OfficeError(`Pilihan ${name} pada ${node.class_type} belum tersedia. Pilih file/model yang terpasang di ComfyUI.`,409);}
 }
 if(info[graph[c.comfy.outputNodeId].class_type]?.output_node!==true)throw new OfficeError('Node hasil harus berupa node output/penyimpan media ComfyUI.',409);
}
export async function checkComfyConnection(c:Connection){const signal=AbortSignal.timeout(30000);const graph=graphFor(c);await json(await api(c,'/system_stats',signal));await checkNodes(c,graph,signal);return {ok:true,checkedAt:new Date().toISOString(),message:'ComfyUI dan node workflow tersedia. Muatan model dan kompatibilitas generasi diperiksa saat menjalankan workflow.'};}
export async function requestComfyMedia(c:Connection,prompt:string,kind:'image'|'video'){
 const graph=graphFor(c);const signal=AbortSignal.timeout(12*60*1000);await checkNodes(c,graph,signal);graph[c.comfy.promptNodeId].inputs[c.comfy.promptInput]=prompt.slice(0,12000);
 const submit=await json(await api(c,'/prompt',signal,{prompt:graph,client_id:randomUUID()}));
 if(submit.error||submit.node_errors&&Object.keys(submit.node_errors).length)throw new OfficeError('ComfyUI menolak workflow. Periksa error node pada ComfyUI.',502);
 if(typeof submit.prompt_id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(submit.prompt_id))throw new OfficeError('ComfyUI tidak memberikan ID prompt yang valid.',502);
 let result;
 while(true){
  const history=await json(await api(c,`/history/${encodeURIComponent(submit.prompt_id)}`,signal));result=history[submit.prompt_id];
  if(result?.status?.status_str==='error'||result?.status?.messages?.some((m:unknown[])=>m[0]==='execution_error'||m[0]==='execution_interrupted'))throw new OfficeError('Workflow ComfyUI gagal. Periksa loader, model, VAE, encoder, dan memori GPU pada ComfyUI.',502);
  if(result?.status?.completed===true||result?.status?.status_str==='success')break;
  try{await delay(2000,undefined,{signal});}catch{throw new OfficeError('Waktu tunggu ComfyUI berakhir. Job dapat tetap berjalan; periksa sebelum membuat ulang.',502);}
 }
 const output=result?.outputs?.[c.comfy.outputNodeId];const files=[...(Array.isArray(output?.images)?output.images:[]),...(Array.isArray(output?.videos)?output.videos:[]),...(Array.isArray(output?.gifs)?output.gifs:[])];
 const file=files.find(f=>typeof f?.filename==='string'&&(kind==='image'?/\.(png|jpe?g|webp)$/i:/\.mp4$/i).test(f.filename)&&f.type==='output');
 if(!file||file.filename.length>255||/[\\/\x00]/.test(file.filename)||typeof(file.subfolder??'')!=='string'||file.subfolder?.split(/[\\/]/).some((s:string)=>s==='..')||file.subfolder?.startsWith('/')||file.subfolder?.includes('\0'))throw new OfficeError(`Node hasil belum menghasilkan ${kind==='image'?'PNG/JPEG/WebP':'MP4'} yang tersimpan. Gunakan SaveImage atau node SaveVideo/VHS yang menyimpan output MP4.`,502);
 const query=new URLSearchParams({filename:file.filename,subfolder:file.subfolder||'',type:'output'});
 // Fetch a filename from this job's selected output only; never follow arbitrary asset URLs.
 return bounded(await api(c,`/view?${query}`,signal),kind==='image'?32*1024*1024:64*1024*1024);
}
