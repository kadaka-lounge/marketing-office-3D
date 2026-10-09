import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import path from 'node:path';
import {dataDirectory} from './store';
import {OfficeError} from './validation';
import type {BackendDraft} from '../types';
import {normalizeAIBaseUrl} from '../endpoints';

const OPENAI='https://api.openai.com/v1';
interface StoredBackend {baseUrl:string;model:string;secret?:string;disableEnvironmentKey?:boolean;}
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
 const next:StoredBackend={baseUrl,model:input.model,disableEnvironmentKey: input.clearKey || (changed ? false : previous?.disableEnvironmentKey)};
 if(input.apiKey){next.secret=encrypt(input.apiKey);next.disableEnvironmentKey=false;}
 else if(!input.clearKey&&!changed&&previous?.secret)next.secret=previous.secret;
 // A stored key is scoped to its endpoint. Never forward it to a changed provider.
 const directory=dataDirectory();mkdirSync(directory,{recursive:true,mode:0o700});
 const temporary=path.join(directory,`backend-${randomBytes(8).toString('hex')}.tmp`);
 writeFileSync(temporary,JSON.stringify(next),{flag:'wx',mode:0o600});renameSync(temporary,path.join(directory,'backend.json'));
}
