import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getOffice,performAction,exportCampaign} from '../../src/lib/office/server/service';
import {closeDatabases,readState,lockCampaign,unlockCampaign} from '../../src/lib/office/server/store';
import {videoConnection,imageConnection} from '../../src/lib/office/server/backend';
import {requestVideo,testVideoProvider,validateMP4,boundedVideoBody} from '../../src/lib/office/server/videos';
const mp4=readFileSync(new URL('../fixtures/concept.mp4',import.meta.url));
const settings={model:'Wan-AI/Wan2.2-T2V-A14B',aspectRatio:'9:16',apiKey:'hf_fake_video_secret'} as const;
const mapping={inferenceProviderMapping:{'fal-ai':{providerId:'fal-ai/wan/v2.2-a14b/text-to-video',status:'live',task:'text-to-video'}}};
let directory:string;
beforeEach(()=>{directory=mkdtempSync(path.join(tmpdir(),'office-videos-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const n of ['HF_VIDEO_TOKEN','HF_VIDEO_MODEL','HF_IMAGE_TOKEN','MARKETING_AI_KEY','OPENAI_API_KEY','MARKETING_IMAGE_KEY','DESIGN_OPENAI_KEY','CLAUDE_API_KEY','GEMINI_API_KEY','TIKTOK_ACCESS_TOKEN','META_GRAPH_TOKEN','OFFICE_ACCESS_TOKEN'])vi.stubEnv(n,'');});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
const save=()=>performAction({type:'saveVideoProvider',settings});
function mockProvider({queued=false,asset='https://v3.fal.media/video.mp4',invalid=false,unavailable=false,queueURL='https://queue.fal.run/fal-ai/wan/requests/job-1'}={}){
 return vi.fn(async(url:string)=>{
  if(url==='https://huggingface.co/api/whoami-v2')return Response.json({name:'test'});
  if(url.startsWith('https://huggingface.co/api/models/'))return Response.json(unavailable?{inferenceProviderMapping:{}}:mapping);
  if(url.includes('/status?'))return Response.json({status:'COMPLETED'});
  if(url.includes('/requests/job-1?'))return Response.json({video:{url:asset}});
  if(url===asset)return new Response(invalid?Buffer.from('not an MP4'):mp4,{headers:{'Content-Type':'video/mp4'}});
  return Response.json({request_id:'job-1',status:queued?'IN_QUEUE':'COMPLETED',response_url:queueURL});
 });
}
it('encrypts a separate video token, preserves blank updates, rejects non-HF keys, and clears environment fallback',async()=>{
 await save();expect(videoConnection().key).toBe(settings.apiKey);expect(imageConnection('huggingface').key).toBeFalsy();await performAction({type:'saveVideoProvider',settings:{...settings,apiKey:''}});expect(videoConnection().key).toBe(settings.apiKey);
 const serialized=JSON.stringify(getOffice())+JSON.stringify(exportCampaign('campaign-kadaka'))+readFileSync(path.join(directory,'backend.json'),'utf8');expect(serialized).not.toContain(settings.apiKey);
 vi.stubEnv('HF_VIDEO_TOKEN','hf_fake_env');await performAction({type:'saveVideoProvider',settings:{...settings,apiKey:undefined,clearKey:true}});expect(videoConnection().key).toBeUndefined();await expect(requestVideo('test')).rejects.toMatchObject({status:409});
 await expect(performAction({type:'saveVideoProvider',settings:{...settings,apiKey:'not-hf'}})).rejects.toThrow();await expect(performAction({type:'saveVideoProvider',settings:{...settings,model:'https://other.test'}})).rejects.toThrow();
 const lock=lockCampaign('campaign-kadaka');try{await expect(save()).rejects.toThrow();}finally{unlockCampaign('campaign-kadaka',lock);}
});
it('resolves native HF mapping, polls the HF router only, and downloads MP4 without sending a token',async()=>{
 await save();const fetcher=mockProvider({queued:true});vi.stubGlobal('fetch',fetcher);expect(await requestVideo('Short product concept')).toEqual(mp4);expect(validateMP4(mp4)).toMatchObject({width:32,height:32,durationSeconds:0.5});
 const calls=fetcher.mock.calls as unknown as [string,RequestInit][];const submission=calls.find(([,init])=>init.method==='POST')!;expect(submission[0]).toBe('https://router.huggingface.co/fal-ai/fal-ai/wan/v2.2-a14b/text-to-video?_subdomain=queue');expect(JSON.parse(submission[1].body as string)).toEqual({prompt:'Short product concept',aspect_ratio:'9:16',resolution:'720p'});
 expect(calls.some(([url])=>url==='https://router.huggingface.co/fal-ai/fal-ai/wan/requests/job-1/status?_subdomain=queue')).toBe(true);
 for(const [url,init]of calls){expect(init.redirect).toBe('error');expect(new Headers(init.headers).get('authorization')).toBe(url.startsWith('https://v3.fal.media/')?null:`Bearer ${settings.apiKey}`);}
});
it('rejects unavailable models, unsupported video hosts, malformed/truncated MP4, and secret-bearing errors',async()=>{
 await save();vi.stubGlobal('fetch',mockProvider({unavailable:true}));await expect(requestVideo('test')).rejects.toMatchObject({status:409});
 const fetcher=mockProvider({asset:'https://127.0.0.1/private'});vi.stubGlobal('fetch',fetcher);await expect(requestVideo('test')).rejects.toThrow('Host aset');expect(fetcher.mock.calls.some(([url])=>url==='https://127.0.0.1/private')).toBe(false);
 vi.stubGlobal('fetch',mockProvider({invalid:true}));await expect(requestVideo('test')).rejects.toThrow('MP4');expect(()=>validateMP4(mp4.subarray(0,mp4.length-50))).toThrow('MP4');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(settings.apiKey,{status:401})));try{await requestVideo('test');throw new Error('Expected failure');}catch(e){expect(String(e)).toContain('HTTP 401');expect(String(e)).not.toContain(settings.apiKey);}
});
it('saves generated video, invalidates downstream approval, preserves assets on failure, exports MP4, and removes stale video after edits',async()=>{
 await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});for(const a of readState().artifacts)await performAction({type:'approveArtifact',artifactId:a.id});const artifact=readState().artifacts.find(a=>a.type==='design')!;await save();vi.stubGlobal('fetch',mockProvider());await performAction({type:'generateVideo',artifactId:artifact.id});
 const updated=readState().artifacts.find(a=>a.id===artifact.id)!;expect(updated.videoUrl).toMatch(/^\/api\/office\/assets\/video-.*\.mp4$/);expect(updated.status).toBe('review');const pack=exportCampaign('campaign-kadaka');expect(pack.approved).toBe(false);expect(pack.assets[0]).toMatchObject({mimeType:'video/mp4',dataBase64:mp4.toString('base64')});
 vi.stubGlobal('fetch',mockProvider({invalid:true}));await expect(performAction({type:'generateVideo',artifactId:artifact.id})).rejects.toThrow('MP4');expect(readState().artifacts.find(a=>a.id===artifact.id)).toEqual(updated);
 await performAction({type:'editArtifact',artifactId:artifact.id,content:'New creative direction'});expect(readState().artifacts.find(a=>a.id===artifact.id)?.videoUrl).toBeUndefined();
});
it('serves only referenced private video assets, supports range requests, and protects checks from cross-site/auth failures',async()=>{
 await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});const artifact=readState().artifacts.find(a=>a.type==='design')!;await save();vi.stubGlobal('fetch',mockProvider());await performAction({type:'generateVideo',artifactId:artifact.id});const url=readState().artifacts.find(a=>a.id===artifact.id)!.videoUrl!;const name=path.basename(url);
 const {GET}=await import('../../src/app/api/office/assets/[name]/route');const context={params:Promise.resolve({name})};const request=(range?:string)=>new Request(`http://localhost${url}`,{headers:range?{Range:range}:undefined});
 const r=await GET(request('bytes=0-15'),context);expect(r.status).toBe(206);expect(r.headers.get('content-type')).toBe('video/mp4');expect(r.headers.get('content-range')).toBe(`bytes 0-15/${mp4.length}`);expect(Buffer.from(await r.arrayBuffer())).toEqual(mp4.subarray(0,16));expect((await GET(request('bytes=999999-'),context)).status).toBe(416);
 expect((await GET(request(),{params:Promise.resolve({name:'video-00000000-0000-0000-0000-000000000000.mp4'})})).status).toBe(404);
 const {POST}=await import('../../src/app/api/office/videos/test/route');expect((await POST(new Request('http://localhost/api/office/videos/test',{method:'POST',headers:{origin:'https://other.test'}}))).status).toBe(403);vi.stubEnv('OFFICE_ACCESS_TOKEN','fake-manager');expect((await GET(request(),context)).status).toBe(401);expect((await POST(new Request('http://localhost/api/office/videos/test',{method:'POST'}))).status).toBe(401);vi.stubEnv('OFFICE_ACCESS_TOKEN','');
 const before=readState().artifacts;vi.stubGlobal('fetch',mockProvider());expect(await testVideoProvider()).toMatchObject({ok:true,model:settings.model});expect(readState().artifacts).toEqual(before);
});

it('rejects untrusted/mismatched queue references and bounds streamed video responses before storage',async()=>{
 await save();const fetcher=mockProvider({queueURL:'https://other.test/fal-ai/wan/requests/job-1'});vi.stubGlobal('fetch',fetcher);await expect(requestVideo('test')).rejects.toThrow('Referensi job');expect(fetcher.mock.calls.some(([url])=>url.startsWith('https://other.test'))).toBe(false);
 vi.stubGlobal('fetch',mockProvider({queueURL:'https://queue.fal.run/fal-ai/wan/requests/different-job'}));await expect(requestVideo('test')).rejects.toThrow('tidak sesuai ID');
 await expect(boundedVideoBody(new Response('small',{headers:{'Content-Length':'67108865'}}))).rejects.toThrow('terlalu besar');await expect(boundedVideoBody(new Response('123456'),5)).rejects.toThrow('terlalu besar');
});
