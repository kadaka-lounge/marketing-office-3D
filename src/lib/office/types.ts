export type DivisionId = 'manager' | 'marketing' | 'design' | 'analytics' | 'publisher';
export type AgentStatus = 'idle' | 'working' | 'review' | 'error';
export interface Agent { id: string; name: string; role: string; division: DivisionId; avatarIndex: number; status: AgentStatus; color: string; }
export interface Division { id: DivisionId; name: string; subtitle: string; color: string; tint: string; }
export interface Brief { name: string; product: string; audience: string; objective: string; channels: string[]; budget: string; deadline: string; }
export interface Campaign extends Brief { id: string; status: 'draft' | 'working' | 'review' | 'approved' | 'scheduled'; createdAt: string; }
export interface Task { id: string; campaignId: string; title: string; division: DivisionId; agentId: string; instructions: string; dependencies: string[]; status: 'pending' | 'running' | 'review' | 'approved' | 'revision' | 'failed'; error?: string; }
export interface Message { id: string; campaignId?: string; channel: DivisionId | 'general'; senderId: string; content: string; createdAt: string; taskId?: string; }
export interface Artifact { id: string; campaignId: string; taskId: string; title: string; content: string; type: 'analysis' | 'strategy' | 'copy' | 'design' | 'publication'; version: number; status: 'review' | 'approved' | 'revision'; mode: 'demo' | 'live' | 'manual'; createdAt: string; imageUrl?: string; }
export interface Publication { id: string; campaignId: string; channel: string; scheduledAt: string; status: 'scheduled' | 'exported' | 'published' | 'failed'; error?: string; publishedAt?: string; }
export interface AgentRun { id: string; taskId: string; agentId: string; mode: 'demo' | 'live'; status: 'running' | 'completed' | 'failed'; startedAt: string; completedAt?: string; error?: string; }
export interface Metric { id: string; campaignId: string; channel: string; impressions: number; clicks: number; conversions: number; spend: number; recordedAt: string; }
export interface OfficeState { agents: Agent[]; campaigns: Campaign[]; tasks: Task[]; messages: Message[]; artifacts: Artifact[]; publications: Publication[]; runs: AgentRun[]; metrics: Metric[]; revision: number; }
export interface OfficeConfig { aiConfigured: boolean; aiProvider: string; aiModel: string; imageConfigured: boolean; publisherConfigured: boolean; accessProtected: boolean; }
export interface OfficeResponse { state: OfficeState; config: OfficeConfig; }
export type OfficeAction =
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
