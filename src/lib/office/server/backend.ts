import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import path from 'node:path';
import {dataDirectory} from './store';
import {OfficeError} from './validation';
import {parseComfyWorkflow,validateComfyBindings} from '../comfy-workflow';
import type {BackendDraft,ProviderDraft,ProviderId,MetaDraft,ImageProviderDraft,ImageProviderId,ImageAspectRatio,VideoProviderDraft,VideoAspectRatio,ComfyDraft} from '../types';
import {normalizeAIBaseUrl,normalizeImageBaseUrl,isLocalEndpoint,normalizeComfyBaseUrl} from '../endpoints';

const OPENAI='https://api.openai.com/v1';
interface StoredProfile {model?:string;enabled:boolean;secret?:string;disableEnvironmentKey?:boolean;}
interface StoredComfy {workflowSecret?:string;promptNodeId:string;promptInput:string;outputNodeId:string;}
interface StoredImage extends StoredProfile {comfy?:StoredComfy;baseUrl?:string;aspectRatio:ImageAspectRatio;}
interface StoredBackend {videoProvider?:'huggingface'|'comfyui';videoComfy?:StoredImage;video?:StoredProfile&{aspectRatio:VideoAspectRatio};images?:Partial<Record<ImageProviderId,StoredImage>>;imageProvider?:ImageProviderId;profiles?:Partial<Record<ProviderId,StoredProfile>>;meta?:StoredProfile;tiktok?:StoredProfile;baseUrl:string;model:string;secret?:string;disableEnvironmentKey?:boolean;}
export function environmentBaseUrl(){return normalizeAIBaseUrl(process.env.MARKETING_AI_BASE_URL||OPENAI);}
function readStored():StoredBackend|undefined {
 try{return JSON.parse(readFileSync(path.join(dataDirectory(),'backend.json'),'utf8'));}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw new OfficeError('Konfigurasi backend tidak dapat dibaca. Periksa penyimpanan server.',500);}
}
function masterKey(){
 const directory=dataDirectory();mkdirSync(directory,{recursive:true,mode:0o700});const filename=path.join(directory,'backend.key');
 try {return readFileSync(filename);}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const key=randomBytes(32);
 try {writeFileSync(filename,key,{flag:'wx',mode:0o600});return key;}
 catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return readFileSync(filename);throw error;}
}
function encrypt(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',masterKey(),iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');}
function decrypt(value:string){try{const bytes=Buffer.from(value,'base64');const cipher=createDecipheriv('aes-256-gcm',masterKey(),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');}catch{throw new OfficeError('Kunci backend tidak dapat dibaca. Masukkan ulang melalui pengaturan backend.',500);}}
export function backendConnection(){
 const stored=readStored();const baseUrl=normalizeAIBaseUrl(stored?.baseUrl||environmentBaseUrl());
 const environmentKey=baseUrl===environmentBaseUrl()&&!stored?.disableEnvironmentKey ? process.env.MARKETING_AI_KEY||process.env.OPENAI_API_KEY:undefined;
 let key:string|undefined;
 try {key=stored?.secret?decrypt(stored.secret):environmentKey;}
 catch(error){if(!(error instanceof OfficeError))throw error;}
 // Keep settings accessible after an encryption-key loss so the manager can re-enter the API key.
 return {baseUrl,model:stored?.model||process.env.MARKETING_AI_MODEL||'gpt-4.1-mini',key,keySource:(key?(stored?.secret?'stored':'environment'):'none') as 'stored'|'environment'|'none'};
}
export function saveBackend(input:BackendDraft){
 const previous=readStored();const currentBase=normalizeAIBaseUrl(previous?.baseUrl||environmentBaseUrl());const baseUrl=normalizeAIBaseUrl(input.baseUrl);
 const changed=baseUrl!==currentBase;
 const next:StoredBackend={...previous,secret:undefined,baseUrl,model:input.model,disableEnvironmentKey: input.clearKey || (changed ? false : previous?.disableEnvironmentKey)};
 if(input.apiKey){next.secret=encrypt(input.apiKey);next.disableEnvironmentKey=false;}
 else if(!input.clearKey&&!changed&&previous?.secret)next.secret=previous.secret;
 // A stored key is scoped to its endpoint. Never forward it to a changed provider.
 writeStored(next);
}
function writeStored(next:StoredBackend){
 const directory=dataDirectory();mkdirSync(directory,{recursive:true,mode:0o700});
 const temporary=path.join(directory,`backend-${randomBytes(8).toString('hex')}.tmp`);
 writeFileSync(temporary,JSON.stringify(next),{flag:'wx',mode:0o600});renameSync(temporary,path.join(directory,'backend.json'));
}

export const PROVIDERS = {
 claude:{baseUrl:'https://api.anthropic.com/v1',model:'claude-sonnet-4-6',environment:'CLAUDE_API_KEY'},
 gemini:{baseUrl:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-2.5-flash',environment:'GEMINI_API_KEY'},
 openai:{baseUrl:OPENAI,model:'gpt-4.1-mini',environment:'DESIGN_OPENAI_KEY'},
} as const;
function profileKey(profile:StoredProfile|undefined,environment:string){
 let key:string|undefined;
 try{key=profile?.secret?decrypt(profile.secret):!profile?.disableEnvironmentKey?process.env[environment]:undefined;}catch(error){if(!(error instanceof OfficeError))throw error;}
 return {key,keySource:(key?(profile?.secret?'stored':'environment'):'none') as 'stored'|'environment'|'none'};
}
export function providerConnection(provider:ProviderId){
 const profile=readStored()?.profiles?.[provider];const defaults=PROVIDERS[provider];const connection=profileKey(profile,defaults.environment);
 return {provider,baseUrl:defaults.baseUrl,model:profile?.model||defaults.model,enabled:profile?.enabled??Boolean(connection.key),...connection};
}
export function metaConnection(){const profile=readStored()?.meta;const connection=profileKey(profile,'META_GRAPH_TOKEN');return {enabled:profile?.enabled??Boolean(connection.key),...connection};}
function updatedProfile(previous:StoredProfile|undefined,input:ProviderDraft|MetaDraft):StoredProfile{
 const next={...previous,...('model' in input?{model:input.model}:{}),enabled:input.enabled};
 if(input.apiKey){next.secret=encrypt(input.apiKey);next.disableEnvironmentKey=false;}
 else if(input.clearKey){delete next.secret;next.disableEnvironmentKey=true;}
 return next;
}
function storedOrDefault():StoredBackend{return readStored()||{baseUrl:environmentBaseUrl(),model:backendConnection().model};}
export function saveProvider(provider:ProviderId,input:ProviderDraft){const next=storedOrDefault();next.profiles={...next.profiles,[provider]:updatedProfile(next.profiles?.[provider],input)};writeStored(next);}
export function saveMeta(input:MetaDraft){const next=storedOrDefault();next.meta=updatedProfile(next.meta,input);writeStored(next);}

export function tiktokConnection(){const profile=readStored()?.tiktok;const connection=profileKey(profile,'TIKTOK_ACCESS_TOKEN');return {enabled:profile?.enabled??Boolean(connection.key),...connection};}
export function saveTikTok(input:MetaDraft){const next=storedOrDefault();next.tiktok=updatedProfile(next.tiktok,input);writeStored(next);}

export const IMAGE_PROVIDERS={openai:{model:'gpt-image-1',environment:'MARKETING_IMAGE_KEY'},imagen:{model:'imagen-3.0-generate-002',environment:'GOOGLE_IMAGEN_KEY'},huggingface:{model:'black-forest-labs/FLUX.1-schnell',environment:'HF_IMAGE_TOKEN'},qwen:{model:'Qwen-Image-2.1-Uncensored-GGUF',environment:'QWEN_IMAGE_KEY'},comfyui:{model:'Qwen-Image-2.1-Uncensored-GGUF',environment:'COMFY_IMAGE_KEY'}} as const;
export function imageProvider(){return readStored()?.imageProvider||'openai';}
export function imageConnection(provider:ImageProviderId=imageProvider()){
 const profile=readStored()?.images?.[provider];const connection=profileKey(profile,IMAGE_PROVIDERS[provider].environment);
 let key=connection.key;let keySource:typeof connection.keySource|'shared'=connection.keySource;
 if(provider==='openai'&&!key&&!profile?.disableEnvironmentKey){
  const design=providerConnection('openai');const main=backendConnection();key=(design.enabled?design.key:undefined)||(main.baseUrl===OPENAI?main.key:undefined);if(key)keySource='shared';
 }
 const environmentModel=provider==='openai'?process.env.MARKETING_IMAGE_MODEL:provider==='imagen'?process.env.GOOGLE_IMAGEN_MODEL:provider==='qwen'?process.env.QWEN_IMAGE_MODEL:provider==='comfyui'?process.env.COMFY_IMAGE_MODEL:process.env.HF_IMAGE_MODEL;
 const baseUrl=provider==='comfyui'?normalizeComfyBaseUrl(profile?.baseUrl||process.env.COMFY_IMAGE_BASE_URL||'http://127.0.0.1:8188'):provider==='qwen'?normalizeImageBaseUrl(profile?.baseUrl||process.env.QWEN_IMAGE_BASE_URL||'http://127.0.0.1:1234/v1'):undefined;
 if(baseUrl){let valid=false;try{const url=new URL(baseUrl);valid=(url.protocol==='https:'||isLocalEndpoint(baseUrl))&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{}if(!valid)throw new OfficeError('Endpoint Qwen tidak valid. Gunakan HTTPS atau HTTP loopback tanpa kredensial, query, atau fragment.',409);}
 return {provider,comfy:comfyConnection(profile?.comfy),baseUrl,local:Boolean(baseUrl&&isLocalEndpoint(baseUrl)),model:profile?.model||environmentModel||IMAGE_PROVIDERS[provider].model,aspectRatio:profile?.aspectRatio||'1:1' as ImageAspectRatio,key,keySource};
}
export function saveImageProvider(input:ImageProviderDraft){
 const next=storedOrDefault();const previous=next.images?.[input.provider];let scoped:StoredProfile|undefined=previous;
 const baseUrl=input.provider==='comfyui'?normalizeComfyBaseUrl(input.baseUrl||imageConnection('comfyui').baseUrl!):input.provider==='qwen'?normalizeImageBaseUrl(input.baseUrl||imageConnection('qwen').baseUrl!):undefined;
 if(['qwen','comfyui'].includes(input.provider)&&baseUrl!==imageConnection(input.provider).baseUrl)scoped={...previous,enabled:true,secret:undefined,disableEnvironmentKey:true};
 next.imageProvider=input.provider;next.images={...next.images,[input.provider]:{...updatedProfile(scoped,{...input,enabled:true}),aspectRatio:input.aspectRatio,...(input.provider==='comfyui'?{comfy:updatedComfy(baseUrl!==imageConnection(input.provider).baseUrl?undefined:previous?.comfy,input.comfy)}:{}),...(baseUrl?{baseUrl}:{})}};writeStored(next);
}

function comfyConnection(profile?:StoredComfy){return {workflow:profile?.workflowSecret?decrypt(profile.workflowSecret):undefined,promptNodeId:profile?.promptNodeId||'',promptInput:profile?.promptInput||'text',outputNodeId:profile?.outputNodeId||''};}
function updatedComfy(previous:StoredComfy|undefined,input?:ComfyDraft):StoredComfy|undefined{
 if(!input)return previous;
 const next:StoredComfy={...previous,promptNodeId:input.promptNodeId,promptInput:input.promptInput,outputNodeId:input.outputNodeId};
 if(input.clearWorkflow)delete next.workflowSecret;
 else if(input.workflow?.trim())next.workflowSecret=encrypt(input.workflow);
 if(next.workflowSecret){try{validateComfyBindings(parseComfyWorkflow(decrypt(next.workflowSecret)),next.promptNodeId,next.promptInput,next.outputNodeId);}catch(error){throw new OfficeError(error instanceof Error?error.message:'Workflow tidak valid.',400);}}
 return next;
}
export function publicComfy(c:ReturnType<typeof comfyConnection>){return {workflowConfigured:Boolean(c.workflow),promptNodeId:c.promptNodeId,promptInput:c.promptInput,outputNodeId:c.outputNodeId};}
export function videoConnection(provider:'huggingface'|'comfyui'=readStored()?.videoProvider||'huggingface'){
 if(provider==='comfyui'){const profile=readStored()?.videoComfy;const baseUrl=normalizeComfyBaseUrl(profile?.baseUrl||process.env.COMFY_VIDEO_BASE_URL||'http://127.0.0.1:8188');let valid=false;try{const u=new URL(baseUrl);valid=(u.protocol==='https:'||isLocalEndpoint(baseUrl))&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{}if(!valid)throw new OfficeError('Endpoint ComfyUI video tidak valid.',409);return {provider,baseUrl,local:isLocalEndpoint(baseUrl),comfy:comfyConnection(profile?.comfy),model:profile?.model||process.env.COMFY_VIDEO_MODEL||'ltx25_uncensored_v1.1-fp8',aspectRatio:(profile?.aspectRatio||'9:16') as VideoAspectRatio,...profileKey(profile,'COMFY_VIDEO_KEY')};}
 const profile=readStored()?.video;return {provider,baseUrl:undefined,local:false,comfy:comfyConnection(),model:profile?.model||process.env.HF_VIDEO_MODEL||'Wan-AI/Wan2.2-T2V-A14B',aspectRatio:profile?.aspectRatio||'16:9' as VideoAspectRatio,...profileKey(profile,'HF_VIDEO_TOKEN')};
}
export function saveVideoProvider(input:VideoProviderDraft){
 const next=storedOrDefault();const provider=input.provider||'huggingface';next.videoProvider=provider;
 if(provider==='comfyui'){const previous=next.videoComfy;const baseUrl=normalizeComfyBaseUrl(input.baseUrl||videoConnection('comfyui').baseUrl!);const scoped=baseUrl!==videoConnection('comfyui').baseUrl?{...previous,enabled:true,secret:undefined,disableEnvironmentKey:true}:previous;next.videoComfy={...updatedProfile(scoped,{...input,enabled:true}),baseUrl,model:input.model,aspectRatio:input.aspectRatio,comfy:updatedComfy(baseUrl!==videoConnection('comfyui').baseUrl?undefined:previous?.comfy,input.comfy)};}
 else next.video={...updatedProfile(next.video,{...input,enabled:true}),aspectRatio:input.aspectRatio};writeStored(next);
}
