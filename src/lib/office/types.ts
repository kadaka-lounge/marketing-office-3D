export type DivisionId = 'manager' | 'marketing' | 'design' | 'analytics' | 'publisher';
export type AgentStatus = 'idle' | 'working' | 'review' | 'error';
export interface AgentSkill { name: string; instructions: string; }
export interface AgentDraft { name: string; role: string; division: Exclude<DivisionId, 'manager'>; avatarIndex: number; instructions: string; skills: AgentSkill[]; }
export type ImageProviderId='openai'|'imagen'|'huggingface'|'qwen'|'comfyui';
export type ImageAspectRatio='1:1'|'4:5'|'9:16'|'16:9';
export interface ComfyDraft {workflow?:string;promptNodeId:string;promptInput:string;outputNodeId:string;clearWorkflow?:boolean;}
export interface ComfyStatus {workflowConfigured:boolean;promptNodeId:string;promptInput:string;outputNodeId:string;}
export interface ImageProviderDraft {provider:ImageProviderId;model:string;aspectRatio:ImageAspectRatio;baseUrl?:string;comfy?:ComfyDraft;apiKey?:string;clearKey?:boolean;}
export interface ImageProviderStatus {provider:ImageProviderId;model:string;aspectRatio:ImageAspectRatio;baseUrl?:string;local?:boolean;comfy?:ComfyStatus;configured:boolean;keySource:'stored'|'environment'|'none'|'shared';}
export type VideoAspectRatio='16:9'|'9:16'|'1:1';
export interface VideoProviderDraft {provider?:'huggingface'|'comfyui';baseUrl?:string;comfy?:ComfyDraft;model:string;aspectRatio:VideoAspectRatio;apiKey?:string;clearKey?:boolean;}
export interface VideoProviderStatus {provider:'huggingface'|'comfyui';baseUrl?:string;local?:boolean;comfy?:ComfyStatus;model:string;aspectRatio:VideoAspectRatio;configured:boolean;keySource:'stored'|'environment'|'none';}
export type ProviderId = 'claude' | 'gemini' | 'openai';
export interface ProviderDraft { model:string; enabled:boolean; apiKey?:string; clearKey?:boolean; }
export interface MetaDraft { enabled:boolean; apiKey?:string; clearKey?:boolean; }
export interface ProviderStatus { provider:ProviderId; model:string; enabled:boolean; configured:boolean; keySource:'stored'|'environment'|'none'; }
export interface BackendDraft { baseUrl: string; model: string; apiKey?: string; clearKey?: boolean; }
export interface Agent { id: string; name: string; role: string; division: DivisionId; avatarIndex: number; status: AgentStatus; color: string; instructions?: string; skills?: AgentSkill[]; custom?: boolean; }
export interface Division { id: DivisionId; name: string; subtitle: string; color: string; tint: string; }
export interface Brief { name: string; product: string; audience: string; objective: string; channels: string[]; budget: string; deadline: string; }
export interface Campaign extends Brief { id: string; status: 'draft' | 'working' | 'review' | 'approved' | 'scheduled'; createdAt: string; }
export interface Task { id: string; campaignId: string; title: string; division: DivisionId; agentId: string; instructions: string; dependencies: string[]; status: 'pending' | 'running' | 'review' | 'approved' | 'revision' | 'failed'; error?: string; }
export interface Message { id: string; campaignId?: string; channel: DivisionId | 'general'; senderId: string; content: string; createdAt: string; taskId?: string; }
export interface Artifact { id: string; campaignId: string; taskId: string; title: string; content: string; type: 'analysis' | 'strategy' | 'copy' | 'design' | 'publication'; version: number; status: 'review' | 'approved' | 'revision'; mode: 'demo' | 'live' | 'manual'; createdAt: string; imageUrl?: string; videoUrl?:string; }
export interface Publication { id: string; campaignId: string; channel: string; scheduledAt: string; status: 'scheduled' | 'exported' | 'published' | 'failed' | 'processing'; tiktok?:{attemptedAt:string;publishId?:string}; error?: string; publishedAt?: string; }
export interface AgentRun { id: string; taskId: string; agentId: string; mode: 'demo' | 'live'; status: 'running' | 'completed' | 'failed'; startedAt: string; completedAt?: string; error?: string; }
export interface Metric { id: string; campaignId: string; channel: string; impressions: number; clicks: number; conversions: number; spend: number; recordedAt: string; }
export interface OfficeState { agents: Agent[]; campaigns: Campaign[]; tasks: Task[]; messages: Message[]; artifacts: Artifact[]; publications: Publication[]; runs: AgentRun[]; metrics: Metric[]; revision: number; }
export interface OfficeConfig { video:VideoProviderStatus;videoProviders:VideoProviderStatus[]; aiConfigured: boolean; defaultAIConfigured:boolean; providers:ProviderStatus[]; tiktok:{enabled:boolean;configured:boolean;keySource:'stored'|'environment'|'none'}; meta:{enabled:boolean;configured:boolean;keySource:'stored'|'environment'|'none'}; aiProvider: string; aiModel: string; imageConfigured: boolean; imageProvider:ImageProviderId; imageModel:string; imageProviders:ImageProviderStatus[]; publisherConfigured: boolean; accessProtected: boolean; aiBaseUrl: string; aiLocal:boolean; aiKeySource: 'environment' | 'stored' | 'none'; }
export interface OfficeResponse { state: OfficeState; config: OfficeConfig; }
export type OfficeAction =
 | {type:'saveVideoProvider';settings:VideoProviderDraft}
 | {type:'generateVideo';artifactId:string}
 | {type:'saveImageProvider';settings:ImageProviderDraft}
 | { type:'saveProvider'; provider:ProviderId; settings:ProviderDraft }
 | { type:'saveTikTok'; settings:MetaDraft }
 | { type:'publishTikTok'; publicationId:string; videoUrl:string; title:string; privacyLevel:string; consent:true; disableComment:boolean; disableDuet:boolean; disableStitch:boolean; brandOrganic:boolean; brandContent:boolean }
 | { type:'checkTikTok'; publicationId:string }
 | { type:'saveMeta'; settings:MetaDraft }
 | { type:'saveBackend'; backend:BackendDraft }
 | { type:'addAgent'; agent:AgentDraft; campaignId?:string }
 | { type:'updateAgent'; agentId:string; agent:AgentDraft }
 | { type:'createCampaign'; brief:Brief }
 | { type:'sendMessage'; content:string; channel:DivisionId|'general'; campaignId?:string; assignTo?:string }
 | { type:'runCampaign'; campaignId:string; mode:'demo'|'live' }
 | { type:'runTask'; taskId:string; mode:'demo'|'live' }
 | { type:'approveArtifact'; artifactId:string }
 | { type:'requestRevision'; artifactId:string; feedback:string }
 | { type:'editArtifact'; artifactId:string; content:string }
 | { type:'schedule'; campaignId:string; scheduledAt:string; channels:string[] }
 | { type:'publish'; publicationId:string }
 | { type:'importMetrics'; campaignId:string; metrics:Array<{channel:string;impressions:number;clicks:number;conversions:number;spend:number}> }
 | { type:'generateImage'; artifactId:string };
