import { z } from 'zod';
import {isLocalEndpoint} from '../endpoints';

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
export const actionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('saveProvider'),provider:z.enum(['claude','gemini','openai']),settings:providerSettings}).strict(),
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
