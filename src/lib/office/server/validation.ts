import { z } from 'zod';
import {parseComfyWorkflow,validateComfyBindings} from '../comfy-workflow';
import {isLocalEndpoint,normalizeImageBaseUrl,normalizeComfyBaseUrl} from '../endpoints';

const id = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const channel = z.enum(['general', 'manager', 'marketing', 'design', 'analytics', 'publisher']);
const social = z.enum(['Instagram', 'TikTok', 'LinkedIn', 'Website / Blog']);
const mode = z.enum(['demo', 'live']);
const brief = z.object({ name: text(160), product: text(2000), audience: text(2000), objective: text(2000), channels: z.array(social).min(1).max(4).refine(v => new Set(v).size === v.length, 'Kanal tidak boleh duplikat.'), budget: z.string().trim().max(160).default(''), deadline: z.string().trim().max(100).default('') }).strict();
export const backendSchema = z.object({ baseUrl: z.string().trim().url().max(1000).refine(value => { try { const u = new URL(value); return (u.protocol === 'https:' || isLocalEndpoint(value)) && !u.username && !u.password && !u.search && !u.hash; } catch { return false; } }, 'Gunakan HTTPS, atau HTTP localhost/127.0.0.1/[::1] untuk LLM lokal, tanpa kredensial, query, atau fragment.'), model: text(160), apiKey: z.string().trim().max(4096).refine(value => !/[\r\n]/.test(value), 'API key tidak valid.').optional(), clearKey: z.boolean().optional() }).strict();
const agentDraft = z.object({ name: text(60), role: text(160), division: z.enum(['marketing','design','analytics','publisher']), avatarIndex: z.number().int().min(1).max(8), instructions: z.string().trim().max(4000), skills: z.array(z.object({ name: text(80), instructions: text(2000) }).strict()).min(1).max(6).refine(v => new Set(v.map(s => s.name.toLowerCase())).size === v.length, 'Nama skill tidak boleh duplikat.') }).strict();
const credential = { enabled:z.boolean(), apiKey:z.string().trim().max(4096).refine(v=>!/[\r\n]/.test(v),'Kunci tidak valid.').optional(), clearKey:z.boolean().optional() };
const providerSettings = z.object({...credential,model:text(160).regex(/^[a-zA-Z0-9._:-]+$/,'Gunakan ID model provider tanpa slash atau spasi.')}).strict();
const comfySettings=z.object({workflow:z.string().max(60000).optional(),promptNodeId:z.string().max(100),promptInput:z.string().regex(/^[a-zA-Z0-9_]{1,80}$/),outputNodeId:z.string().max(100),clearWorkflow:z.boolean().optional()}).strict().superRefine((v,ctx)=>{if(v.workflow?.trim()&&!v.clearWorkflow){try{validateComfyBindings(parseComfyWorkflow(v.workflow),v.promptNodeId,v.promptInput,v.outputNodeId);}catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Workflow tidak valid.'});}}});
const imageSettings=z.object({provider:z.enum(['openai','imagen','huggingface','qwen','comfyui']),model:text(160),aspectRatio:z.enum(['1:1','4:5','9:16','16:9']),baseUrl:z.string().trim().max(1000).optional(),comfy:comfySettings.optional(),apiKey:credential.apiKey,clearKey:credential.clearKey}).strict().superRefine((v,ctx)=>{
 const valid=['qwen','comfyui'].includes(v.provider)?/^[a-zA-Z0-9._/:-]+$/.test(v.model):v.provider==='huggingface'?['black-forest-labs/FLUX.1-schnell','black-forest-labs/FLUX.1-dev'].includes(v.model):v.provider==='imagen'?/^imagen-[a-zA-Z0-9._-]+$/.test(v.model):/^[a-zA-Z0-9._-]+$/.test(v.model);
 if(!valid)ctx.addIssue({code:'custom',path:['model'],message:'Gunakan ID model yang sesuai provider; FLUX.1 mendukung varian schnell atau dev.'});
 if(v.baseUrl!==undefined){let valid=false;try{const u=new URL(v.provider==='comfyui'?normalizeComfyBaseUrl(v.baseUrl):normalizeImageBaseUrl(v.baseUrl));valid=['qwen','comfyui'].includes(v.provider)&&(u.protocol==='https:'||isLocalEndpoint(u.href))&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{}if(!valid)ctx.addIssue({code:'custom',path:['baseUrl'],message:'Endpoint Qwen harus HTTPS atau HTTP loopback, tanpa kredensial, query, atau fragment.'});}
 if(v.comfy&&v.provider!=='comfyui')ctx.addIssue({code:'custom',path:['comfy'],message:'Workflow hanya untuk ComfyUI.'});
 if(v.provider==='huggingface'&&v.apiKey&&!v.apiKey.startsWith('hf_'))ctx.addIssue({code:'custom',path:['apiKey'],message:'Gunakan token Hugging Face yang diawali hf_.'});
});
const videoSettings=z.object({provider:z.enum(['huggingface','comfyui']).optional(),model:text(160),aspectRatio:z.enum(['16:9','9:16','1:1']),baseUrl:z.string().trim().max(1000).optional(),comfy:comfySettings.optional(),apiKey:credential.apiKey,clearKey:credential.clearKey}).strict().superRefine((v,ctx)=>{
 if(v.provider==='comfyui'){if(!/^[a-zA-Z0-9._/:-]+$/.test(v.model))ctx.addIssue({code:'custom',path:['model'],message:'Nama model video tidak valid.'});if(v.baseUrl){let valid=false;try{const u=new URL(normalizeComfyBaseUrl(v.baseUrl));valid=(u.protocol==='https:'||isLocalEndpoint(u.href))&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{}if(!valid)ctx.addIssue({code:'custom',path:['baseUrl'],message:'Endpoint ComfyUI harus HTTPS atau HTTP loopback tanpa kredensial, query, atau fragment.'});}}
 else{if(!['Wan-AI/Wan2.2-T2V-A14B','Wan-AI/Wan2.1-T2V-14B'].includes(v.model))ctx.addIssue({code:'custom',path:['model'],message:'Pilih preset Wan.'});if(v.baseUrl||v.comfy)ctx.addIssue({code:'custom',message:'Endpoint dan workflow hanya untuk ComfyUI.'});if(v.apiKey&&!v.apiKey.startsWith('hf_'))ctx.addIssue({code:'custom',path:['apiKey'],message:'Gunakan token hf_.'});}
});
export const actionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('saveVideoProvider'),settings:videoSettings}).strict(),
  z.object({type:z.literal('generateVideo'),artifactId:id}).strict(),
  z.object({type:z.literal('saveImageProvider'),settings:imageSettings}).strict(),
  z.object({type:z.literal('saveProvider'),provider:z.enum(['claude','gemini','openai']),settings:providerSettings}).strict(),
  z.object({type:z.literal('saveTikTok'),settings:z.object(credential).strict()}).strict(),
  z.object({type:z.literal('checkTikTok'),publicationId:id}).strict(),
  z.object({type:z.literal('publishTikTok'),publicationId:id,videoUrl:z.string().url().max(2000).refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}},'Gunakan URL video HTTPS tanpa kredensial atau fragment.'),title:text(2200),privacyLevel:z.enum(['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY']),consent:z.literal(true),disableComment:z.boolean(),disableDuet:z.boolean(),disableStitch:z.boolean(),brandOrganic:z.boolean(),brandContent:z.boolean()}).strict(),
  z.object({type:z.literal('saveMeta'),settings:z.object(credential).strict()}).strict(),
  z.object({ type: z.literal('saveBackend'), backend: backendSchema }).strict(),
  z.object({ type: z.literal('addAgent'), agent: agentDraft, campaignId: id.optional() }).strict(),
  z.object({ type: z.literal('updateAgent'), agentId: id, agent: agentDraft }).strict(),
  z.object({ type: z.literal('createCampaign'), brief }).strict(),
  z.object({ type: z.literal('sendMessage'), content: text(8000), channel, campaignId: id.optional(), assignTo: id.optional() }).strict(),
  z.object({ type: z.literal('runCampaign'), campaignId: id, mode }).strict(),
  z.object({ type: z.literal('runTask'), taskId: id, mode }).strict(),
  z.object({ type: z.literal('approveArtifact'), artifactId: id }).strict(),
  z.object({ type: z.literal('requestRevision'), artifactId: id, feedback: text(8000) }).strict(),
  z.object({ type: z.literal('editArtifact'), artifactId: id, content: text(50000) }).strict(),
  z.object({ type: z.literal('schedule'), campaignId: id, scheduledAt: z.iso.datetime({ offset: true }), channels: z.array(social).min(1).max(4).refine(v => new Set(v).size === v.length, 'Kanal tidak boleh duplikat.') }).strict(),
  z.object({ type: z.literal('publish'), publicationId: id }).strict(),
  z.object({ type: z.literal('importMetrics'), campaignId: id, metrics: z.array(z.object({ channel: social, impressions: z.number().int().min(0).max(1e12), clicks: z.number().int().min(0).max(1e12), conversions: z.number().int().min(0).max(1e12), spend: z.number().min(0).max(1e12) }).strict().refine(v => v.clicks <= v.impressions && v.conversions <= v.clicks, 'Konversi ≤ klik ≤ impresi diperlukan.')).min(1).max(100) }).strict(),
  z.object({ type: z.literal('generateImage'), artifactId: id }).strict(),
]);
export class OfficeError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'OfficeError'; }
}
export function parseAction(value: unknown) {
  const result = actionSchema.safeParse(value);
  if (!result.success) throw new OfficeError(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 1800));
  return result.data;
}
