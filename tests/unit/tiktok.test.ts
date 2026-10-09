import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getOffice,performAction,exportCampaign} from '../../src/lib/office/server/service';
import {closeDatabases,mutate,readState} from '../../src/lib/office/server/store';
import {tiktokConnection,providerConnection} from '../../src/lib/office/server/backend';
import {tiktokCreator} from '../../src/lib/office/server/tiktok';
let directory:string;
const creator={creator_username:'publisher-test',creator_nickname:'Publisher Test',privacy_level_options:['SELF_ONLY','PUBLIC_TO_EVERYONE'],comment_disabled:true,duet_disabled:false,stitch_disabled:true,max_video_post_duration_sec:300};
const post={type:'publishTikTok',publicationId:'test-tiktok-publication',videoUrl:'https://verified.example/video.mp4',title:'Caption approved by manager',privacyLevel:'SELF_ONLY',consent:true,disableComment:false,disableDuet:true,disableStitch:false,brandOrganic:true,brandContent:false};
beforeEach(()=>{directory=mkdtempSync(path.join(tmpdir(),'office-tiktok-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const k of ['TIKTOK_ACCESS_TOKEN','CLAUDE_API_KEY','GEMINI_API_KEY','DESIGN_OPENAI_KEY','META_GRAPH_TOKEN','MARKETING_AI_KEY','OPENAI_API_KEY','MARKETING_IMAGE_KEY','MARKETING_AI_BASE_URL','OFFICE_ACCESS_TOKEN'])vi.stubEnv(k,'');});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function configure(){await performAction({type:'saveTikTok',settings:{enabled:true,apiKey:'fake-tiktok-secret'}});}
async function ready(){await configure();await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});for(const a of readState().artifacts)await performAction({type:'approveArtifact',artifactId:a.id});mutate(s=>s.publications.push({id:post.publicationId,campaignId:'campaign-kadaka',channel:'TikTok',scheduledAt:new Date(Date.now()-1000).toISOString(),status:'scheduled'}));}
function stub(){const fetcher=vi.fn().mockImplementation((url:string)=>Promise.resolve(Response.json({error:{code:'ok'},data:url.includes('creator_info')?creator:url.includes('video/init')?{publish_id:'test-publish-id'}:{status:'PUBLISH_COMPLETE'}})));vi.stubGlobal('fetch',fetcher);return fetcher;}
it('encrypts and isolates TikTok token; preserves other providers and never exports credentials',async()=>{
 await performAction({type:'saveProvider',provider:'claude',settings:{enabled:true,model:'test',apiKey:'fake-claude'}});await configure();
 await performAction({type:'saveBackend',backend:{baseUrl:'http://localhost:11434/v1',model:'qwen2.5:3b'}});
 expect(providerConnection('claude').key).toBe('fake-claude');expect(tiktokConnection().key).toBe('fake-tiktok-secret');
 expect(readFileSync(path.join(directory,'backend.json'),'utf8')+JSON.stringify(getOffice())+JSON.stringify(exportCampaign('campaign-kadaka'))).not.toContain('fake-tiktok-secret');
 await performAction({type:'saveTikTok',settings:{enabled:true}});expect(tiktokConnection().key).toBe('fake-tiktok-secret');
 vi.stubEnv('TIKTOK_ACCESS_TOKEN','fake-env');await performAction({type:'saveTikTok',settings:{enabled:true,clearKey:true}});expect(tiktokConnection().key).toBeUndefined();
});
it('token test queries creator with bearer authentication only and sends no video',async()=>{
 await configure();const fetcher=stub();expect(await tiktokCreator()).toEqual(creator);
 expect(fetcher).toHaveBeenCalledTimes(1);const [url,init]=fetcher.mock.calls[0];expect(url).toBe('https://open.tiktokapis.com/v2/post/publish/creator_info/query/');expect(init.headers.Authorization).toBe('Bearer fake-tiktok-secret');expect(JSON.parse(init.body)).toEqual({});expect(readState().publications).toHaveLength(0);
});
it('blocks unapproved, future, wrong channel, missing consent, and unavailable privacy before sending video',async()=>{
 await configure();const fetcher=stub();mutate(s=>s.publications.push({id:post.publicationId,campaignId:'campaign-kadaka',channel:'TikTok',scheduledAt:new Date().toISOString(),status:'scheduled'}));
 await expect(performAction(post)).rejects.toThrow('disetujui');expect(fetcher).not.toHaveBeenCalled();
 await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});for(const a of readState().artifacts)await performAction({type:'approveArtifact',artifactId:a.id});
 mutate(s=>{s.publications[0].scheduledAt=new Date(Date.now()+86400000).toISOString();});await expect(performAction(post)).rejects.toThrow('jadwal');
 mutate(s=>{s.publications[0].scheduledAt=new Date(Date.now()-1000).toISOString();});await expect(performAction({...post,consent:false})).rejects.toThrow();
 await expect(performAction({...post,privacyLevel:'FOLLOWER_OF_CREATOR'})).rejects.toThrow('privasi');expect(fetcher.mock.calls.every(c=>String(c[0]).includes('creator_info'))).toBe(true);
 mutate(s=>{s.publications[0].channel='Instagram';});await expect(performAction(post)).rejects.toThrow('jadwal TikTok');
});
it('records accepted video as processing, enforces creator restrictions, and marks published only after status confirmation',async()=>{
 await ready();const fetcher=stub();await performAction(post);
 expect(readState().publications[0]).toMatchObject({status:'processing',tiktok:{publishId:'test-publish-id'}});
 const [url,init]=fetcher.mock.calls[1];expect(url).toBe('https://open.tiktokapis.com/v2/post/publish/video/init/');expect(init.headers.Authorization).toBe('Bearer fake-tiktok-secret');
 expect(JSON.parse(init.body)).toEqual({post_info:{title:post.title,privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_organic_toggle:true,brand_content_toggle:false},source_info:{source:'PULL_FROM_URL',video_url:post.videoUrl}});
 await expect(performAction(post)).rejects.toThrow('Pengiriman');await expect(performAction({type:'publish',publicationId:post.publicationId})).rejects.toThrow('TikTok');expect(fetcher).toHaveBeenCalledTimes(2);
 await performAction({type:'checkTikTok',publicationId:post.publicationId});expect(readState().publications[0].status).toBe('published');expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({publish_id:'test-publish-id'});
 await performAction({type:'checkTikTok',publicationId:post.publicationId});expect(fetcher).toHaveBeenCalledTimes(3);
});
it('retains uncertain attempts after network loss and revisions to prevent duplicate posts',async()=>{
 await ready();const fetcher=stub();fetcher.mockImplementation((url:string)=>url.includes('creator_info')?Promise.resolve(Response.json({error:{code:'ok'},data:creator})):Promise.reject(new Error('fake-tiktok-secret')));
 await expect(performAction(post)).rejects.toThrow('terputus');expect(readState().publications[0]).toMatchObject({status:'processing',tiktok:{attemptedAt:expect.any(String)}});
 await expect(performAction(post)).rejects.toThrow('Pengiriman');await expect(performAction({type:'checkTikTok',publicationId:post.publicationId})).rejects.toThrow('ID TikTok');expect(fetcher).toHaveBeenCalledTimes(2);
 await performAction({type:'requestRevision',artifactId:readState().artifacts[0].id,feedback:'Update data'});expect(readState().publications[0].tiktok).toBeDefined();expect(JSON.stringify(getOffice())).not.toContain('fake-tiktok-secret');
});
it('allows retry after a definite rejection and keeps status failures from pretending publication succeeded',async()=>{
 await ready();const fetcher=stub();fetcher.mockImplementation((url:string)=>Promise.resolve(url.includes('creator_info')?Response.json({error:{code:'ok'},data:creator}):new Response('fake-tiktok-secret',{status:401})));
 await expect(performAction(post)).rejects.toThrow('HTTP 401');expect(readState().publications[0]).toMatchObject({status:'failed'});expect(readState().publications[0].tiktok).toBeUndefined();
 fetcher.mockImplementation((url:string)=>Promise.resolve(Response.json({error:{code:'ok'},data:url.includes('creator_info')?creator:url.includes('video/init')?{publish_id:'id'}:{status:'FAILED'}})));
 await performAction(post);await performAction({type:'checkTikTok',publicationId:post.publicationId});expect(readState().publications[0].status).toBe('failed');expect(readState().publications[0].tiktok?.publishId).toBe('id');
});
