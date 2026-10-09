import { z } from 'zod';

const id = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const channel = z.enum(['general', 'manager', 'marketing', 'design', 'analytics', 'publisher']);
const social = z.enum(['Instagram', 'TikTok', 'LinkedIn', 'Website / Blog']);
const mode = z.enum(['demo', 'live']);
const brief = z.object({ name: text(160), product: text(2000), audience: text(2000), objective: text(2000), channels: z.array(social).min(1).max(4).refine(v => new Set(v).size === v.length, 'Kanal tidak boleh duplikat.'), budget: z.string().trim().max(160).default(''), deadline: z.string().trim().max(100).default('') }).strict();
export const actionSchema = z.discriminatedUnion('type', [
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
