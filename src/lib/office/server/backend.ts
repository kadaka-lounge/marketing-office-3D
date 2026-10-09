import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import path from 'node:path';
import {dataDirectory} from './store';
import {OfficeError} from './validation';
import type {BackendDraft,ProviderDraft,ProviderId,MetaDraft,ImageProviderDraft,ImageProviderId,ImageAspectRatio} from '../types';
import {normalizeAIBaseUrl} from '../endpoints';

const OPENAI='https://api.openai.com/v1';
interface StoredProfile {model?:string;enabled:boolean;secret?:string;disableEnvironmentKey?:boolean;}
interface StoredImage extends StoredProfile {aspectRatio:ImageAspectRatio;}
interface StoredBackend {images?:Partial<Record<ImageProviderId,StoredImage>>;imageProvider?:ImageProviderId;profiles?:Partial<Record<ProviderId,StoredProfile>>;meta?:StoredProfile;tiktok?:StoredProfile;baseUrl:string;model:string;secret?:string;disableEnvironmentKey?:boolean;}
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

export const IMAGE_PROVIDERS={openai:{model:'gpt-image-1',environment:'MARKETING_IMAGE_KEY'},imagen:{model:'imagen-3.0-generate-002',environment:'GOOGLE_IMAGEN_KEY'},huggingface:{model:'black-forest-labs/FLUX.1-schnell',environment:'HF_IMAGE_TOKEN'}} as const;
export function imageProvider(){return readStored()?.imageProvider||'openai';}
export function imageConnection(provider:ImageProviderId=imageProvider()){
 const profile=readStored()?.images?.[provider];const connection=profileKey(profile,IMAGE_PROVIDERS[provider].environment);
 let key=connection.key;let keySource:typeof connection.keySource|'shared'=connection.keySource;
 if(provider==='openai'&&!key&&!profile?.disableEnvironmentKey){
  const design=providerConnection('openai');const main=backendConnection();key=(design.enabled?design.key:undefined)||(main.baseUrl===OPENAI?main.key:undefined);if(key)keySource='shared';
 }
 const environmentModel=provider==='openai'?process.env.MARKETING_IMAGE_MODEL:provider==='imagen'?process.env.GOOGLE_IMAGEN_MODEL:process.env.HF_IMAGE_MODEL;
 return {provider,model:profile?.model||environmentModel||IMAGE_PROVIDERS[provider].model,aspectRatio:profile?.aspectRatio||'1:1' as ImageAspectRatio,key,keySource};
}
export function saveImageProvider(input:ImageProviderDraft){const next=storedOrDefault();next.imageProvider=input.provider;next.images={...next.images,[input.provider]:{...updatedProfile(next.images?.[input.provider],{...input,enabled:true}),aspectRatio:input.aspectRatio}};writeStored(next);}
