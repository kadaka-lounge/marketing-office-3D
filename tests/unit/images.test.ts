import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {getOffice,performAction} from '../../src/lib/office/server/service';
import {closeDatabases,lockCampaign,unlockCampaign} from '../../src/lib/office/server/store';
import {imageConnection} from '../../src/lib/office/server/backend';
import {requestConfiguredImage,testImageProvider} from '../../src/lib/office/server/images';
import type {ImageProviderDraft} from '../../src/lib/office/types';
const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNQCv2vFPqfAUIBACWCBdkiTiprAAAAAElFTkSuQmCC';
let directory:string;
beforeEach(()=>{directory=mkdtempSync(path.join(tmpdir(),'office-images-'));vi.stubEnv('OFFICE_DATA_DIR',directory);for(const n of ['QWEN_IMAGE_KEY','QWEN_IMAGE_MODEL','QWEN_IMAGE_BASE_URL'])vi.stubEnv(n,'');for(const n of ['GOOGLE_IMAGEN_KEY','GOOGLE_IMAGEN_MODEL','HF_IMAGE_TOKEN','HF_IMAGE_MODEL','MARKETING_IMAGE_MODEL','MARKETING_IMAGE_KEY','MARKETING_AI_KEY','OPENAI_API_KEY','DESIGN_OPENAI_KEY','OFFICE_ACCESS_TOKEN'])vi.stubEnv(n,'');});
afterEach(()=>{closeDatabases();rmSync(directory,{recursive:true,force:true});vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
const save=(settings:ImageProviderDraft)=>performAction({type:'saveImageProvider',settings});
const imagen={provider:'imagen',model:'imagen-3.0-generate-002',aspectRatio:'4:5',apiKey:'fake-google-image-secret'} as const;
const hf={provider:'huggingface',model:'black-forest-labs/FLUX.1-schnell',aspectRatio:'9:16',apiKey:'hf_fake_image_secret'} as const;
it('encrypts separate image keys, preserves them across provider switches, and clears environment fallback',async()=>{
 await save(imagen);await save(hf);await save({...imagen,apiKey:''});
 expect(imageConnection().key).toBe(imagen.apiKey);expect(imageConnection('huggingface').key).toBe(hf.apiKey);
 const serialized=JSON.stringify(getOffice())+readFileSync(path.join(directory,'backend.json'),'utf8');expect(serialized).not.toContain(imagen.apiKey);expect(serialized).not.toContain(hf.apiKey);
 expect(getOffice().config).toMatchObject({imageProvider:'imagen',imageModel:imagen.model,imageConfigured:true});
 vi.stubEnv('GOOGLE_IMAGEN_KEY','fake-env-google');await save({...imagen,apiKey:undefined,clearKey:true});expect(imageConnection().key).toBeUndefined();expect(getOffice().config.imageConfigured).toBe(false);
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(requestConfiguredImage('test')).rejects.toMatchObject({status:409});expect(fetcher).not.toHaveBeenCalled();
});
it('uses the Google AI Studio predict endpoint and crops Imagen native ratio to the requested feed ratio',async()=>{
 await save(imagen);const fetcher=vi.fn().mockResolvedValue(Response.json({predictions:[{bytesBase64Encoded:png}]}));vi.stubGlobal('fetch',fetcher);
 const result=await requestConfiguredImage('Campaign visual');expect(await sharp(result).metadata()).toMatchObject({format:'png',width:768,height:960});
 const [url,init]=fetcher.mock.calls[0];expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${imagen.model}:predict`);expect(init.headers['x-goog-api-key']).toBe(imagen.apiKey);expect(init.headers.Authorization).toBeUndefined();expect(JSON.parse(init.body)).toEqual({instances:[{prompt:'Campaign visual'}],parameters:{sampleCount:1,aspectRatio:'3:4',outputOptions:{mimeType:'image/png'}}});
});
function hfFetch(output:()=>Response){return vi.fn(async(url:string)=>url.startsWith('https://huggingface.co/api/models/')?Response.json({inferenceProviderMapping:{'hf-inference':{providerId:hf.model,status:'live',task:'text-to-image'}}}):output());}
it('uses the official SDK HF router with a private token and accepts native JPEG binary results',async()=>{
 await save(hf);const jpeg=await sharp(Buffer.from(png,'base64')).jpeg().toBuffer();const fetcher=hfFetch(()=>new Response(jpeg,{headers:{'Content-Type':'image/jpeg'}}));vi.stubGlobal('fetch',fetcher);
 const result=await requestConfiguredImage('FLUX campaign');expect(await sharp(result).metadata()).toMatchObject({format:'png',width:576,height:1024});
 const call=fetcher.mock.calls.find(([url])=>url.startsWith('https://router.huggingface.co/'))!;expect(call[0]).toBe(`https://router.huggingface.co/hf-inference/models/${hf.model}`);
 const init=(call as unknown as [string,RequestInit])[1];expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${hf.apiKey}`);expect(JSON.parse(init.body as string)).toMatchObject({inputs:'FLUX campaign',parameters:{width:576,height:1024}});
});
it('downloads HF image assets without a token and rejects unsupported hosts before fetch',async()=>{
 await save(hf);let assetURL='https://v3.fal.media/files/test.png';
 const fetcher=vi.fn(async(url:string)=>url.startsWith('https://huggingface.co/api/models/')?Response.json({inferenceProviderMapping:{'hf-inference':{providerId:hf.model,status:'live',task:'text-to-image'}}}):url.startsWith('https://router.huggingface.co/')?Response.json({output:[assetURL]}):new Response(Buffer.from(png,'base64')));vi.stubGlobal('fetch',fetcher);
 await requestConfiguredImage('test');const assetCall=fetcher.mock.calls.find(([url])=>url===assetURL)!;expect(new Headers((assetCall as unknown as [string,RequestInit])[1].headers).has('authorization')).toBe(false);
 assetURL='https://127.0.0.1/private';await expect(requestConfiguredImage('test')).rejects.toThrow('Host aset');expect(fetcher.mock.calls.some(([url])=>url===assetURL)).toBe(false);
});
it('rejects malformed images, sanitized provider errors, unsafe models, and settings changes during work',async()=>{
 await save(imagen);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({predictions:[{bytesBase64Encoded:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')}]})));await expect(requestConfiguredImage('test')).rejects.toThrow('PNG/JPEG/WebP');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(imagen.apiKey,{status:404})));try{await requestConfiguredImage('test');throw new Error('Expected failure');}catch(error){expect(String(error)).toContain('HTTP 404');expect(String(error)).not.toContain(imagen.apiKey);}
 await expect(save({...hf,model:'https://other.test/model'})).rejects.toThrow();await expect(save({...hf,apiKey:'other-provider-key'})).rejects.toThrow();await expect(save({...imagen,model:'imagen-3/../../private'})).rejects.toThrow();
 const lock=lockCampaign('campaign-kadaka');try{await expect(save(hf)).rejects.toThrow();}finally{unlockCampaign('campaign-kadaka',lock);}
});
it('protects the test route and validates a test image without adding campaign artifacts',async()=>{
 const {POST}=await import('../../src/app/api/office/images/test/route');const fetcher=vi.fn().mockResolvedValue(Response.json({predictions:[{bytesBase64Encoded:png}]}));vi.stubGlobal('fetch',fetcher);
 expect((await POST(new Request('http://localhost/api/office/images/test',{method:'POST',headers:{origin:'https://other.test'}}))).status).toBe(403);
 vi.stubEnv('OFFICE_ACCESS_TOKEN','fake-manager');expect((await POST(new Request('http://localhost/api/office/images/test',{method:'POST'}))).status).toBe(401);expect(fetcher).not.toHaveBeenCalled();vi.stubEnv('OFFICE_ACCESS_TOKEN','');
 await save(imagen);const before=getOffice().state.artifacts;expect(await testImageProvider()).toMatchObject({ok:true,provider:'imagen',width:768,height:960});expect(getOffice().state.artifacts).toEqual(before);
});

it('generates Qwen images through a real loopback OpenAI-compatible server without forwarding cloud keys',async()=>{
 await performAction({type:'saveProvider',provider:'openai',settings:{model:'gpt-4.1-mini',enabled:true,apiKey:'fake-cloud-key'}});
 let received:{path?:string;authorization?:string;body?:Record<string,unknown>}={};
 const server=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);received={path:req.url,authorization:req.headers.authorization,body:JSON.parse(Buffer.concat(chunks).toString())};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{b64_json:png}]}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const baseUrl=`http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/images/generations`;await save({provider:'qwen',model:'Qwen-Image-2.1-Uncensored-GGUF',aspectRatio:'4:5',baseUrl});expect(imageConnection().baseUrl).toBe(baseUrl.replace('/images/generations',''));expect(getOffice().config.imageConfigured).toBe(true);const result=await requestConfiguredImage('Qwen concept');expect(await sharp(result).metadata()).toMatchObject({format:'png',width:768,height:960});expect(received).toMatchObject({path:'/v1/images/generations',body:{model:'Qwen-Image-2.1-Uncensored-GGUF',prompt:'Qwen concept',n:1,size:'768x960',response_format:'b64_json',output_format:'png'}});expect(received.authorization).toBeUndefined();}
 finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
it('scopes Qwen keys to their image endpoint and rejects unsafe or irrelevant endpoints',async()=>{
 const draft={provider:'qwen',model:'Qwen-Image-2.1-Uncensored-GGUF',aspectRatio:'1:1',baseUrl:'https://image.example.test/v1',apiKey:'fake-qwen-key'} as const;await save(draft);await save({...draft,apiKey:''});expect(imageConnection().key).toBe(draft.apiKey);
 await save({...draft,baseUrl:'https://other.example.test/v1',apiKey:undefined});expect(imageConnection().key).toBeUndefined();expect(getOffice().config.imageConfigured).toBe(false);
 for(const baseUrl of ['http://192.168.1.2:1234/v1','https://user:secret@example.test/v1','https://example.test/v1?api_key=secret','file:///tmp/model'])await expect(save({...draft,baseUrl})).rejects.toThrow();
 await expect(save({...imagen,baseUrl:'https://other.test/v1'})).rejects.toThrow();vi.stubEnv('QWEN_IMAGE_KEY','fake-env-qwen');await save({...draft,apiKey:undefined,clearKey:true});expect(imageConnection().key).toBeUndefined();
 expect(JSON.stringify(getOffice())+readFileSync(path.join(directory,'backend.json'),'utf8')).not.toContain(draft.apiKey);
});
it('rejects credential-bearing environment image endpoints without exposing the secret in config errors',()=>{
 vi.stubEnv('QWEN_IMAGE_BASE_URL','https://user:fake-url-secret@image.example.test/v1');
 try{getOffice();throw new Error('Expected invalid endpoint');}catch(error){expect(String(error)).toContain('Endpoint Qwen tidak valid');expect(String(error)).not.toContain('fake-url-secret');}
});
