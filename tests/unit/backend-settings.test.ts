import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getOffice,performAction,exportCampaign} from '../../src/lib/office/server/service';
import {readState,closeDatabases,lockCampaign,unlockCampaign} from '../../src/lib/office/server/store';
import {backendConnection} from '../../src/lib/office/server/backend';
import {testBackendConnection} from '../../src/lib/office/server/providers';
import {writeFileSync} from 'node:fs';
import type {AgentDraft} from '../../src/lib/office/types';
let directory:string;
const baseUrl='https://api.openai.com/v1';
const agent:AgentDraft={name:'Sora',role:'SEO Specialist',division:'marketing',avatarIndex:2,instructions:'Prioritaskan audiens lokal.',skills:[{name:'SEO Strategy',instructions:'Susun keyword intent dan content brief. Jangan mengarang volume pencarian.'}]};
beforeEach(()=>{directory=mkdtempSync(path.join(tmpdir(),'kadaka-backend-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const k of ['TIKTOK_ACCESS_TOKEN','CLAUDE_API_KEY','GEMINI_API_KEY','DESIGN_OPENAI_KEY','META_GRAPH_TOKEN','MARKETING_AI_KEY','OPENAI_API_KEY','MARKETING_IMAGE_KEY','MARKETING_AI_BASE_URL','MARKETING_AI_MODEL','OFFICE_ACCESS_TOKEN'])vi.stubEnv(k,'');});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function save(backend:{baseUrl:string;model:string;apiKey?:string;clearKey?:boolean}){return performAction({type:'saveBackend',backend});}
async function add(attach=false){await performAction({type:'addAgent',agent,...(attach?{campaignId:'campaign-kadaka'}:{})});return readState().agents.find(a=>a.name===agent.name)!;}

describe('backend configuration',()=>{
 it('normalizes Ollama root, native API, and full chat URLs into the compatible base URL',async()=>{
  for(const suffix of ['', '/', '/api', '/api/chat', '/api/generate','/v1/chat/completions','/api/chat/completions']){
   await save({baseUrl:`http://127.0.0.1:11434${suffix}`,model:'qwen2.5:3b'});
   expect(getOffice().config.aiBaseUrl).toBe('http://127.0.0.1:11434/v1');
  }
  await save({baseUrl:'https://api.example.test/custom/v1/chat/completions/',model:'custom',apiKey:'fake-key'});
  expect(backendConnection().baseUrl).toBe('https://api.example.test/custom/v1');
  await save({baseUrl:'https://api.example.test/custom/v1',model:'custom'});expect(backendConnection().key).toBe('fake-key');
 });
 it('repairs existing stored and environment Ollama URLs without rewriting office data',()=>{
  vi.stubEnv('MARKETING_AI_BASE_URL','http://localhost:11434/api/chat');expect(backendConnection().baseUrl).toBe('http://localhost:11434/v1');
  getOffice();writeFileSync(path.join(directory,'backend.json'),JSON.stringify({baseUrl:'http://127.0.0.1:11434/v1/chat/completions',model:'qwen2.5:3b'}));
  const before=readState();expect(getOffice().config.aiBaseUrl).toBe('http://127.0.0.1:11434/v1');expect(readState()).toEqual(before);
 });
 it('distinguishes a missing Ollama model from a missing endpoint',async()=>{
  await save({baseUrl:'http://127.0.0.1:11434',model:'qwen2.5:3b'});
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:"model 'qwen2.5:3b' not found"}),{status:404}));vi.stubGlobal('fetch',mock);
  await expect(testBackendConnection()).rejects.toThrow('Model tidak ditemukan');expect(mock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/chat/completions');
  mock.mockResolvedValue(new Response('404 page not found',{status:404}));await expect(testBackendConnection()).rejects.toThrow('Endpoint API tidak ditemukan');
 });
 it('encrypts API keys, keeps storage private, and returns metadata only',async()=>{
  await save({baseUrl,model:'gpt-4.1-mini',apiKey:'fake-new-provider-secret'});
  expect(readFileSync(path.join(directory,'backend.json'),'utf8')).not.toContain('fake-new-provider-secret');
  expect(statSync(path.join(directory,'backend.json')).mode&0o777).toBe(0o600);expect(statSync(path.join(directory,'backend.key')).mode&0o777).toBe(0o600);
  expect(backendConnection().key).toBe('fake-new-provider-secret');closeDatabases();
  expect(getOffice().config).toMatchObject({aiConfigured:true,aiKeySource:'stored',aiModel:'gpt-4.1-mini',aiBaseUrl:baseUrl});
  expect(JSON.stringify(getOffice())+JSON.stringify(exportCampaign('campaign-kadaka'))).not.toContain('fake-new-provider-secret');
 });
 it('preserves a key on a model change and disables it explicitly',async()=>{
  await save({baseUrl,model:'first',apiKey:'fake-key'});await save({baseUrl,model:'second',apiKey:''});
  expect(backendConnection()).toMatchObject({model:'second',key:'fake-key'});
  await save({baseUrl,model:'second',clearKey:true});expect(getOffice().config.aiConfigured).toBe(false);
 });
 it('keeps settings accessible after a lost encryption key and recovers through a new API key',async()=>{
  await save({baseUrl,model:'gpt-4.1-mini',apiKey:'fake-old-key'});
  rmSync(path.join(directory,'backend.key'));
  expect(getOffice().config).toMatchObject({aiConfigured:false,aiKeySource:'none',aiModel:'gpt-4.1-mini'});
  await save({baseUrl,model:'gpt-4.1-mini',apiKey:'fake-replacement-key'});
  expect(backendConnection().key).toBe('fake-replacement-key');
 });
 it('does not reuse stored or environment keys on a different endpoint',async()=>{
  vi.stubEnv('MARKETING_AI_KEY','fake-environment-key');await save({baseUrl,model:'first',apiKey:'fake-stored-key'});
  await save({baseUrl:'https://api.example.test/v1',model:'custom'});
  expect(backendConnection().key).toBeUndefined();expect(getOffice().config).toMatchObject({aiConfigured:false,imageConfigured:false,aiKeySource:'none'});
  await save({baseUrl:'https://api.example.test/v1',model:'custom',apiKey:'fake-custom-key'});expect(backendConnection().key).toBe('fake-custom-key');
  await save({baseUrl,model:'gpt-4.1-mini'});expect(backendConnection().key).toBe('fake-environment-key');
 });
 it('rejects invalid URLs and changing configuration during active work',async()=>{
  for(const url of ['http://api.example.test/v1','https://user:secret@api.example.test/v1','https://api.example.test/v1?key=secret'])await expect(save({baseUrl:url,model:'test'})).rejects.toMatchObject({status:400});
  const token=lockCampaign('campaign-kadaka');try{await expect(save({baseUrl,model:'test'})).rejects.toMatchObject({status:409});}finally{unlockCampaign('campaign-kadaka',token);}
  expect(getOffice().config.aiKeySource).toBe('none');
 });
 it('tests the saved endpoint/model through chat completions without returning keys or provider text',async()=>{
  await save({baseUrl:'https://api.example.test/v1',model:'custom-model',apiKey:'fake-key'});
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}),{status:200}));vi.stubGlobal('fetch',mock);
  expect(await testBackendConnection()).toMatchObject({ok:true,model:'custom-model'});
  expect(mock.mock.calls[0][0]).toBe('https://api.example.test/v1/chat/completions');expect(JSON.parse(mock.mock.calls[0][1].body).model).toBe('custom-model');
  expect(readState().runs).toHaveLength(0);expect(readState().artifacts).toHaveLength(0);
  mock.mockResolvedValue(new Response('{}',{status:200}));await expect(testBackendConnection()).rejects.toMatchObject({status:502});
 });
 it('uses a local Ollama model without API keys and sends no hosted credentials',async()=>{
  vi.stubEnv('MARKETING_AI_KEY','fake-hosted-secret');
  await save({baseUrl:'http://127.0.0.1:11434/v1',model:'qwen2.5:3b'});
  expect(getOffice().config).toMatchObject({aiConfigured:true,aiLocal:true,aiKeySource:'none',aiProvider:'Ollama (lokal)',imageConfigured:false});
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'# Local result'}}]}),{status:200}));vi.stubGlobal('fetch',mock);
  await performAction({type:'runTask',taskId:readState().tasks[0].id,mode:'live'});
  expect(mock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/chat/completions');
  expect(mock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');expect(JSON.parse(mock.mock.calls[0][1].body).model).toBe('qwen2.5:3b');
  expect(readState().artifacts[0]).toMatchObject({mode:'live',content:'# Local result'});
  mock.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'',reasoning:'OK'}}]}),{status:200}));expect(await testBackendConnection()).toMatchObject({ok:true,model:'qwen2.5:3b'});
 });
 it('accepts loopback HTTP only and reports an unavailable local server',async()=>{
  for(const baseUrl of ['http://localhost:11434/v1','http://[::1]:11434/v1'])await save({baseUrl,model:'local'});
  for(const baseUrl of ['http://192.168.1.10:11434/v1','http://localhost.example.com/v1','http://127.0.0.1.example.com/v1'])await expect(save({baseUrl,model:'local'})).rejects.toMatchObject({status:400});
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('connect ECONNREFUSED')));await expect(testBackendConnection()).rejects.toMatchObject({status:502});
  expect(getOffice().config.aiLocal).toBe(true);expect(readState().artifacts).toHaveLength(0);
 });
});
describe('custom agents and executable skills',()=>{
 it('preserves old office data and attaches a skilled agent to future campaigns',async()=>{
  const sora=await add();expect(readState().tasks).toHaveLength(8);closeDatabases();
  expect(readState().agents.find(a=>a.id===sora.id)?.skills).toEqual(agent.skills);
  const result=await performAction({type:'createCampaign',brief:{name:'SEO Launch',product:'Coffee',audience:'Local creators',objective:'Awareness',channels:['Instagram'],budget:'',deadline:''}});
  const campaign=result.state.campaigns.find(c=>c.name==='SEO Launch')!;const tasks=result.state.tasks.filter(t=>t.campaignId===campaign.id);
  expect(tasks).toHaveLength(9);expect(tasks.at(-1)).toMatchObject({agentId:sora.id,division:'marketing'});expect(tasks.at(-1)?.dependencies).toEqual([tasks.at(-2)!.id]);
 });
 it('makes a new agent available in current workflows, shared reports, and chat assignments',async()=>{
  const sora=await add(true);await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});
  const task=readState().tasks.find(t=>t.agentId===sora.id)!;const artifact=readState().artifacts.find(a=>a.taskId===task.id)!;
  expect(artifact.content).toContain('SEO Strategy');expect(artifact.content).toContain(agent.skills[0].instructions);expect(readState().messages.some(m=>m.senderId===sora.id&&m.channel==='general'&&m.taskId===task.id)).toBe(true);
  await performAction({type:'sendMessage',campaignId:'campaign-kadaka',channel:'general',assignTo:sora.id,content:'Buat outline SEO untuk landing page'});
  expect(readState().tasks.filter(t=>t.agentId===sora.id)).toHaveLength(2);
 });
 it('applies custom role instructions and skill content to actual provider requests',async()=>{
  const sora=await add();await save({baseUrl,model:'gpt-4.1-mini',apiKey:'fake-key'});
  await performAction({type:'sendMessage',campaignId:'campaign-kadaka',channel:'general',assignTo:sora.id,content:'Buat strategi SEO'});
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'# SEO deliverable'}}]}),{status:200}));vi.stubGlobal('fetch',mock);
  const task=readState().tasks.find(t=>t.agentId===sora.id)!;await performAction({type:'runTask',taskId:task.id,mode:'live'});
  const body=JSON.parse(mock.mock.calls[0][1].body);expect(body.messages[0].content).toContain('Prioritaskan audiens lokal.');expect(body.messages[0].content).toContain(agent.skills[0].instructions);
  expect(readState().artifacts.find(a=>a.taskId===task.id)).toMatchObject({mode:'live',content:'# SEO deliverable'});
 });
 it('invalidates approvals when skills change and guards edits while work is running',async()=>{
  const sora=await add(true);await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});
  const task=readState().tasks.find(t=>t.agentId===sora.id)!;const artifact=readState().artifacts.find(a=>a.taskId===task.id)!;
  await performAction({type:'approveArtifact',artifactId:artifact.id});const updated={...agent,skills:[{name:'Local SEO',instructions:'Fokus pada intent pencarian lokal dan fakta lokasi yang terverifikasi.'}]};
  await performAction({type:'updateAgent',agentId:sora.id,agent:updated});expect(readState().artifacts.find(a=>a.id===artifact.id)?.status).toBe('revision');
  const token=lockCampaign('campaign-kadaka');try{await expect(performAction({type:'updateAgent',agentId:sora.id,agent})).rejects.toMatchObject({status:409});}finally{unlockCampaign('campaign-kadaka',token);}
 });
 it('keeps backend changes blocked throughout a long campaign with additional agents',async()=>{
  for(let i=0;i<9;i++)await performAction({type:'addAgent',campaignId:'campaign-kadaka',agent:{...agent,name:`Specialist ${i}`,division:i<6?'marketing':'design'}});
  await save({baseUrl,model:'gpt-4.1-mini',apiKey:'fake-key'});
  let elapsed=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>elapsed);
  const mock=vi.fn(async()=>{
   elapsed+=60_000;
   await expect(save({baseUrl,model:'changed'})).rejects.toMatchObject({status:409});
   return new Response(JSON.stringify({choices:[{message:{content:'# Result'}}]}),{status:200});
  });vi.stubGlobal('fetch',mock);
  await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'live'});
  expect(mock).toHaveBeenCalledTimes(17);expect(readState().artifacts).toHaveLength(17);
  await save({baseUrl,model:'changed'});expect(getOffice().config.aiModel).toBe('changed');
 });
 it('requires valid skills, unique agent names, and preserves the human manager',async()=>{
  await add();await expect(performAction({type:'addAgent',agent:{...agent,name:'sora'}})).rejects.toMatchObject({status:409});
  await expect(performAction({type:'addAgent',agent:{...agent,name:'Other',skills:[]}})).rejects.toMatchObject({status:400});
  await expect(performAction({type:'updateAgent',agentId:'manager',agent})).rejects.toMatchObject({status:404});expect(readState().agents).toHaveLength(10);
 });
});
