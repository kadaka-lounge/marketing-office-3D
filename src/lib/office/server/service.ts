import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Artifact, OfficeAction, OfficeResponse, OfficeState, Task } from '../types';
import { DIVISIONS } from '../catalog';
import {saveBackend,saveProvider,saveMeta,saveTikTok,saveImageProvider,saveVideoProvider} from './backend';
import { addCampaign, addMessage, artifactById, artifactForTask, assertOfficeIdle, assertUnlocked, campaignById, dataDirectory, invalidate, lockCampaign, mutate, now, readState, readyForPublication, renewCampaignLock, taskArtifactType, taskById, taskForAgent, uid, unlockCampaign } from './store';
import { generateOutput, officeConfig, requestImage, requireAI, sendPublication } from './providers';
import {initializeTikTokPost,validateTikTokPost,tiktokPostStatus,TikTokRejected,type TikTokPost} from './tiktok';
import {requestVideo} from './videos';
import { OfficeError, parseAction } from './validation';

export function getOffice(): OfficeResponse { return { state: readState(), config: officeConfig() }; }
function dependenciesReady(state: OfficeState, task: Task) {
  return task.dependencies.every(id => {
    const dep = taskById(state, id); const artifact = artifactForTask(state, id);
    return ['review', 'approved'].includes(dep.status) && artifact && artifact.status !== 'revision';
  });
}
function report(state: OfficeState, task: Task, content: string) {
  for (const channel of ['general', task.division] as const) addMessage(state, { campaignId: task.campaignId, taskId: task.id, senderId: task.agentId, channel, content });
}
async function executeTask(taskId: string, mode: 'demo' | 'live') {
  const runId = uid('run');
  const shouldRun = mutate(state => {
    const task = taskById(state, taskId);
    if (['approved', 'review'].includes(task.status)) return false;
    if (!dependenciesReady(state, task)) throw new OfficeError('Selesaikan hasil terbaru dari tugas prasyarat sebelum menjalankan tugas ini.', 409);
    task.status = 'running'; delete task.error;
    state.runs.push({ id: runId, taskId, agentId: task.agentId, mode, status: 'running', startedAt: now() });
    report(state, task, `Mengerjakan “${task.title}” dalam mode ${mode === 'demo' ? 'Demo Template' : 'AI langsung'}.`);
    return true;
  });
  if (!shouldRun) return;
  try {
    const snapshot = readState(); const task = taskById(snapshot, taskId);
    const output = await generateOutput(snapshot, task, campaignById(snapshot, task.campaignId), mode);
    mutate(state => {
      const current = taskById(state, taskId); const previous = artifactForTask(state, taskId);
      const artifact: Artifact = { id: previous?.id || uid('artifact'), campaignId: current.campaignId, taskId, title: current.title, type: taskArtifactType(current), content: output, version: (previous?.version || 0) + 1, status: 'review', mode, createdAt: now() };
      if (previous) state.artifacts[state.artifacts.indexOf(previous)] = artifact; else state.artifacts.push(artifact);
      current.status = 'review'; delete current.error;
      const run = state.runs.find(r => r.id === runId)!; run.status = 'completed'; run.completedAt = now();
      report(state, current, `Hasil “${current.title}” v${artifact.version} siap ditinjau Marketing Manager. ${mode === 'demo' ? 'Ini contoh template demo, bukan hasil model AI.' : 'Dihasilkan AI; periksa fakta, klaim, dan kesesuaian brief sebelum menyetujui.'}\n\n${output.slice(0, 1000)}${output.length > 1000 ? '\n… Lihat hasil lengkap di panel pekerjaan.' : ''}`);
    });
  } catch (error) {
    const failure = error instanceof OfficeError ? error : new OfficeError('Pekerjaan gagal diproses. Coba kembali.', 502);
    mutate(state => {
      const task = taskById(state, taskId); task.status = 'failed'; task.error = failure.message;
      const run = state.runs.find(r => r.id === runId)!; run.status = 'failed'; run.error = failure.message; run.completedAt = now();
      report(state, task, `Pekerjaan “${task.title}” gagal: ${failure.message}`);
    });
    throw failure;
  }
}
async function run(campaignId: string, mode: 'demo' | 'live', taskId?: string) {
  campaignById(readState(), campaignId);
  const pending = readState().tasks.filter(t => t.campaignId === campaignId && (!taskId || t.id === taskId) && !['review', 'approved'].includes(t.status));
  if (!pending.length) return; // Successful work is idempotent even if provider configuration later changes.
  if (mode === 'live') pending.forEach(task=>requireAI(task));
  const token = lockCampaign(campaignId);
  try {
    // Only reachable for an expired operation: retain history and recover interrupted work.
    mutate(state => {
      for (const task of state.tasks.filter(t => t.campaignId === campaignId && t.status === 'running')) {
        task.status = 'failed'; task.error = 'Pekerjaan sebelumnya terputus; siap dicoba kembali.';
        for (const run of state.runs.filter(r => r.taskId === task.id && r.status === 'running')) { run.status = 'failed'; run.error = task.error; run.completedAt = now(); }
      }
    });
    const taskIds = taskId ? [taskId] : readState().tasks.filter(t => t.campaignId === campaignId).map(t => t.id);
    for (const id of taskIds) { renewCampaignLock(campaignId,token); await executeTask(id, mode); }
  } finally { unlockCampaign(campaignId, token); }
}
function mutateArtifact(artifactId: string, callback: (state: OfficeState, artifact: Artifact, task: Task) => void) {
  mutate(state => {
    const artifact = artifactById(state, artifactId); assertUnlocked(artifact.campaignId);
    callback(state, artifact, taskById(state, artifact.taskId));
  });
}
export function exportCampaign(campaignId: string) {
  const state = readState(); const campaign = campaignById(state, campaignId);
  const assets = state.artifacts.filter(a=>a.campaignId===campaignId&&a.status!=='revision').flatMap(a=>[a.imageUrl,a.videoUrl].filter((url):url is string=>Boolean(url)).map(url=>{
    const name=path.basename(url);const video=/^video-[0-9a-f-]{36}\.mp4$/.test(name);
    if(!video&&!/^image-[0-9a-f-]{36}\.png$/.test(name))throw new OfficeError('Referensi aset tidak valid.',409);
    try{return {artifactId:a.id,filename:name,mimeType:video?'video/mp4':'image/png',dataBase64:readFileSync(path.join(dataDirectory(),'assets',name)).toString('base64')};}
    catch{throw new OfficeError('Aset media tidak tersedia. Buat ulang sebelum mengekspor paket lengkap.',409);}
  }));
  return { schemaVersion: 1, assets, exportedAt: now(), campaign, approved: readyForPublication(state, campaignId), delivery: 'Paket ekspor untuk publikasi manual. Jadwal lokal tidak memublikasikan konten.', tasks: state.tasks.filter(t => t.campaignId === campaignId), artifacts: state.artifacts.filter(a => a.campaignId === campaignId), messages: state.messages.filter(m => m.campaignId === campaignId), publications: state.publications.filter(p => p.campaignId === campaignId), metrics: state.metrics.filter(m => m.campaignId === campaignId) };
}
async function publish(publicationId: string) {
  const existing = readState().publications.find(p => p.id === publicationId);
  if (!existing) throw new OfficeError('Jadwal publikasi tidak ditemukan.', 404);
  if (existing.status === 'published') return;
  if(existing.tiktok)throw new OfficeError('Pengiriman TikTok sudah dimulai. Gunakan Periksa status TikTok.',409);
  const token = lockCampaign(existing.campaignId);
  try {
    const state = readState();
    if (!readyForPublication(state, existing.campaignId)) throw new OfficeError('Seluruh hasil terbaru wajib disetujui manager sebelum publikasi.', 409);
    if (new Date(existing.scheduledAt).getTime() > Date.now()) throw new OfficeError('Waktu jadwal belum tiba. Publikasi memerlukan tindakan manager saat atau setelah waktu jadwal.', 409);
    await sendPublication({ ...exportCampaign(existing.campaignId), publication: existing }, existing.id);
    mutate(state => {
      const publication = state.publications.find(p => p.id === publicationId)!;
      publication.status = 'published'; publication.publishedAt = now(); delete publication.error;
      addMessage(state, { channel: 'general', campaignId: existing.campaignId, senderId: 'kai', content: `Webhook mengonfirmasi publikasi ${existing.channel}. Referensi idempotensi: ${existing.id}.` });
    });
  } catch (error) {
    if (error instanceof OfficeError && error.status === 502) mutate(state => {
      const publication = state.publications.find(p => p.id === publicationId)!; publication.status = 'failed'; publication.error = error.message;
    });
    throw error;
  } finally { unlockCampaign(existing.campaignId, token); }
}
async function generateImage(artifactId: string) {
  const artifact = artifactById(readState(), artifactId);
  if (artifact.type !== 'design') throw new OfficeError('Pembuatan gambar tersedia untuk hasil kerja desain.', 409);
  const task = taskById(readState(), artifact.taskId);
  if (!['review','approved'].includes(task.status) || artifact.status === 'revision') throw new OfficeError('Selesaikan revisi desain sebelum membuat gambar.', 409);
  const token = lockCampaign(artifact.campaignId);
  try {
    const campaign = campaignById(readState(), artifact.campaignId);
    const buffer = await requestImage(`Create one campaign concept image based on this approved-to-render design brief. No extra text or logos unless explicitly required. This is a creative concept, not documentation of a real venue. Campaign: ${campaign.name}. Product: ${campaign.product}. Design instructions: ${artifact.content}`);
    const directory = path.join(dataDirectory(), 'assets'); await mkdir(directory, { recursive: true, mode: 0o700 });
    const name = `${uid('image')}.png`; await writeFile(path.join(directory, name), buffer, { flag: 'wx', mode: 0o600 });
    mutate(state => {
      const current = artifactById(state, artifactId);
      invalidate(state, current.taskId, false);
      current.imageUrl = `/api/office/assets/${name}`; current.version += 1; current.status = 'review'; current.createdAt = now();
      taskById(state, current.taskId).status = 'review';
      report(state, task, 'Konsep visual berhasil dibuat. Gambar dan hasil turunannya perlu ditinjau ulang oleh Marketing Manager.');
    });
  } finally { unlockCampaign(artifact.campaignId, token); }
}
async function generateVideo(artifactId:string){
 const artifact=artifactById(readState(),artifactId);if(artifact.type!=='design')throw new OfficeError('Pembuatan video tersedia untuk hasil kerja desain.',409);
 const task=taskById(readState(),artifact.taskId);if(!['review','approved'].includes(task.status)||artifact.status==='revision')throw new OfficeError('Selesaikan revisi desain sebelum membuat video.',409);
 const token=lockCampaign(artifact.campaignId);
 try{
  const campaign=campaignById(readState(),artifact.campaignId);
  const bytes=await requestVideo(`Create a short campaign concept video. Follow the creative direction, use natural motion, no extra text or logos. This is a creative concept, not documentation of a real venue. Campaign: ${campaign.name}. Product: ${campaign.product}. Design: ${artifact.content}`);
  const directory=path.join(dataDirectory(),'assets');await mkdir(directory,{recursive:true,mode:0o700});const name=`${uid('video')}.mp4`;await writeFile(path.join(directory,name),bytes,{flag:'wx',mode:0o600});
  mutate(state=>{const current=artifactById(state,artifactId);invalidate(state,current.taskId,false);current.videoUrl=`/api/office/assets/${name}`;current.version+=1;current.status='review';current.createdAt=now();taskById(state,current.taskId).status='review';report(state,task,'Video konsep berhasil dibuat. Video dan hasil turunannya perlu review Marketing Manager sebelum publikasi.');});
 }finally{unlockCampaign(artifact.campaignId,token);}
}
export async function performAction(value: unknown): Promise<OfficeResponse> {
  const action: OfficeAction = parseAction(value);
  switch (action.type) {
    case 'saveVideoProvider': assertOfficeIdle(); saveVideoProvider(action.settings); mutate(()=>{}); break;
    case 'generateVideo': await generateVideo(action.artifactId); break;
    case 'saveImageProvider': assertOfficeIdle(); saveImageProvider(action.settings); mutate(()=>{}); break;
    case 'saveProvider': assertOfficeIdle(); saveProvider(action.provider,action.settings); mutate(()=>{}); break;
    case 'saveTikTok': assertOfficeIdle(); saveTikTok(action.settings); mutate(()=>{}); break;
    case 'publishTikTok': await publishTikTok(action); break;
    case 'checkTikTok': await checkTikTok(action.publicationId); break;
    case 'saveMeta': assertOfficeIdle(); saveMeta(action.settings); mutate(()=>{}); break;
    case 'saveBackend': assertOfficeIdle(); saveBackend(action.backend); mutate(() => {}); break;
    case 'addAgent': mutate(state => {
      if (state.agents.filter(a => a.id !== 'manager').length >= 32) throw new OfficeError('Batas 32 agen AI per kantor tercapai.',409);
      if(state.agents.filter(a=>a.division===action.agent.division).length>=8)throw new OfficeError('Batas 8 agen per divisi tercapai.',409);
      if (state.agents.some(a => a.name.toLowerCase() === action.agent.name.toLowerCase())) throw new OfficeError('Nama agen sudah digunakan.',409);
      if (action.campaignId) {campaignById(state,action.campaignId);assertUnlocked(action.campaignId);if(state.tasks.filter(t=>t.campaignId===action.campaignId).length>=100)throw new OfficeError('Batas 100 tugas per kampanye tercapai.',409);}
      const agent = {...action.agent,id:uid('agent'),status:'idle' as const,custom:true,color:DIVISIONS.find(d=>d.id===action.agent.division)!.color};
      state.agents.push(agent);
      if(action.campaignId){const prior=state.tasks.filter(t=>t.campaignId===action.campaignId).at(-1);state.tasks.push(taskForAgent(agent,action.campaignId,prior?.id));state.publications=state.publications.filter(p=>p.campaignId!==action.campaignId||p.status==='published');}
      addMessage(state,{channel:'general',senderId:'manager',content:`${agent.name} bergabung sebagai ${agent.role}. Skill: ${agent.skills.map(s=>s.name).join(', ')}.`,campaignId:action.campaignId});
    });break;
    case 'updateAgent': mutate(state => {
      assertOfficeIdle(); const agent=state.agents.find(a=>a.id===action.agentId&&a.id!=='manager');
      if(!agent)throw new OfficeError('Agen AI tidak ditemukan.',404);
      if(agent.division!==action.agent.division&&state.agents.filter(a=>a.division===action.agent.division).length>=8)throw new OfficeError('Batas 8 agen per divisi tercapai.',409);
      if(state.agents.some(a=>a.id!==agent.id&&a.name.toLowerCase()===action.agent.name.toLowerCase()))throw new OfficeError('Nama agen sudah digunakan.',409);
      const changed=JSON.stringify({name:agent.name,role:agent.role,division:agent.division,avatarIndex:agent.avatarIndex,instructions:agent.instructions||'',skills:agent.skills||[]})!==JSON.stringify(action.agent);
      if(!changed)return;
      Object.assign(agent,action.agent,{color:DIVISIONS.find(d=>d.id===action.agent.division)!.color});
      for(const task of state.tasks.filter(t=>t.agentId===agent.id)){task.division=agent.division;if(agent.custom){const updated=taskForAgent(agent,task.campaignId);if(!task.title.startsWith('Tugas manager:')){task.title=updated.title;task.instructions=updated.instructions;}}if(artifactForTask(state,task.id))invalidate(state,task.id);}
      addMessage(state,{channel:'general',senderId:'manager',content:`Profil dan skill ${agent.name} diperbarui. Hasil terkait perlu ditinjau ulang.`});
    });break;

    case 'createCampaign': mutate(state => {
      if (state.campaigns.length >= 500) throw new OfficeError('Batas 500 kampanye tercapai.', 409);
      addCampaign(state, action.brief);
    }); break;
    case 'sendMessage': mutate(state => {
      if (action.campaignId) campaignById(state, action.campaignId);
      let assigned: Task | undefined;
      if (action.assignTo) {
        if (!action.campaignId) throw new OfficeError('Pilih kampanye sebelum menugaskan agen.');
        assertUnlocked(action.campaignId);
        const agent = state.agents.find(a => a.id === action.assignTo && a.id !== 'manager');
        if (!agent) throw new OfficeError('Agen AI tidak ditemukan.', 404);
        if (state.tasks.filter(t => t.campaignId === action.campaignId).length >= 100) throw new OfficeError('Batas 100 tugas per kampanye tercapai.', 409);
        assigned = { id: uid('task'), campaignId: action.campaignId, title: `Tugas manager: ${action.content.slice(0, 100)}`, agentId: agent.id, division: agent.division, instructions: action.content, status: 'pending', dependencies: [] };
        state.tasks.push(assigned);
        state.publications = state.publications.filter(p => p.campaignId !== action.campaignId || p.status === 'published');
      }
      addMessage(state, { channel: action.channel, senderId: 'manager', content: action.content, campaignId: action.campaignId, taskId: assigned?.id });
      if (assigned) report(state, assigned, `Tugas diterima: “${assigned.title}”. Siap dijalankan atas perintah manager.`);
    }); break;
    case 'runCampaign': await run(action.campaignId, action.mode); break;
    case 'runTask': {
      const task = taskById(readState(), action.taskId); await run(task.campaignId, action.mode, task.id); break;
    }
    case 'approveArtifact': mutateArtifact(action.artifactId, (state, artifact, task) => {
      if (artifact.status === 'approved' && task.status === 'approved') return;
      if (artifact.status !== 'review' || task.status !== 'review' || !dependenciesReady(state, task)) throw new OfficeError('Hasil ini memerlukan revisi atau prasyarat terbaru sebelum disetujui.', 409);
      artifact.status = 'approved'; task.status = 'approved';
      addMessage(state, { channel: 'general', senderId: 'manager', campaignId: artifact.campaignId, taskId: task.id, content: `Menyetujui “${artifact.title}” versi ${artifact.version}.` });
    }); break;
    case 'requestRevision': mutateArtifact(action.artifactId, (state, artifact, task) => {
      invalidate(state, task.id);
      addMessage(state, { channel: task.division, senderId: 'manager', campaignId: artifact.campaignId, taskId: task.id, content: `Revisi “${artifact.title}”: ${action.feedback}` });
      addMessage(state, { channel: 'general', senderId: 'manager', campaignId: artifact.campaignId, taskId: task.id, content: `Meminta revisi “${artifact.title}”. Hasil lanjutan dan jadwal terkait perlu diperbarui. Masukan: ${action.feedback}` });
    }); break;
    case 'editArtifact': mutateArtifact(action.artifactId, (state, artifact, task) => {
      if (!dependenciesReady(state, task)) throw new OfficeError('Selesaikan revisi tugas prasyarat sebelum menyunting hasil lanjutan.', 409);
      if (artifact.content === action.content && artifact.status === 'review') return;
      invalidate(state, task.id, false);
      artifact.content = action.content; artifact.version += 1; artifact.mode = 'manual'; artifact.status = 'review'; artifact.createdAt = now();
      // A visual generated from an older creative brief must not be carried forward as a current asset.
      delete artifact.imageUrl; delete artifact.videoUrl;
      task.status = 'review'; delete task.error;
      addMessage(state, { channel: 'general', senderId: 'manager', campaignId: artifact.campaignId, taskId: task.id, content: `Menyunting “${artifact.title}” menjadi versi ${artifact.version}. Persetujuan dan hasil turunannya perlu diperbarui.` });
    }); break;
    case 'schedule': mutate(state => {
      const campaign = campaignById(state, action.campaignId); assertUnlocked(campaign.id);
      if (!readyForPublication(state, campaign.id)) throw new OfficeError('Setujui seluruh hasil kerja terbaru sebelum menjadwalkan.', 409);
      if (new Date(action.scheduledAt).getTime() <= Date.now()) throw new OfficeError('Waktu jadwal harus berada di masa mendatang.');
      if (action.channels.some(c => !campaign.channels.includes(c))) throw new OfficeError('Kanal jadwal harus sesuai dengan brief kampanye.');
      const scheduledAt = new Date(action.scheduledAt).toISOString(); let added = false;
      for (const channel of action.channels) {
        if (state.publications.some(p => p.campaignId === campaign.id && p.channel === channel && p.scheduledAt === scheduledAt)) continue;
        state.publications.push({ id: uid('publication'), campaignId: campaign.id, channel, scheduledAt, status: 'scheduled' }); added = true;
      }
      if (added) addMessage(state, { channel: 'general', senderId: 'kai', campaignId: campaign.id, content: `Jadwal lokal tersimpan untuk ${action.channels.join(', ')} pada ${scheduledAt}. Tidak ada pengiriman otomatis. Ekspor untuk unggah manual atau jalankan webhook secara eksplisit setelah jadwal tiba.` });
    }); break;
    case 'publish': await publish(action.publicationId); break;
    case 'generateImage': await generateImage(action.artifactId); break;
    case 'importMetrics': mutate(state => {
      const campaign = campaignById(state, action.campaignId);
      if (action.metrics.some(m => !campaign.channels.includes(m.channel))) throw new OfficeError('Kanal metrik harus sesuai dengan brief kampanye.');
      for (const metric of action.metrics) state.metrics.push({ ...metric, id: uid('metric'), campaignId: campaign.id, recordedAt: now() });
      addMessage(state, { channel: 'analytics', senderId: 'manager', campaignId: campaign.id, content: `${action.metrics.length} catatan performa diimpor oleh manager. Sumber: input manual; tidak tersinkron otomatis dengan platform.` });
    }); break;
  }
  return getOffice();
}

async function publishTikTok(post:TikTokPost){
 const existing=readState().publications.find(p=>p.id===post.publicationId);
 if(!existing||existing.channel!=='TikTok')throw new OfficeError('Pilih jadwal TikTok yang valid.',404);
 if(existing.status==='published'||existing.tiktok)throw new OfficeError('Pengiriman sudah dicatat. Periksa status TikTok; jangan kirim ulang.',409);
 const token=lockCampaign(existing.campaignId);
 try{
  if(!readyForPublication(readState(),existing.campaignId))throw new OfficeError('Seluruh hasil terbaru wajib disetujui manager sebelum publikasi.',409);
  if(new Date(existing.scheduledAt).getTime()>Date.now())throw new OfficeError('Waktu jadwal belum tiba.',409);
  const creator=await validateTikTokPost(post);
  mutate(state=>{const p=state.publications.find(p=>p.id===post.publicationId)!;p.status='processing';p.tiktok={attemptedAt:now()};delete p.error;});
  try{
   const publishId=await initializeTikTokPost(post,creator);
   mutate(state=>{state.publications.find(p=>p.id===post.publicationId)!.tiktok!.publishId=publishId;addMessage(state,{channel:'publisher',campaignId:existing.campaignId,senderId:'kai',content:`Video diterima untuk diproses TikTok (@${creator.creator_username}). Belum dikonfirmasi tayang. Periksa status pengiriman.`});});
  }catch(error){
   mutate(state=>{const p=state.publications.find(p=>p.id===post.publicationId)!;p.error=error instanceof OfficeError?error.message:'Status pengiriman belum dapat dipastikan. Periksa akun TikTok.';if(error instanceof TikTokRejected){p.status='failed';delete p.tiktok;}});
   throw error;
  }
 }finally{unlockCampaign(existing.campaignId,token);}
}
async function checkTikTok(publicationId:string){
 const existing=readState().publications.find(p=>p.id===publicationId);
 if(!existing?.tiktok?.publishId)throw new OfficeError('ID TikTok belum tersedia. Periksa akun TikTok jika koneksi terputus saat mengirim; jangan mengirim ulang otomatis.',409);
 if(existing.status==='published')return;
 const token=lockCampaign(existing.campaignId);
 try{
  const status=await tiktokPostStatus(existing.tiktok.publishId);
  mutate(state=>{const p=state.publications.find(p=>p.id===publicationId)!;if(status==='PUBLISH_COMPLETE'){p.status='published';p.publishedAt=now();delete p.error;addMessage(state,{channel:'general',campaignId:existing.campaignId,senderId:'kai',content:'TikTok mengonfirmasi video kampanye telah dipublikasikan.'});}else if(status==='FAILED'){p.status='failed';p.error='TikTok mengonfirmasi pengiriman gagal. Periksa video dan akun sebelum membuat jadwal pengiriman baru.';}else{p.status='processing';delete p.error;}});
 }finally{unlockCampaign(existing.campaignId,token);}
}
