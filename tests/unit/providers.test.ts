import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getOffice,performAction,exportCampaign} from '../../src/lib/office/server/service';
import {closeDatabases,readState,lockCampaign,unlockCampaign} from '../../src/lib/office/server/store';
import {backendConnection,providerConnection,metaConnection} from '../../src/lib/office/server/backend';
import {generateOutput,taskConnection,testProviderConnection,requestImage} from '../../src/lib/office/server/providers';
import type {ProviderId} from '../../src/lib/office/types';
let directory:string;
const names=['GOOGLE_IMAGEN_KEY','GOOGLE_IMAGEN_MODEL','HF_IMAGE_TOKEN','HF_IMAGE_MODEL','MARKETING_IMAGE_MODEL','TIKTOK_ACCESS_TOKEN','MARKETING_AI_KEY','OPENAI_API_KEY','MARKETING_AI_BASE_URL','MARKETING_IMAGE_KEY','CLAUDE_API_KEY','GEMINI_API_KEY','DESIGN_OPENAI_KEY','META_GRAPH_TOKEN'];
beforeEach(()=>{directory=mkdtempSync(path.join(tmpdir(),'office-providers-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const n of ['QWEN_IMAGE_KEY','QWEN_IMAGE_MODEL','QWEN_IMAGE_BASE_URL'])vi.stubEnv(n,'');names.forEach(n=>vi.stubEnv(n,''));});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
async function save(provider:ProviderId,apiKey=`fake-${provider}-secret`,enabled=true){await performAction({type:'saveProvider',provider,settings:{enabled,model:provider==='gemini'?'gemini-2.5-flash':'test-model',apiKey}});}
it('encrypts separate keys, preserves global and profile settings in both directions, and excludes secrets from responses/exports',async()=>{
 await save('claude');await save('gemini');await save('openai');await performAction({type:'saveMeta',settings:{enabled:true,apiKey:'fake-meta-secret'}});
 await performAction({type:'saveBackend',backend:{baseUrl:'http://127.0.0.1:11434/v1',model:'qwen2.5:3b'}});
 expect(backendConnection().model).toBe('qwen2.5:3b');for(const id of ['claude','gemini','openai'] as const)expect(providerConnection(id).key).toBe(`fake-${id}-secret`);
 await save('claude','');expect(providerConnection('claude').key).toBe('fake-claude-secret');expect(backendConnection().model).toBe('qwen2.5:3b');expect(metaConnection().key).toBe('fake-meta-secret');
 const serialized=JSON.stringify(getOffice())+JSON.stringify(exportCampaign('campaign-kadaka'))+readFileSync(path.join(directory,'backend.json'),'utf8');
 for(const id of ['claude','gemini','openai','meta'])expect(serialized).not.toContain(`fake-${id}-secret`);
});
it('routes both design agents and custom division tasks, with explicit disable restoring fallback',async()=>{
 for(const p of ['claude','gemini','openai'] as const)await save(p);
 const tasks=readState().tasks;expect(taskConnection(tasks.find(t=>t.agentId==='atlas')).provider).toBe('claude');expect(taskConnection(tasks.find(t=>t.agentId==='nova')).provider).toBe('claude');
 expect(taskConnection(tasks.find(t=>t.agentId==='luna')).provider).toBe('gemini');expect(taskConnection(tasks.find(t=>t.agentId==='pixel')).provider).toBe('openai');
 expect(taskConnection({...tasks[0],division:'design',agentId:'custom-designer'}).provider).toBe('gemini');
 for(const id of ['maya','rio','cleo','kai'])expect(taskConnection(tasks.find(t=>t.agentId===id)).provider).toBe('default');
 await save('gemini','',false);expect(taskConnection(tasks.find(t=>t.agentId==='luna')).provider).toBe('openai');
 await save('openai','',false);expect(taskConnection(tasks.find(t=>t.agentId==='luna')).provider).toBe('default');
});
it.each(['claude','gemini','openai'] as const)('uses native %s request format and only its own credential',async(provider)=>{
 await save(provider);const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(Response.json(provider==='claude'?{content:[{type:'text',text:'Analisis valid'}]}:provider==='gemini'?{candidates:[{content:{parts:[{thought:true,text:'private reasoning'},{text:'Analisis valid'}]}}]}:{choices:[{message:{content:'Analisis valid'}}]})));vi.stubGlobal('fetch',fetcher);
 const state=readState();const task=state.tasks.find(t=>t.agentId===(provider==='claude'?'atlas':provider==='gemini'?'luna':'pixel'))!;
 expect(await generateOutput(state,task,state.campaigns[0],'live')).toBe('Analisis valid');
 const [url,init]=fetcher.mock.calls[0];const body=JSON.parse(init.body);expect(JSON.stringify(init.headers)).toContain(`fake-${provider}-secret`);expect(url).not.toContain('secret');
 if(provider==='claude'){expect(url).toBe('https://api.anthropic.com/v1/messages');expect(init.headers['anthropic-version']).toBe('2023-06-01');expect(body.system).toContain('Marketing Manager');expect(body.max_tokens).toBe(2800);expect(body.messages[0].role).toBe('user');}
 else if(provider==='gemini'){expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');expect(init.headers['x-goog-api-key']).toBe('fake-gemini-secret');expect(body.systemInstruction.parts[0].text).toContain('Marketing Manager');expect(body.contents[0].role).toBe('user');}
 else{expect(url).toBe('https://api.openai.com/v1/chat/completions');expect(init.headers.Authorization).toBe('Bearer fake-openai-secret');expect(body.max_completion_tokens).toBe(2800);}
});
it('allows a Claude-only analyst task, preflights all campaign providers, and does not silently fall back from missing enabled credentials',async()=>{
 await save('claude');const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({content:[{type:'text',text:'Result'}]})));vi.stubGlobal('fetch',fetcher);
 const task=readState().tasks.find(t=>t.agentId==='atlas')!;
 await expect(performAction({type:'runCampaign',campaignId:task.campaignId,mode:'live'})).rejects.toThrow('backend utama');expect(readState().runs).toHaveLength(0);expect(fetcher).not.toHaveBeenCalled();
 await performAction({type:'runTask',taskId:task.id,mode:'live'});expect(readState().artifacts[0].mode).toBe('live');
 await performAction({type:'saveProvider',provider:'claude',settings:{enabled:true,model:'test-model',clearKey:true}});
 const state=readState();await expect(generateOutput(state,task,state.campaigns[0],'live')).rejects.toThrow('claude');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not reveal provider errors or fall back to an environment key after clear',async()=>{
 vi.stubEnv('CLAUDE_API_KEY','fake-env-claude');await save('claude');await performAction({type:'saveProvider',provider:'claude',settings:{enabled:true,model:'test-model',clearKey:true}});expect(providerConnection('claude').key).toBeUndefined();
 await save('claude');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('fake-claude-secret',{status:401})));
 await expect(testProviderConnection('claude')).rejects.toThrow('HTTP 401');await expect(testProviderConnection('claude')).rejects.not.toThrow('fake-claude-secret');
});
it('validates Meta identity using a separate bearer token with GET only and no token in URL',async()=>{
 await save('openai');await performAction({type:'saveMeta',settings:{enabled:true,apiKey:'fake-meta-secret'}});
 const fetcher=vi.fn().mockResolvedValue(Response.json({id:'1234',name:'Publisher Test'}));vi.stubGlobal('fetch',fetcher);
 expect(await testProviderConnection('meta')).toMatchObject({ok:true,account:{id:'1234',name:'Publisher Test'}});
 const [url,init]=fetcher.mock.calls[0];expect(url).toBe('https://graph.facebook.com/v23.0/me?fields=id,name');expect(init.method).toBe('GET');expect(init.headers.Authorization).toBe('Bearer fake-meta-secret');expect(init.body).toBeUndefined();expect(readState().publications).toHaveLength(0);
 await performAction({type:'saveMeta',settings:{enabled:true,clearKey:true}});expect(metaConnection().key).toBeUndefined();await expect(testProviderConnection('meta')).rejects.toThrow('token Meta');
});
it('uses only the OpenAI profile for GPT Image, never Claude or Gemini keys',async()=>{
 await save('claude');await save('gemini');await expect(requestImage('test')).rejects.toThrow('GPT Image belum');
 await save('openai');const fetcher=vi.fn().mockResolvedValue(Response.json({data:[{b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNQCv2vFPqfAUIBACWCBdkiTiprAAAAAElFTkSuQmCC'}]}));vi.stubGlobal('fetch',fetcher);
 await requestImage('test');expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer fake-openai-secret');expect(fetcher.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/generations');
});
it('blocks changing profiles during active work and rejects arbitrary native endpoints',async()=>{
 const lock=lockCampaign('campaign-kadaka');try{await expect(save('claude')).rejects.toThrow();await expect(performAction({type:'saveMeta',settings:{enabled:true,apiKey:'fake'}})).rejects.toThrow();}finally{unlockCampaign('campaign-kadaka',lock);}
 await expect(performAction({type:'saveProvider',provider:'claude',settings:{enabled:true,model:'test',apiKey:'fake',baseUrl:'https://other.test'}})).rejects.toThrow();
});
it('protects the provider test route with origin/auth checks and strict input before calling a provider',async()=>{
 const {POST}=await import('../../src/app/api/office/providers/test/route');
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const request=(data:unknown,origin='http://localhost')=>new Request('http://localhost/api/office/providers/test',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(data)});
 expect((await POST(request({provider:'claude'},'https://other.test'))).status).toBe(403);
 vi.stubEnv('OFFICE_ACCESS_TOKEN','fake-manager');expect((await POST(request({provider:'claude'}))).status).toBe(401);
 vi.stubEnv('OFFICE_ACCESS_TOKEN','');expect((await POST(request({provider:'claude',apiKey:'must-not-accept'}))).status).toBe(400);
 expect(fetcher).not.toHaveBeenCalled();
});
