import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';

const localEnv=fileURLToPath(new URL('../.env.local',import.meta.url));
if(existsSync(localEnv))process.loadEnvFile(localEnv);

const command=process.argv[2];
if(!['dev','start'].includes(command))throw new Error('Use dev or start.');
const model=process.env.LOCAL_LLM_MODEL||'Gwen3.8:27b';
const endpoint=process.env.LOCAL_LLM_BASE_URL||'http://127.0.0.1:11434/v1';
console.log(`Local LLM: ${model}. Pilih Ollama di Backend & API jika sudah ada konfigurasi tersimpan.`);
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),command,'--hostname','127.0.0.1',...process.argv.slice(3)],{
 stdio:'inherit',env:{...process.env,MARKETING_AI_BASE_URL:endpoint,MARKETING_AI_MODEL:model,
  // Hosted provider keys must not become credentials for the local endpoint.
  MARKETING_AI_KEY:'',OPENAI_API_KEY:'',
  NO_PROXY:[process.env.NO_PROXY||process.env.no_proxy||'','localhost','127.0.0.1','::1'].filter(Boolean).join(',')}
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
