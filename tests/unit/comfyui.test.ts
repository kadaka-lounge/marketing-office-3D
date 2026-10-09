import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {performAction,getOffice,exportCampaign} from '../../src/lib/office/server/service';
import {closeDatabases,readState} from '../../src/lib/office/server/store';
import {imageConnection,videoConnection} from '../../src/lib/office/server/backend';
import {requestConfiguredImage} from '../../src/lib/office/server/images';
import {requestVideo,testVideoProvider,stripVideoMetadata,validateMP4} from '../../src/lib/office/server/videos';
import {checkComfyConnection} from '../../src/lib/office/server/comfyui';
import {parseComfyWorkflow} from '../../src/lib/office/comfy-workflow';
const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNQCv2vFPqfAUIBACWCBdkiTiprAAAAAElFTkSuQmCC';
const mp4=readFileSync(new URL('../fixtures/concept.mp4',import.meta.url));
const graph={'1':{class_type:'Loader',inputs:{model:'installed-model'}},'6:2':{class_type:'TextEncoder',inputs:{prompt:'Original private prompt'}},'9':{class_type:'SaveMedia',inputs:{filename_prefix:'office'}}};
const comfy={workflow:JSON.stringify(graph),promptNodeId:'6:2',promptInput:'prompt',outputNodeId:'9'};
const objects={Loader:{input:{required:{model:[['installed-model']]}},output_node:false},TextEncoder:{input:{required:{prompt:['STRING']}},output_node:false},SaveMedia:{input:{},output_node:true}};
let directory:string;
beforeEach(()=>{directory=mkdtempSync(path.join(tmpdir(),'office-comfy-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const n of ['COMFY_IMAGE_KEY','COMFY_IMAGE_BASE_URL','COMFY_IMAGE_MODEL','COMFY_VIDEO_KEY','COMFY_VIDEO_BASE_URL','COMFY_VIDEO_MODEL','HF_VIDEO_TOKEN','QWEN_IMAGE_BASE_URL','MARKETING_IMAGE_KEY','MARKETING_AI_KEY','OPENAI_API_KEY','CLAUDE_API_KEY','GEMINI_API_KEY','DESIGN_OPENAI_KEY'])vi.stubEnv(n,'');});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
const image={provider:'comfyui',model:'Qwen-Image-2.1-Uncensored-GGUF',aspectRatio:'1:1',baseUrl:'http://127.0.0.1:8188',comfy} as const;
const video={provider:'comfyui',model:'ltx25_uncensored_v1.1-fp8',aspectRatio:'9:16',baseUrl:'http://127.0.0.1:8188',comfy} as const;
function mock({kind='image',failed=false,filename=kind==='image'?'concept.png':'concept.mp4',type='output',poll=false}:{kind?:'image'|'video';failed?:boolean;filename?:string;type?:string;poll?:boolean}={}){let historyCalls=0;return vi.fn(async(url:string)=>{if(url.endsWith('/object_info'))return Response.json(objects);if(url.endsWith('/system_stats'))return Response.json({system:{}});if(url.endsWith('/prompt'))return Response.json({prompt_id:'job-1',node_errors:{}});if(url.includes('/history/')){historyCalls++;return Response.json(poll&&historyCalls===1?{}:{'job-1':{status:{completed:true,status_str:failed?'error':'success'},outputs:{'9':{[kind==='video'?'gifs':'images']:[{filename,subfolder:'office',type}]}}}});}if(url.includes('/view?'))return new Response(kind==='video'?mp4:Buffer.from(png,'base64'));throw new Error('Unexpected request');});}
it('keeps HF settings and Qwen adapter independent and encrypts workflows without returning prompts or keys',async()=>{
 await performAction({type:'saveVideoProvider',settings:{model:'Wan-AI/Wan2.2-T2V-A14B',aspectRatio:'16:9',apiKey:'hf_private_video'}});await performAction({type:'saveImageProvider',settings:{...image,apiKey:'private-image-key'}});await performAction({type:'saveVideoProvider',settings:video});expect(videoConnection('huggingface').key).toBe('hf_private_video');expect(videoConnection().provider).toBe('comfyui');expect(imageConnection('comfyui').comfy.workflow).toBe(comfy.workflow);expect(getOffice().config).toMatchObject({imageConfigured:true,video:{configured:true}});
 const serialized=JSON.stringify(getOffice())+JSON.stringify(exportCampaign('campaign-kadaka'))+readFileSync(path.join(directory,'backend.json'),'utf8');for(const value of ['Original private prompt','private-image-key','hf_private_video'])expect(serialized).not.toContain(value);
 await performAction({type:'saveImageProvider',settings:{...image,comfy:{...comfy,workflow:''},apiKey:''}});expect(imageConnection('comfyui').comfy.workflow).toBe(comfy.workflow);expect(imageConnection('comfyui').key).toBe('private-image-key');
 await performAction({type:'saveImageProvider',settings:{...image,baseUrl:'http://127.0.0.1:8288',comfy:{...comfy,workflow:''}}});expect(imageConnection('comfyui').key).toBeUndefined();expect(imageConnection('comfyui').comfy.workflow).toBeUndefined();
});
it('binds the brief into a cloned API graph, polls history, and fetches only saved job output from the same server',async()=>{
 await performAction({type:'saveImageProvider',settings:image});const fetcher=mock({poll:true});vi.stubGlobal('fetch',fetcher);const bytes=await requestConfiguredImage('Manager brief');expect(bytes.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));const calls=fetcher.mock.calls as unknown as [string,RequestInit][];const submit=calls.find(([url])=>url.endsWith('/prompt'))!;expect(JSON.parse(submit[1].body as string).prompt['6:2'].inputs.prompt).toBe('Manager brief');expect(JSON.parse(imageConnection('comfyui').comfy.workflow!)['6:2'].inputs.prompt).toBe('Original private prompt');expect(calls.some(([url])=>url==='http://127.0.0.1:8188/view?filename=concept.png&subfolder=office&type=output')).toBe(true);expect(calls.every(([url,init])=>url.startsWith(image.baseUrl)&&new Headers(init.headers).get('authorization')===null&&init.redirect==='error')).toBe(true);
});
it('creates and validates LTX MP4, exports it, and restores prior assets after a failed Comfy workflow',async()=>{
 await performAction({type:'saveVideoProvider',settings:video});await performAction({type:'runCampaign',campaignId:'campaign-kadaka',mode:'demo'});for(const a of readState().artifacts)await performAction({type:'approveArtifact',artifactId:a.id});const design=readState().artifacts.find(a=>a.type==='design')!;vi.stubGlobal('fetch',mock({kind:'video'}));expect(await requestVideo('Video concept')).toEqual(stripVideoMetadata(mp4));await performAction({type:'generateVideo',artifactId:design.id});const updated=readState().artifacts.find(a=>a.id===design.id)!;expect(updated.videoUrl).toMatch(/\.mp4$/);expect(updated.status).toBe('review');expect(exportCampaign('campaign-kadaka')).toMatchObject({approved:false,assets:[{mimeType:'video/mp4'}]});vi.stubGlobal('fetch',mock({kind:'video',failed:true}));await expect(performAction({type:'generateVideo',artifactId:design.id})).rejects.toThrow('Workflow ComfyUI gagal');expect(readState().artifacts.find(a=>a.id===design.id)).toEqual(updated);
});
it('rejects canvas JSON, missing bindings/nodes/files, unsupported output and path traversal before download',async()=>{
 expect(()=>parseComfyWorkflow('{"nodes":[]}')).toThrow('format API');await expect(performAction({type:'saveImageProvider',settings:{...image,comfy:{...comfy,promptNodeId:'missing'}}})).rejects.toThrow('Node prompt');await performAction({type:'saveImageProvider',settings:image});
 const missing=vi.fn().mockResolvedValue(Response.json({}));vi.stubGlobal('fetch',missing);await expect(requestConfiguredImage('test')).rejects.toThrow('belum terpasang');expect(missing).toHaveBeenCalledTimes(1);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...objects,Loader:{input:{required:{model:[['other-file']]}}}})));await expect(requestConfiguredImage('test')).rejects.toThrow('belum tersedia');
 for(const filename of ['../private.png','concept.mp4']){const fetcher=mock({filename});vi.stubGlobal('fetch',fetcher);await expect(requestConfiguredImage('test')).rejects.toThrow('Node hasil');expect(fetcher.mock.calls.some(([url])=>url.includes('/view?'))).toBe(false);}
 await expect(performAction({type:'saveVideoProvider',settings:{...video,baseUrl:'http://192.168.1.2:8188'}})).rejects.toThrow();
});
it('checks video nodes without generating a job, clears workflow, and sanitizes native server errors',async()=>{
 await performAction({type:'saveVideoProvider',settings:video});const fetcher=mock();vi.stubGlobal('fetch',fetcher);expect(await testVideoProvider()).toMatchObject({ok:true,provider:'comfyui',model:video.model});expect(fetcher.mock.calls.some(([url])=>url.endsWith('/prompt'))).toBe(false);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private-server-error',{status:401})));try{await checkComfyConnection(videoConnection());throw new Error('Expected failure');}catch(error){expect(String(error)).toContain('HTTP 401');expect(String(error)).not.toContain('private-server-error');}
 await performAction({type:'saveVideoProvider',settings:{...video,comfy:{...comfy,workflow:'',clearWorkflow:true}}});expect(getOffice().config.video.configured).toBe(false);await expect(requestVideo('test')).rejects.toThrow('workflow API');
});

it('strips MP4 user metadata without changing sample offsets or revealing embedded workflow credentials',()=>{
 const secret=Buffer.from('private-embedded-workflow-token');const box=Buffer.alloc(secret.length+8);box.writeUInt32BE(box.length);box.write('udta',4,'ascii');secret.copy(box,8);const input=Buffer.concat([mp4,box]);const clean=stripVideoMetadata(input);expect(clean.length).toBe(input.length);const mediaOffset=mp4.indexOf('mdat')-4;const mediaSize=mp4.readUInt32BE(mediaOffset);expect(clean.subarray(mediaOffset,mediaOffset+mediaSize)).toEqual(mp4.subarray(mediaOffset,mediaOffset+mediaSize));expect(validateMP4(clean)).toMatchObject({width:32,height:32,durationSeconds:0.5});expect(clean.toString()).not.toContain(secret.toString());expect(clean.toString('ascii',mp4.length+4,mp4.length+8)).toBe('free');
});
