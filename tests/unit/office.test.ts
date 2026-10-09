import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getOffice,performAction,exportCampaign} from '../../src/lib/office/server/service';
import {readState,closeDatabases,lockCampaign,unlockCampaign} from '../../src/lib/office/server/store';
import {checkOrigin,createSession,requireAccess} from '../../src/lib/office/server/http';
import {sendPublication} from '../../src/lib/office/server/providers';

let directory:string;
const campaignId='campaign-kadaka';
const schedule={type:'schedule',campaignId,channels:['Instagram','TikTok'],scheduledAt:new Date(Date.now()+86400000).toISOString()};
async function runDemo(){return (await performAction({type:'runCampaign',campaignId,mode:'demo'})).state;}
async function approveAll(){for(const a of readState().artifacts)await performAction({type:'approveArtifact',artifactId:a.id});}
beforeEach(()=>{
 directory=mkdtempSync(path.join(tmpdir(),'kadaka-unit-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const n of ['QWEN_IMAGE_KEY','QWEN_IMAGE_MODEL','QWEN_IMAGE_BASE_URL'])vi.stubEnv(n,'');
 for(const name of ['GOOGLE_IMAGEN_KEY','GOOGLE_IMAGEN_MODEL','HF_IMAGE_TOKEN','HF_IMAGE_MODEL','MARKETING_IMAGE_MODEL','TIKTOK_ACCESS_TOKEN','CLAUDE_API_KEY','GEMINI_API_KEY','DESIGN_OPENAI_KEY','META_GRAPH_TOKEN','MARKETING_AI_KEY','OPENAI_API_KEY','MARKETING_IMAGE_KEY','OFFICE_ACCESS_TOKEN','MARKETING_AI_BASE_URL','MARKETING_PUBLISH_URL','MARKETING_PUBLISH_TOKEN'])vi.stubEnv(name,'');
});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('durable office workflow',()=>{
 it('creates an optional-budget brief, eight distinct assigned roles, and persists after reopening SQLite',async()=>{
  const result=await performAction({type:'createCampaign',brief:{name:'Launch',product:'Verified coffee product',audience:'Local creators',objective:'Store visits',channels:['Instagram','TikTok'],budget:'',deadline:''}});
  const campaign=result.state.campaigns.find(c=>c.name==='Launch')!;
  const tasks=result.state.tasks.filter(t=>t.campaignId===campaign.id);
  expect(tasks).toHaveLength(8);expect(new Set(tasks.map(t=>t.agentId)).size).toBe(8);
  closeDatabases();expect(getOffice().state.campaigns.find(c=>c.id===campaign.id)?.budget).toBe('');
 });
 it('executes all dependencies, records labeled outputs and division reports, and does not rerun successful work',async()=>{
  const state=await runDemo();expect(state.artifacts).toHaveLength(8);expect(state.runs).toHaveLength(8);
  expect(state.artifacts.every(a=>a.mode==='demo'&&a.content.includes('DEMO TEMPLATE'))).toBe(true);
  for(const task of state.tasks){expect(state.messages.some(m=>m.taskId===task.id&&m.channel===task.division)).toBe(true);expect(state.messages.some(m=>m.taskId===task.id&&m.channel==='general')).toBe(true);}
  await performAction({type:'runCampaign',campaignId,mode:'demo'});expect(readState().runs).toHaveLength(8);
 });
 it('blocks running dependent work before prerequisites and rolls back failed mutation',async()=>{
  const task=readState().tasks[1];const before=readState().revision;
  await expect(performAction({type:'runTask',taskId:task.id,mode:'demo'})).rejects.toMatchObject({status:409});
  expect(readState().artifacts).toHaveLength(0);expect(readState().tasks.every(t=>t.status==='pending')).toBe(true);
  expect(readState().revision).toBeGreaterThanOrEqual(before);
 });
 it('turns assigned chat instructions into persisted tasks while ordinary messages remain messages',async()=>{
  await performAction({type:'sendMessage',content:'Investigate local collaboration',channel:'general',campaignId,assignTo:'maya'});
  await performAction({type:'sendMessage',content:'Good morning',channel:'general',campaignId});
  closeDatabases();const state=readState();expect(state.tasks).toHaveLength(9);
  const assigned=state.tasks.at(-1)!;expect(assigned.instructions).toBe('Investigate local collaboration');
  expect(state.messages.some(m=>m.content==='Investigate local collaboration'&&m.taskId===assigned.id)).toBe(true);
 });
 it('requires all approvals for scheduling, saves no external delivery, and deduplicates schedule requests',async()=>{
  await runDemo();await expect(performAction(schedule)).rejects.toMatchObject({status:409});
  await approveAll();await performAction(schedule);await performAction(schedule);
  expect(readState().publications).toHaveLength(2);expect(readState().publications.every(p=>p.status==='scheduled')).toBe(true);
  const exported=exportCampaign(campaignId);expect(exported.approved).toBe(true);expect(exported.artifacts).toHaveLength(8);
 });
 it('propagates revision to every dependent output and cancels stale schedules, then regenerates versions',async()=>{
  const state=await runDemo();await approveAll();await performAction(schedule);
  const first=state.artifacts[0];await performAction({type:'requestRevision',artifactId:first.id,feedback:'Focus on returning customers'});
  expect(readState().artifacts.every(a=>a.status==='revision')).toBe(true);expect(readState().publications).toHaveLength(0);
  await expect(performAction({type:'approveArtifact',artifactId:readState().artifacts[1].id})).rejects.toMatchObject({status:409});
  await runDemo();expect(readState().artifacts.every(a=>a.version===2&&a.status==='review')).toBe(true);
  expect(readState().artifacts[0].content).toContain('Focus on returning customers');
 });
 it('manual edits invalidate downstream approvals and cannot approve stale dependencies',async()=>{
  await runDemo();await approveAll();const artifacts=readState().artifacts;
  await performAction({type:'editArtifact',artifactId:artifacts[1].id,content:'# New strategy\nHuman correction'});
  expect(readState().artifacts[1]).toMatchObject({mode:'manual',version:2,status:'review'});
  expect(readState().artifacts.slice(2).every(a=>a.status==='revision')).toBe(true);
  await expect(performAction({type:'editArtifact',artifactId:artifacts[3].id,content:'Stale downstream edit'})).rejects.toMatchObject({status:409});
 });
 it('protects active campaigns against concurrent runs, approval edits and task assignment',async()=>{
  await runDemo();const token=lockCampaign(campaignId);
  try{
   await expect(performAction({type:'requestRevision',artifactId:readState().artifacts[0].id,feedback:'Change'})).rejects.toMatchObject({status:409});
   await expect(performAction({type:'sendMessage',campaignId,channel:'general',content:'Create work',assignTo:'rio'})).rejects.toMatchObject({status:409});
  }finally{unlockCampaign(campaignId,token);}
 });
 it('rejects invalid briefs, metric counts, channels, and missing entities without partial writes',async()=>{
  const count=readState().campaigns.length;
  await expect(performAction({type:'createCampaign',brief:{name:'',channels:[]}})).rejects.toMatchObject({status:400});
  expect(readState().campaigns).toHaveLength(count);
  await expect(performAction({type:'importMetrics',campaignId,metrics:[{channel:'Instagram',impressions:1,clicks:2,conversions:0,spend:0}]})).rejects.toMatchObject({status:400});
  await expect(performAction({type:'importMetrics',campaignId,metrics:[{channel:'LinkedIn',impressions:5,clicks:1,conversions:0,spend:10}]})).rejects.toMatchObject({status:400});
  await expect(performAction({type:'runTask',taskId:'missing',mode:'demo'})).rejects.toMatchObject({status:404});
  expect(readState().metrics).toHaveLength(0);
 });
});
describe('real providers and access boundaries',()=>{
 it('fails explicitly without keys and does not silently substitute demo outputs',async()=>{
  await expect(performAction({type:'runCampaign',campaignId,mode:'live'})).rejects.toMatchObject({status:409});
  expect(readState().runs).toHaveLength(0);expect(readState().artifacts).toHaveLength(0);
 });
 it('records provider failures, releases the campaign lock, and allows a meaningful retry',async()=>{
  vi.stubEnv('MARKETING_AI_KEY','unit-test-placeholder');const mock=vi.fn().mockResolvedValue(new Response('{}',{status:429}));vi.stubGlobal('fetch',mock);
  await expect(performAction({type:'runCampaign',campaignId,mode:'live'})).rejects.toMatchObject({status:502});
  expect(readState().tasks[0].status).toBe('failed');expect(readState().runs[0].status).toBe('failed');expect(readState().artifacts).toHaveLength(0);
  mock.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'# Verified mocked provider result'}}]}),{status:200}));
  await performAction({type:'runTask',taskId:readState().tasks[0].id,mode:'live'});
  expect(readState().artifacts[0]).toMatchObject({mode:'live',content:'# Verified mocked provider result'});
  expect(JSON.stringify(getOffice())).not.toContain('unit-test-placeholder');
 });
 it('keeps existing visual assets on image failure',async()=>{
  await runDemo();const artifact=readState().artifacts.find(a=>a.type==='design')!;
  const before=structuredClone(artifact);vi.stubEnv('MARKETING_IMAGE_KEY','unit-test-placeholder');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:500})));
  await expect(performAction({type:'generateImage',artifactId:artifact.id})).rejects.toMatchObject({status:502});
  expect(readState().artifacts.find(a=>a.id===artifact.id)).toEqual(before);
 });
 it('packages generated PNG assets and invalidates dependent approvals after adding a visual',async()=>{
  await runDemo();await approveAll();const artifact=readState().artifacts.find(a=>a.type==='design')!;
  const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNQCv2vFPqfAUIBACWCBdkiTiprAAAAAElFTkSuQmCC';
  vi.stubEnv('MARKETING_IMAGE_KEY','unit-test-placeholder');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{b64_json:png}]}),{status:200})));
  await performAction({type:'generateImage',artifactId:artifact.id});
  const updated=readState().artifacts.find(a=>a.id===artifact.id)!;
  expect(updated.imageUrl).toMatch(/^\/api\/office\/assets\/image-/);expect(updated.status).toBe('review');
  const pack=exportCampaign(campaignId);expect(pack.assets).toHaveLength(1);expect(Buffer.from(pack.assets[0].dataBase64,'base64').subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));expect(pack.approved).toBe(false);
 });
 it('accepts only an explicit published receipt from an idempotent webhook',async()=>{
  vi.stubEnv('MARKETING_PUBLISH_URL','https://publisher.example.test/submit');vi.stubEnv('MARKETING_PUBLISH_TOKEN','unit-test-placeholder');
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'queued'}),{status:200}));vi.stubGlobal('fetch',mock);
  await expect(sendPublication({campaign:'test'},'receipt-1')).rejects.toMatchObject({status:502});
  mock.mockResolvedValue(new Response(JSON.stringify({status:'published'}),{status:200}));
  await sendPublication({campaign:'test'},'receipt-1');expect(mock.mock.calls[1][1].headers['Idempotency-Key']).toBe('receipt-1');
 });
 it('requires the configured manager session and rejects cross-site mutation',async()=>{
  vi.stubEnv('OFFICE_ACCESS_TOKEN','test-access-token');
  expect(()=>requireAccess(new Request('http://localhost/api/office'))).toThrow();
  const session=await createSession(new Request('http://localhost/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'test-access-token'})}));
  const cookie=session.headers.get('set-cookie')!.split(';')[0];
  expect(()=>requireAccess(new Request('http://localhost/api/office',{headers:{Cookie:cookie}}))).not.toThrow();
  expect(()=>checkOrigin(new Request('http://localhost/api/office/action',{headers:{Origin:'https://other.example'}}))).toThrow();
  expect(()=>checkOrigin(new Request('http://localhost:3001/api/office/action',{headers:{Host:'127.0.0.1:3001',Origin:'http://127.0.0.1:3001'}}))).not.toThrow();
 });
});
