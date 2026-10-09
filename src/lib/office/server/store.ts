import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AGENTS } from '../catalog';
import type { Agent, Artifact, Brief, Campaign, Message, OfficeState, Task } from '../types';
import { OfficeError } from './validation';

export const now = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}-${randomUUID()}`;
export const dataDirectory = () => path.resolve(process.env.OFFICE_DATA_DIR || path.join(process.cwd(), '.data'));
const databases = new Map<string, DatabaseSync>();
export const taskTemplates = [
  { agentId: 'atlas', title: 'Riset audiens & hipotesis pasar', instructions: 'Analisis brief, segmen audiens, masalah pelanggan, posisi produk, dan hipotesis yang perlu divalidasi. Jangan mengklaim riset eksternal atau angka hasil tanpa data.', type: 'analysis' },
  { agentId: 'maya', title: 'Strategi kampanye & channel plan', instructions: 'Susun positioning, pesan utama, content pillars, funnel, alokasi anggaran bersifat usulan, kanal dan rencana kerja sesuai brief serta riset.', type: 'strategy' },
  { agentId: 'rio', title: 'Copywriting Instagram & TikTok', instructions: 'Tulis hook, caption, CTA, script video pendek, dan variasi eksperimen untuk kanal yang dipilih. Klaim harus bersumber dari brief; jangan mengarang testimoni.', type: 'copy' },
  { agentId: 'luna', title: 'Art direction & creative brief', instructions: 'Susun arah visual, palet, tipografi, komposisi, mood, dan prompt GPT Image sesuai strategi serta copy. Nyatakan bahwa gambar baru tersedia setelah proses Generate Image.', type: 'design' },
  { agentId: 'pixel', title: 'Spesifikasi aset & prompt visual', instructions: 'Siapkan spesifikasi carousel, video vertikal, safe zones, daftar aset, alt text, dan prompt GPT Image siap produksi sesuai art direction. Jangan mengklaim file desain sudah dibuat.', type: 'design' },
  { agentId: 'nova', title: 'Rencana pengukuran & eksperimen', instructions: 'Buat measurement plan, definisi KPI, rumus CTR/CVR/CPA, nomenklatur UTM, rancangan eksperimen dan template laporan. Tanpa data impor, jangan mengarang metrik aktual.', type: 'analysis' },
  { agentId: 'cleo', title: 'Review editorial & paket konten', instructions: 'Kompilasi paket konten dari output tim, periksa konsistensi pesan, klaim, ejaan, aksesibilitas dan spesifikasi kanal. Tandai hal yang perlu disetujui Marketing Manager.', type: 'publication' },
  { agentId: 'kai', title: 'Kalender distribusi & handoff', instructions: 'Susun usulan kalender distribusi dan checklist publikasi manual untuk kanal brief. Semua persetujuan harus berasal dari manager. Jadwal lokal dan ekspor tidak memublikasikan konten ke platform.', type: 'publication' },
] as const;

export function addMessage(state: OfficeState, input: Omit<Message, 'id' | 'createdAt'>) {
  state.messages.push({ ...input, id: uid('msg'), createdAt: now() });
}
export function addCampaign(state: OfficeState, brief: Brief, id = uid('campaign')): Campaign {
  const campaign: Campaign = { ...brief, id, status: 'draft', createdAt: now() };
  state.campaigns.push(campaign);
  let previous: string | undefined;
  for (const template of taskTemplates) {
    const agent = AGENTS.find(a => a.id === template.agentId)!;
    const task: Task = { id: uid('task'), campaignId: id, agentId: agent.id, division: agent.division, title: template.title, instructions: template.instructions, dependencies: previous ? [previous] : [], status: 'pending' };
    state.tasks.push(task); previous = task.id;
  }
  addMessage(state, { channel: 'general', senderId: 'manager', campaignId: id, content: `Brief kampanye “${brief.name}” siap. Tujuan: ${brief.objective}. Kanal: ${brief.channels.join(', ')}. Tim menunggu perintah manager.` });
  return campaign;
}
function seed(): OfficeState {
  const state: OfficeState = { agents: structuredClone(AGENTS), campaigns: [], tasks: [], messages: [], artifacts: [], publications: [], runs: [], metrics: [], revision: 0 };
  addMessage(state, { channel: 'general', senderId: 'maya', content: 'Selamat datang di kantor Kadaka. Anda adalah Marketing Manager. Berikan brief, jalankan tim AI atau demo template, lalu tinjau dan setujui hasil sebelum menjadwalkan. Belum ada AI yang dijalankan.' });
  for (const division of ['marketing', 'design', 'analytics', 'publisher'] as const) {
    const agent = AGENTS.find(a => a.division === division)!;
    addMessage(state, { channel: division, senderId: agent.id, content: `Tim ${division} siap menerima tugas dan melapor kepada Marketing Manager. Pesan biasa disimpan sebagai percakapan; pilih agen untuk menugaskan pekerjaan.` });
  }
  addCampaign(state, { name: 'Kadaka — A little everyday escape', product: 'Kadaka Lounge, ruang nyaman untuk kopi, bekerja, dan bertemu teman. Ini brief contoh yang dapat diganti.', audience: 'Profesional muda dan kreator usia 23–35 tahun yang mencari tempat rehat dan bekerja.', objective: 'Meningkatkan awareness dan minat kunjungan melalui cerita keseharian di Kadaka.', channels: ['Instagram', 'TikTok'], budget: 'Rp5.000.000 (usulan contoh)', deadline: 'Tentukan bersama manager' }, 'campaign-kadaka');
  return state;
}
function database() {
  const directory = dataDirectory();
  const existing = databases.get(directory);
  if (existing) return existing;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, 'office.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS office (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS operations (campaign_id TEXT PRIMARY KEY, token TEXT NOT NULL, expires INTEGER NOT NULL);');
  db.prepare('INSERT OR IGNORE INTO office (id,state) VALUES (1,?)').run(JSON.stringify(seed()));
  databases.set(directory, db);
  return db;
}
export function readState(): OfficeState {
  const row = database().prepare('SELECT state FROM office WHERE id=1').get() as { state: string };
  return JSON.parse(row.state);
}
export function mutate<T>(callback: (state: OfficeState) => T): T {
  const db = database(); db.exec('BEGIN IMMEDIATE');
  try {
    const state = readState(); const result = callback(state);
    refreshStatus(state); state.revision += 1;
    db.prepare('UPDATE office SET state=? WHERE id=1').run(JSON.stringify(state));
    db.exec('COMMIT'); return result;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function lockCampaign(campaignId: string): string {
  const token = uid('operation'); const db = database(); db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM operations WHERE expires < ?').run(Date.now());
    if (db.prepare('SELECT 1 FROM operations WHERE campaign_id=?').get(campaignId)) throw new OfficeError('Kampanye sedang diproses. Tunggu pekerjaan selesai.', 409);
    db.prepare('INSERT INTO operations (campaign_id,token,expires) VALUES (?,?,?)').run(campaignId, token, Date.now() + 15 * 60 * 1000);
    db.exec('COMMIT'); return token;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function unlockCampaign(campaignId: string, token: string) { database().prepare('DELETE FROM operations WHERE campaign_id=? AND token=?').run(campaignId, token); }
export function assertUnlocked(campaignId: string) {
  const lock = database().prepare('SELECT 1 FROM operations WHERE campaign_id=? AND expires>=?').get(campaignId, Date.now());
  if (lock) throw new OfficeError('Kampanye sedang diproses. Tunggu pekerjaan selesai.', 409);
}
export function campaignById(state: OfficeState, id: string) {
  const campaign = state.campaigns.find(c => c.id === id);
  if (!campaign) throw new OfficeError('Kampanye tidak ditemukan.', 404);
  return campaign;
}
export function taskById(state: OfficeState, id: string) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) throw new OfficeError('Tugas tidak ditemukan.', 404);
  return task;
}
export function artifactById(state: OfficeState, id: string) {
  const artifact = state.artifacts.find(a => a.id === id);
  if (!artifact) throw new OfficeError('Hasil kerja tidak ditemukan.', 404);
  return artifact;
}
export function artifactForTask(state: OfficeState, taskId: string) { return state.artifacts.find(a => a.taskId === taskId); }
export function readyForPublication(state: OfficeState, campaignId: string) {
  const tasks = state.tasks.filter(t => t.campaignId === campaignId);
  return tasks.length > 0 && tasks.every(t => t.status === 'approved' && artifactForTask(state, t.id)?.status === 'approved');
}
export function invalidate(state: OfficeState, taskId: string, includeRoot = true) {
  const root = taskById(state, taskId);
  const invalid = new Set(includeRoot ? [taskId] : []);
  const ancestors = new Set([taskId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of state.tasks) if (!ancestors.has(task.id) && task.dependencies.some(d => ancestors.has(d))) { ancestors.add(task.id); invalid.add(task.id); changed = true; }
  }
  for (const id of invalid) {
    const task = taskById(state, id); task.status = 'revision'; delete task.error;
    const artifact = artifactForTask(state, id); if (artifact) artifact.status = 'revision';
  }
  state.publications = state.publications.filter(p => p.campaignId !== root.campaignId || p.status === 'published');
}
function refreshStatus(state: OfficeState) {
  for (const campaign of state.campaigns) {
    const tasks = state.tasks.filter(t => t.campaignId === campaign.id);
    campaign.status = tasks.some(t => t.status === 'running') ? 'working' : readyForPublication(state, campaign.id) ? (state.publications.some(p => p.campaignId === campaign.id && ['scheduled','published','exported'].includes(p.status)) ? 'scheduled' : 'approved') : tasks.some(t => ['review','revision','failed','approved'].includes(t.status)) ? 'review' : 'draft';
  }
  for (const agent of state.agents) {
    const tasks = state.tasks.filter(t => t.agentId === agent.id);
    agent.status = tasks.some(t => t.status === 'running') ? 'working' : tasks.some(t => t.status === 'failed') ? 'error' : tasks.some(t => ['review','revision'].includes(t.status)) ? 'review' : 'idle';
  }
}
export function taskArtifactType(task: Task): Artifact['type'] {
  return taskTemplates.find(t => t.agentId === task.agentId)?.type || 'strategy';
}
export function agentForTask(task: Task): Agent { return AGENTS.find(a => a.id === task.agentId)!; }
export function closeDatabases() { for (const db of databases.values()) db.close(); databases.clear(); }
