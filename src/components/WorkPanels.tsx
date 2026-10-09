'use client';
import TikTokPublishForm from './TikTokPublishForm';

import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BarChart3, CalendarClock, Check, CheckCheck,
  ClipboardCheck, Clock3, Download, ExternalLink, FileCheck2,
  FileText, ImagePlus, Info, Layers3, LoaderCircle, LockKeyhole, MessageSquare,
  Pencil, Play, Plus, RefreshCw, Save, Settings2, ShieldCheck, Sparkles, Target,
  Users, WandSparkles, X,
} from 'lucide-react';
import { DIVISIONS, divisionById } from '@/lib/office/catalog';
import type { Agent, Artifact, Campaign, OfficeAction, OfficeConfig, OfficeState, Task } from '@/lib/office/types';
import './work-panels.css';

interface WorkPanelsProps {
  view: 'workflow' | 'deliverables' | 'analytics' | 'settings' | 'team';
  state: OfficeState;
  config: OfficeConfig;
  campaignId: string;
  action: (action: OfficeAction) => Promise<void>;
  busy: boolean;
  onSelectAgent: (id: string) => void;
  refresh: () => Promise<void>;
  onManageAgents?: () => void;
}

const taskLabels: Record<Task['status'], string> = {
  pending: 'Menunggu', running: 'Dikerjakan', review: 'Perlu review',
  approved: 'Disetujui', revision: 'Perlu revisi', failed: 'Gagal',
};
const artifactLabels: Record<Artifact['status'], string> = {
  review: 'Perlu review', approved: 'Disetujui', revision: 'Perlu revisi',
};
const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const formatRupiah = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);
const formatDate = (value: string) => new Date(value).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function latestArtifacts(artifacts: Artifact[]): Artifact[] {
  const latest = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    const current = latest.get(artifact.taskId);
    if (!current || artifact.version > current.version ||
      (artifact.version === current.version && artifact.createdAt > current.createdAt)) {
      latest.set(artifact.taskId, artifact);
    }
  }
  return [...latest.values()];
}

function Portrait({ agent, size = 36 }: { agent?: Agent; size?: number }) {
  const index = agent?.avatarIndex ?? 0;
  return <span aria-hidden="true" className="wp-avatar" style={{
    width: size, height: size, backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
    backgroundColor: agent ? divisionById(agent.division).tint : '#eeeae0',
  }} />;
}

function Status({ status, label }: { status: string; label: string }) {
  return <span className={`wp-status wp-status-${status}`}>
    {status === 'running' ? <LoaderCircle size={12} className="wp-spin" /> :
      status === 'approved' || status === 'published' ? <Check size={12} /> : <span className="wp-status-dot" />}
    {label}
  </span>;
}

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="wp-empty"><div className="wp-empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p></div>;
}

function SectionTitle({ eyebrow, title, children, aside }: {
  eyebrow: string; title: string; children: ReactNode; aside?: ReactNode;
}) {
  return <header className="wp-heading"><div><span className="wp-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{children}</p></div>{aside}</header>;
}

export default function WorkPanels(props: WorkPanelsProps) {
  return <section className={`work-panels wp-view-${props.view}`}>
    {props.view === 'workflow' && <WorkflowPanel key={props.campaignId} {...props} />}
    {props.view === 'deliverables' && <DeliverablesPanel key={props.campaignId} {...props} />}
    {props.view === 'analytics' && <AnalyticsPanel key={props.campaignId} {...props} />}
    {props.view === 'settings' && <SettingsPanel {...props} />}
    {props.view === 'team' && <TeamPanel {...props} />}
  </section>;
}

function WorkflowPanel({ state, config, campaignId, action, busy, onSelectAgent }: WorkPanelsProps) {
  const [mode, setMode] = useState<'demo' | 'live'>(config.aiConfigured ? 'live' : 'demo');
  const campaign = state.campaigns.find(item => item.id === campaignId);
  const tasks = state.tasks.filter(item => item.campaignId === campaignId);
  const complete = tasks.filter(task => task.status === 'approved').length;
  const review = tasks.filter(task => task.status === 'review').length;
  const runTask = async (taskId: string) => {
    try { await action({ type: 'runTask', taskId, mode }); } catch { /* Parent displays API error. */ }
  };
  return <>
    <SectionTitle eyebrow="DARI BRIEF HINGGA PUBLIKASI" title="Alur kerja, satu tujuan."
      aside={<div className="wp-mode-switch" aria-label="Mode pengerjaan">
        <button className={mode === 'demo' ? 'is-active' : ''} onClick={() => setMode('demo')}>Demo</button>
        <button className={mode === 'live' ? 'is-active' : ''} onClick={() => setMode('live')} disabled={!config.aiConfigured} title={config.aiConfigured ? 'Jalankan agen dengan API tersimpan' : 'Hubungkan provider melalui Backend & API untuk mengaktifkan'}><Sparkles size={13} /> AI langsung</button>
      </div>}>
      Setiap divisi berkolaborasi. Keputusan akhir tetap di tangan Anda.
    </SectionTitle>
    {!campaign ? <EmptyState icon={<Layers3 size={28} />} title="Mulai dengan sebuah brief">Buat kampanye melalui tombol “Brief baru”. Tim akan mendapatkan tugas, penanggung jawab, dan urutan kerja yang jelas.</EmptyState> : <>
      <div className="wp-workflow-summary wp-card">
        <div className="wp-summary-icon"><Layers3 size={21} /></div>
        <div className="wp-grow"><span className="wp-small-label">KAMPANYE AKTIF</span><h3>{campaign.name}</h3><p>{campaign.objective}</p></div>
        <div className="wp-progress-summary"><strong>{complete}<span> / {tasks.length}</span></strong><span>tugas disetujui</span><div className="wp-progress-track"><span style={{ width: `${tasks.length ? complete / tasks.length * 100 : 0}%` }} /></div></div>
      </div>
      <div className="wp-workflow-meta"><span><ClipboardCheck size={15} /> {review} menunggu review Anda</span><span><Users size={15} /> 4 divisi berkolaborasi</span><span><ShieldCheck size={15} /> Persetujuan manusia</span></div>
      {mode === 'demo' && <div className="wp-note"><Info size={16} /><span>Mode demo menggunakan contoh terstruktur untuk mencoba alur kerja. Hasil demo diberi label dan bukan keluaran AI langsung.</span></div>}
      <div className="wp-task-list">
        {tasks.map((task, index) => {
          const agent = state.agents.find(item => item.id === task.agentId);
          const division = divisionById(task.division);
          const dependencies = task.dependencies.map(id => tasks.find(item => item.id === id)).filter((item): item is Task => Boolean(item));
          const blocked = dependencies.some(item => !['review', 'approved'].includes(item.status));
          const running = task.status === 'running';
          return <div className="wp-task-step" key={task.id}>
            <div className={`wp-step-number ${task.status === 'approved' ? 'is-complete' : ''}`}>{task.status === 'approved' ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</div>
            <article className="wp-task-card wp-card" data-testid="task-card" data-task-id={task.id} data-status={task.status}>
              <div className="wp-task-heading"><span className="wp-division-chip" style={{ color: division.color, background: division.tint }}>{division.name}</span><Status status={task.status} label={taskLabels[task.status]} /></div>
              <h3>{task.title}</h3><p className="wp-task-description">{task.instructions}</p>
              {dependencies.length > 0 && <div className="wp-task-dependencies"><ArrowDown size={12} /><span>Menggunakan: {dependencies.map(item => item.title).join(' · ')}</span></div>}
              {task.error && <p className="wp-inline-error" role="alert">{task.error}</p>}
              <div className="wp-task-footer"><button className="wp-agent-inline" onClick={() => onSelectAgent(task.agentId)}><Portrait agent={agent} size={29} /><span>{agent?.name ?? task.agentId}<small>{agent?.role}</small></span></button>
                <button data-testid="run-task" className={`wp-button ${task.status === 'revision' ? 'wp-button-primary' : 'wp-button-quiet'}`} disabled={busy || blocked || running || task.status === 'approved'} onClick={() => runTask(task.id)} title={blocked ? 'Selesaikan tugas prasyarat terlebih dahulu' : undefined}>
                  {running ? <LoaderCircle size={14} className="wp-spin" /> : task.status === 'revision' || task.status === 'failed' ? <RefreshCw size={14} /> : <Play size={14} />}
                  {running ? 'Sedang bekerja' : task.status === 'revision' ? 'Kerjakan revisi' : task.status === 'failed' ? 'Coba lagi' : task.status === 'approved' ? 'Selesai' : task.status === 'review' ? 'Jalankan ulang' : blocked ? 'Menunggu prasyarat' : mode === 'demo' ? 'Jalankan demo' : 'Jalankan agen'}
                </button>
              </div>
            </article>
          </div>;
        })}
      </div>
      <div className="wp-workflow-finish"><ShieldCheck size={19} /><div><strong>Anda memegang kendali.</strong><p>Review di Hasil pekerjaan, berikan revisi, lalu setujui sebelum menjadwalkan publikasi.</p></div></div>
    </>}
  </>;
}

function DeliverablesPanel({ state, config, campaignId, action, busy }: WorkPanelsProps) {
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const campaign = state.campaigns.find(item => item.id === campaignId);
  const allArtifacts = state.artifacts.filter(item => item.campaignId === campaignId);
  const artifacts = latestArtifacts(allArtifacts);
  const selected = allArtifacts.find(item => item.id === selectedId) ?? artifacts[0];
  const selectedLatest = selected ? artifacts.find(item => item.taskId === selected.taskId) : undefined;
  const isHistory = Boolean(selected && selectedLatest && selected.id !== selectedLatest.id);
  const history = selected ? allArtifacts.filter(item => item.taskId === selected.taskId).sort((a, b) => b.version - a.version) : [];
  const approvedCount = artifacts.filter(item => item.status === 'approved').length;
  const selectArtifact = (artifact: Artifact) => {
    setSelectedId(artifact.id); setEditing(false); setRevising(false); setFeedback(''); setHistoryOpen(false);
  };
  const approve = async (artifactId: string) => {
    try { await action({ type: 'approveArtifact', artifactId }); } catch { /* Parent displays API error. */ }
  };
  const saveEdit = async () => {
    if (!selected || !draft.trim()) return;
    try { await action({ type: 'editArtifact', artifactId: selected.id, content: draft }); setEditing(false); } catch { /* Parent displays API error. */ }
  };
  const submitRevision = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !feedback.trim()) return;
    try { await action({ type: 'requestRevision', artifactId: selected.id, feedback: feedback.trim() }); setRevising(false); setFeedback(''); } catch { /* Parent displays API error. */ }
  };
  const generateImage = async () => {
    if (!selected) return;
    try { await action({ type: 'generateImage', artifactId: selected.id }); } catch { /* Parent displays API error. */ }
  };
  const generateVideo=async()=>{if(!selected)return;try{await action({type:'generateVideo',artifactId:selected.id});}catch{/* Parent displays API error. */}};
  return <>
    <SectionTitle eyebrow="RUANG REVIEW ANDA" title="Ide menjadi hasil kerja."
      aside={campaign && artifacts.length > 0 ? <a data-testid="export-campaign" className="wp-button wp-button-outlined" href={`/api/office/export?campaignId=${encodeURIComponent(campaignId)}`} download><Download size={15} /> Ekspor kampanye</a> : undefined}>
      Tinjau, sempurnakan, dan setujui setiap hasil sebelum dibagikan ke dunia.
    </SectionTitle>
    {artifacts.length === 0 ? <EmptyState icon={<FileText size={28} />} title="Ruang untuk ide terbaik tim">{campaign ? 'Jalankan tugas di Alur Kerja atau jalankan kampanye. Strategi, copy, arahan desain, dan rencana publikasi akan tersimpan di sini.' : 'Buat kampanye pertama, lalu berikan brief kepada tim. Semua hasil kerja akan terkumpul di ruang ini.'}</EmptyState> : <>
      <div className="wp-deliverable-summary"><span><FileText size={15} /><strong>{artifacts.length}</strong> dokumen</span><span><CheckCheck size={15} /><strong>{approvedCount}</strong> disetujui</span><span><Clock3 size={15} /><strong>{artifacts.length - approvedCount}</strong> perlu perhatian</span></div>
      <div className="wp-document-workspace">
        <aside className="wp-document-list wp-card" aria-label="Daftar dokumen"><div className="wp-list-label">HASIL KERJA TIM <span>{artifacts.length}</span></div>
          {artifacts.map(artifact => {
            const task = state.tasks.find(item => item.id === artifact.taskId);
            const division = divisionById(task?.division ?? 'manager');
            return <article key={artifact.id} data-testid="artifact-card" data-artifact-id={artifact.id} className={`wp-document-item ${selected?.taskId === artifact.taskId ? 'is-selected' : ''}`}>
              <button data-testid="artifact-select" className="wp-document-select" onClick={() => selectArtifact(artifact)}>
                <span className="wp-document-icon" style={{ background: division.tint, color: division.color }}><FileText size={17} /></span>
                <span className="wp-document-info"><strong>{artifact.title}</strong><span>{division.name} <span className="wp-meta-dot">·</span> v{artifact.version}</span></span>
              </button>
              <div className="wp-document-item-footer"><Status status={artifact.status} label={artifactLabels[artifact.status]} />
                {artifact.status === 'review' && <button data-testid="artifact-approve" className="wp-quick-approve" disabled={busy} aria-label={`Setujui ${artifact.title}`} title="Setujui dokumen" onClick={() => approve(artifact.id)}><Check size={15} /></button>}
              </div>
            </article>;
          })}
        </aside>
        {selected && <article className="wp-document-detail wp-card" data-testid="artifact-detail" data-artifact-id={selected.id}>
          <header className="wp-document-header"><div><span className="wp-small-label">{selected.type.toUpperCase()} <span className="wp-meta-dot">/</span> VERSI {selected.version}</span><h3>{selected.title}</h3><div className="wp-document-metadata"><span>{formatDate(selected.createdAt)}</span><span className={`wp-origin wp-origin-${selected.mode}`}>{selected.mode === 'demo' ? 'Contoh demo' : selected.mode === 'live' ? 'Dibuat dengan AI' : 'Disunting manual'}</span></div></div>
            <div className="wp-document-tools"><button className="wp-icon-button" title="Riwayat versi" aria-label="Tampilkan riwayat versi" onClick={() => setHistoryOpen(!historyOpen)}><Clock3 size={17} /></button>{!isHistory && <button className="wp-icon-button" title="Sunting dokumen" aria-label="Sunting dokumen" onClick={() => { setDraft(selected.content); setEditing(true); setRevising(false); }} disabled={busy}><Pencil size={16} /></button>}</div>
          </header>
          {historyOpen && <div className="wp-history"><span>Riwayat dokumen</span>{history.map(artifact => <button key={artifact.id} className={selected.id === artifact.id ? 'is-active' : ''} onClick={() => selectArtifact(artifact)}>v{artifact.version} <span>{formatDate(artifact.createdAt)}</span><span>{artifactLabels[artifact.status]}</span></button>)}</div>}
          {isHistory && <div className="wp-note wp-history-note"><Clock3 size={15} /><span>Anda sedang melihat versi sebelumnya.</span><button onClick={() => selectedLatest && selectArtifact(selectedLatest)}>Ke versi terbaru <ArrowRight size={13} /></button></div>}
          {editing ? <div className="wp-editor"><label htmlFor="document-content">Isi dokumen · Markdown</label><textarea id="document-content" data-testid="artifact-content-editor" value={draft} onChange={event => setDraft(event.target.value)} rows={20} /><div className="wp-editor-footer"><button className="wp-button wp-button-quiet" onClick={() => setEditing(false)}>Batal</button><button className="wp-button wp-button-primary" onClick={saveEdit} disabled={busy || !draft.trim()}><Save size={14} /> Simpan versi</button></div></div> : <div className="wp-document-body"><ReactMarkdown>{selected.content}</ReactMarkdown>{selected.imageUrl && <a className="wp-artifact-image" href={selected.imageUrl} target="_blank" rel="noreferrer"><Image src={selected.imageUrl} alt={`Visual untuk ${selected.title}`} width={1024} height={1024} unoptimized /><span><ExternalLink size={13} /> Buka gambar ukuran penuh</span></a>}{selected.videoUrl&&<div className="wp-artifact-video"><video data-testid="artifact-video" controls preload="metadata" src={selected.videoUrl} style={{width:'100%',maxHeight:520,borderRadius:12}}/><a href={selected.videoUrl} download>Unduh MP4</a></div>}</div>}
          {!isHistory && !editing && <>
            {selected.type==='design'&&<div className="wp-image-tools"><span><Play size={17}/><span><strong>Produksi video</strong><small>{config.video.configured?`Klip konsep dari ${config.video.model}. Dapat memerlukan beberapa menit dan kredit berbayar.`:'Hubungkan token di Backend & API → Model Video.'}</small></span></span><button data-testid="generate-video" className="wp-button wp-button-outlined" disabled={busy||!config.video.configured} onClick={generateVideo}><Play size={14}/>{selected.videoUrl?'Buat ulang video':'Buat video'}</button></div>}
            {selected.type === 'design' && <div className="wp-image-tools"><span><ImagePlus size={17} /><span><strong>Produksi visual</strong><small>{config.imageConfigured ? `Buat visual dari arahan desain menggunakan ${config.imageModel}.` : 'Hubungkan provider pada Backend & API → Model Gambar untuk membuat visual.'}</small></span></span><button className="wp-button wp-button-outlined" disabled={busy || !config.imageConfigured} onClick={generateImage}><WandSparkles size={14} /> {selected.imageUrl ? 'Buat ulang visual' : 'Buat visual'}</button></div>}
            <footer className="wp-document-footer"><Status status={selected.status} label={artifactLabels[selected.status]} /><div><button data-testid="artifact-revise" className="wp-button wp-button-outlined" onClick={() => { setRevising(!revising); setFeedback(''); }} disabled={busy}><MessageSquare size={14} /> Minta revisi</button>{selected.status === 'review' && <button className="wp-button wp-button-primary" disabled={busy} onClick={() => approve(selected.id)}><Check size={15} /> Setujui dokumen</button>}</div></footer>
            {revising && <form className="wp-revision-form" onSubmit={submitRevision}><label htmlFor="revision-feedback">Apa yang perlu disempurnakan?</label><p>Arahan Anda dikirim ke agen penanggung jawab. Jalankan kembali tugas untuk mengerjakan revisi.</p><textarea id="revision-feedback" data-testid="revision-feedback" required placeholder="Contoh: Fokuskan pesan pada pemilik usaha kecil dan tambahkan CTA yang lebih spesifik…" rows={3} value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={8000} /><div><button type="button" className="wp-button wp-button-quiet" onClick={() => setRevising(false)}>Batal</button><button data-testid="revision-submit" className="wp-button wp-button-primary" type="submit" disabled={busy || !feedback.trim()}><ArrowRight size={14} /> Kirim arahan revisi</button></div></form>}
          </>}
        </article>}
      </div>
      {campaign && <PublicationPanel campaign={campaign} state={state} config={config} action={action} busy={busy} />}
    </>}
  </>;
}

function PublicationPanel({ campaign, state, config, action, busy }: {
  campaign: Campaign; state: OfficeState; config: OfficeConfig;
  action: WorkPanelsProps['action']; busy: boolean;
}) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [formError, setFormError] = useState('');
  const artifacts = latestArtifacts(state.artifacts.filter(item => item.campaignId === campaign.id));
  const tasks = state.tasks.filter(item => item.campaignId === campaign.id);
  const ready = tasks.length > 0 && tasks.every(task => task.status === 'approved') && artifacts.length >= tasks.length && artifacts.every(artifact => artifact.status === 'approved');
  const publications = state.publications.filter(item => item.campaignId === campaign.id);
  const schedule = async (event: FormEvent) => {
    event.preventDefault();
    const date = new Date(scheduledAt);
    if (!scheduledAt || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setFormError('Pilih tanggal dan waktu di masa mendatang.'); return;
    }
    setFormError('');
    try { await action({ type: 'schedule', campaignId: campaign.id, scheduledAt: date.toISOString(), channels: campaign.channels }); setScheduledAt(''); } catch { /* Parent displays API error. */ }
  };
  const publish = async (publicationId: string) => {
    try { await action({ type: 'publish', publicationId }); } catch { /* Parent displays API error. */ }
  };
  return <section className="wp-publication wp-card"><div className="wp-publication-heading"><span className="wp-summary-icon"><CalendarClock size={21} /></span><div><h3>Siap menuju publikasi</h3><p>{ready ? 'Seluruh hasil kerja telah Anda setujui. Atur langkah berikutnya.' : 'Selesaikan dan setujui seluruh tugas kampanye untuk membuka penjadwalan.'}</p></div><span className={`wp-status ${ready ? 'wp-status-approved' : 'wp-status-pending'}`}>{ready ? <Check size={12} /> : <LockKeyhole size={12} />}{ready ? 'Siap dijadwalkan' : 'Menunggu persetujuan'}</span></div>
    <form className="wp-schedule-form" onSubmit={schedule}><div className="wp-form-field"><label htmlFor="schedule-date">Tanggal & waktu</label><input data-testid="schedule-date" id="schedule-date" type="datetime-local" required disabled={!ready || busy} value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} /><small>Zona waktu perangkat: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small></div><div className="wp-form-field"><label>Kanal kampanye</label><div className="wp-channel-list">{campaign.channels.map(channel => <span key={channel}>{channel}</span>)}</div></div><button className="wp-button wp-button-primary" data-testid="schedule-submit" disabled={!ready || busy || !scheduledAt}><CalendarClock size={15} /> Simpan jadwal lokal</button></form>
    {formError && <p className="wp-inline-error" role="alert">{formError}</p>}
    <div className="wp-note wp-publication-note"><Info size={15} /><span>Jadwal disimpan di kantor ini. {config.tiktok.enabled&&config.tiktok.configured ? 'Pengiriman video TikTok memerlukan persetujuan dan tombol kirim pada formulir di bawah. Periksa status untuk konfirmasi tayang.' : config.publisherConfigured ? 'Pengiriman ke konektor Publisher memerlukan tindakan “Kirim ke Publisher” di bawah.' : 'Publikasi otomatis belum terhubung. Ekspor paket kampanye untuk diunggah melalui Instagram dan TikTok.'}</span></div>
    {publications.length > 0 && <div className="wp-publication-list">{publications.map(publication => <div key={publication.id}><div className="wp-publication-row"><span className="wp-publication-channel"><CalendarClock size={16} /><strong>{publication.channel}</strong></span><span>{formatDate(publication.scheduledAt)}</span><Status status={publication.status} label={{ scheduled: 'Jadwal lokal', exported: 'Diekspor', published: 'Terkirim', failed: 'Gagal', processing:'Diproses TikTok' }[publication.status]} />{config.publisherConfigured && publication.status !== 'published' && !publication.tiktok && <button className="wp-button wp-button-quiet" disabled={busy} onClick={() => publish(publication.id)}><ArrowUpRight size={14} /> Kirim ke Publisher</button>}{publication.error && <p className="wp-inline-error">{publication.error}</p>}</div>{publication.tiktok&&publication.status!=='published'&&<div className="wp-note"><span>{publication.tiktok.publishId?'Pengiriman sudah dicatat; periksa status tanpa mengirim ulang.':'Pengiriman belum memiliki ID konfirmasi. Periksa akun TikTok sebelum membuat pengiriman baru.'}</span>{publication.tiktok.publishId&&<button className="wp-button wp-button-outlined" disabled={busy} onClick={()=>void action({type:'checkTikTok',publicationId:publication.id}).catch(()=>{})}>Periksa status TikTok</button>}</div>}{publication.channel==='TikTok'&&config.tiktok.enabled&&config.tiktok.configured&&!publication.tiktok&&publication.status!=='published'&&<TikTokPublishForm publicationId={publication.id} busy={busy} ready={ready} action={action}/>}</div>)}</div>}
  </section>;
}

function AnalyticsPanel({ state, campaignId, action, busy }: WorkPanelsProps) {
  const [showImport, setShowImport] = useState(false);
  const [channel, setChannel] = useState(state.campaigns.find(item => item.id === campaignId)?.channels[0] ?? 'Instagram');
  const [values, setValues] = useState({ impressions: '', clicks: '', conversions: '', spend: '' });
  const [formError, setFormError] = useState('');
  const campaign = state.campaigns.find(item => item.id === campaignId);
  const metrics = state.metrics.filter(item => item.campaignId === campaignId);
  const totals = metrics.reduce((sum, metric) => ({ impressions: sum.impressions + metric.impressions, clicks: sum.clicks + metric.clicks, conversions: sum.conversions + metric.conversions, spend: sum.spend + metric.spend }), { impressions: 0, clicks: 0, conversions: 0, spend: 0 });
  const hasMetrics = metrics.length > 0;
  const channelNames = [...new Set([...campaign?.channels ?? ['Instagram', 'TikTok'], ...metrics.map(metric => metric.channel)])];
  const channelTotals = channelNames.map(name => ({ name, ...metrics.filter(metric => metric.channel === name).reduce((sum, metric) => ({ impressions: sum.impressions + metric.impressions, clicks: sum.clicks + metric.clicks, conversions: sum.conversions + metric.conversions, spend: sum.spend + metric.spend }), { impressions: 0, clicks: 0, conversions: 0, spend: 0 }), records: metrics.filter(metric => metric.channel === name).length }));
  const tasks = state.tasks.filter(item => item.campaignId === campaignId);
  const artifacts = latestArtifacts(state.artifacts.filter(item => item.campaignId === campaignId));
  const runs = state.runs.filter(run => tasks.some(task => task.id === run.taskId));
  const importMetrics = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = { impressions: Number(values.impressions), clicks: Number(values.clicks), conversions: Number(values.conversions), spend: Number(values.spend) };
    if (Object.values(values).some(value => value.trim() === '') || Object.values(parsed).some(value => !Number.isFinite(value) || value < 0) || ![parsed.impressions, parsed.clicks, parsed.conversions].every(Number.isInteger)) {
      setFormError('Isi semua kolom dengan angka nol atau positif. Impresi, klik, dan konversi harus berupa bilangan bulat.'); return;
    }
    setFormError('');
    try { await action({ type: 'importMetrics', campaignId, metrics: [{ channel, ...parsed }] }); setShowImport(false); setValues({ impressions: '', clicks: '', conversions: '', spend: '' }); } catch { /* Parent displays API error. */ }
  };
  return <>
    <SectionTitle eyebrow="ANGKA YANG PUNYA MAKNA" title="Kenali dampak pekerjaan Anda."
      aside={<button data-testid="metric-import" className="wp-button wp-button-primary" disabled={!campaign} onClick={() => setShowImport(!showImport)}><Plus size={15} /> Tambah data metrik</button>}>
      Pantau performa dari data kanal yang Anda masukkan, serta aktivitas nyata tim.
    </SectionTitle>
    {showImport && <form className="wp-metric-form wp-card" onSubmit={importMetrics}><div className="wp-inline-heading"><div><h3>Masukkan data performa</h3><p>Tambahkan satu periode data baru dari laporan kanal Anda.</p></div><button type="button" className="wp-icon-button" aria-label="Tutup form metrik" onClick={() => setShowImport(false)}><X size={17} /></button></div><div className="wp-metric-fields"><div className="wp-form-field"><label htmlFor="metric-channel">Kanal</label><select id="metric-channel" data-testid="metric-channel" value={channel} onChange={event => setChannel(event.target.value)}>{channelNames.map(name => <option key={name}>{name}</option>)}</select></div>{([['impressions', 'Impresi'], ['clicks', 'Klik'], ['conversions', 'Konversi'], ['spend', 'Biaya (IDR)']] as const).map(([key, label]) => <div className="wp-form-field" key={key}><label htmlFor={`metric-${key}`}>{label}</label><input id={`metric-${key}`} data-testid={`metric-${key}`} type="number" min="0" step={key === 'spend' ? '0.01' : '1'} required placeholder="0" value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></div>)}</div>{formError && <p className="wp-inline-error" role="alert">{formError}</p>}<div className="wp-metric-form-footer"><span><Info size={14} /> Data baru ditambahkan ke total. Hindari memasukkan periode yang sama dua kali.</span><button type="submit" data-testid="metric-submit" className="wp-button wp-button-primary" disabled={busy}><Save size={14} /> Simpan data</button></div></form>}
    <div className="wp-metric-cards">{[
      { label: 'Total impresi', value: formatNumber(totals.impressions), icon: <BarChart3 size={17} />, note: 'Jumlah tayangan di seluruh kanal' },
      { label: 'Klik', value: formatNumber(totals.clicks), icon: <ArrowUpRight size={17} />, note: 'Interaksi menuju tautan Anda' },
      { label: 'Konversi', value: formatNumber(totals.conversions), icon: <Target size={17} />, note: 'Sesuai definisi di laporan kanal' },
      { label: 'Biaya kampanye', value: formatRupiah(totals.spend), icon: <Layers3 size={17} />, note: 'Akumulasi biaya yang dimasukkan' },
    ].map(metric => <div className="wp-metric-card wp-card" key={metric.label}><div><span>{metric.label}</span>{metric.icon}</div><strong>{hasMetrics ? metric.value : '—'}</strong><small>{hasMetrics ? metric.note : 'Belum ada data kanal'}</small></div>)}</div>
    <div className="wp-analytics-grid"><section className="wp-card wp-channel-performance"><div className="wp-inline-heading"><div><h3>Performa per kanal</h3><p>Data yang tercatat untuk kampanye ini</p></div><BarChart3 size={18} /></div>{!hasMetrics ? <EmptyState icon={<BarChart3 size={25} />} title="Data pertama membuka cerita">Masukkan metrik dari Instagram Insights atau TikTok Analytics. Angka dan rasio akan dihitung dari data tersebut.</EmptyState> : <div className="wp-table-wrap"><table><thead><tr><th>Kanal</th><th>Impresi</th><th>Klik</th><th>CTR</th><th>Konversi</th><th>Biaya</th></tr></thead><tbody>{channelTotals.map(item => <tr key={item.name}><td><strong>{item.name}</strong><small>{item.records} entri data</small></td><td>{item.records ? formatNumber(item.impressions) : '—'}</td><td>{item.records ? formatNumber(item.clicks) : '—'}</td><td>{item.impressions > 0 ? `${(item.clicks / item.impressions * 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%` : '—'}</td><td>{item.records ? formatNumber(item.conversions) : '—'}</td><td>{item.records ? formatRupiah(item.spend) : '—'}</td></tr>)}</tbody></table></div>}</section>
      <section className="wp-card wp-team-activity"><div className="wp-inline-heading"><div><h3>Aktivitas tim</h3><p>Dari catatan kantor Anda</p></div><Users size={18} /></div><div className="wp-activity-stat"><span>Tugas disetujui</span><strong>{tasks.filter(task => task.status === 'approved').length}<small> / {tasks.length}</small></strong></div><div className="wp-progress-track"><span style={{ width: `${tasks.length ? tasks.filter(task => task.status === 'approved').length / tasks.length * 100 : 0}%` }} /></div><div className="wp-activity-row"><span>Dokumen dihasilkan</span><strong>{artifacts.length}</strong></div><div className="wp-activity-row"><span>Eksekusi AI selesai</span><strong>{runs.filter(run => run.mode === 'live' && run.status === 'completed').length}</strong></div><div className="wp-activity-row"><span>Eksekusi demo selesai</span><strong>{runs.filter(run => run.mode === 'demo' && run.status === 'completed').length}</strong></div><div className="wp-activity-row"><span>Jadwal publikasi</span><strong>{state.publications.filter(item => item.campaignId === campaignId).length}</strong></div></section></div>
    {hasMetrics && <section className="wp-metric-records wp-card"><div className="wp-inline-heading"><div><h3>Catatan sumber data</h3><p>{metrics.length} entri manual · data belum tersinkron otomatis dari platform</p></div><FileCheck2 size={18} /></div><div className="wp-table-wrap"><table><thead><tr><th>Waktu dimasukkan</th><th>Kanal</th><th>Impresi</th><th>Klik</th><th>Konversi</th><th>Biaya</th></tr></thead><tbody>{[...metrics].reverse().map(metric => <tr key={metric.id}><td>{formatDate(metric.recordedAt)}</td><td>{metric.channel}</td><td>{formatNumber(metric.impressions)}</td><td>{formatNumber(metric.clicks)}</td><td>{formatNumber(metric.conversions)}</td><td>{formatRupiah(metric.spend)}</td></tr>)}</tbody></table></div></section>}
  </>;
}

function SettingsPanel({ state, config, refresh, busy, onManageAgents }: WorkPanelsProps) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshConfig = async () => {
    setRefreshing(true);
    try { await refresh(); } catch { /* Parent handles refresh failures. */ } finally { setRefreshing(false); }
  };
  return <>
    <SectionTitle eyebrow="ATUR RUANG KERJA" title="Fondasi untuk tim Anda."
      aside={<button className="wp-button wp-button-outlined" disabled={busy || refreshing} onClick={refreshConfig}><RefreshCw size={14} className={refreshing ? 'wp-spin' : ''} /> Periksa koneksi</button>}>
      Atur koneksi model dan keahlian agen melalui tab Backend & API.
    </SectionTitle>
    <div className="wp-settings-grid"><section className="wp-card wp-settings-main"><div className="wp-inline-heading"><div><h3>Koneksi & kemampuan</h3><p>Status konfigurasi pada server kantor ini</p></div><Settings2 size={19} /></div>
      <ConnectionRow icon={<Sparkles size={22} />} name={config.aiProvider} description={`Backend utama. Provider per divisi dapat diatur terpisah. Model: ${config.aiModel || 'mengikuti konfigurasi server'}.`} configured={config.defaultAIConfigured} configuredLabel="Dikonfigurasi" unconfiguredLabel="Belum dihubungkan"><p>Endpoint, model, dan API key dapat diganti di tab Backend & API tanpa memulai ulang aplikasi. Kunci environment tetap didukung.</p><button className="wp-button wp-button-outlined" onClick={onManageAgents}><Settings2 size={14}/>Buka Backend & API</button><p className="wp-fine-print">Status ini menunjukkan ketersediaan konfigurasi. Koneksi dan akses model diverifikasi saat agen dijalankan.</p></ConnectionRow>
      <ConnectionRow icon={<ImagePlus size={22} />} name="Model Gambar" description="GPT Image, Google Imagen, Hugging Face FLUX.1, atau Qwen Image GGUF untuk tim Graphic Design." configured={config.imageConfigured} configuredLabel="Dikonfigurasi" unconfiguredLabel="Belum tersedia"><p>Model aktif: {config.imageModel}. Atur kunci dan provider di Backend & API → Model Gambar. Pembuatan gambar dimulai lewat tombol “Buat visual” di dokumen desain.</p></ConnectionRow>
      <ConnectionRow icon={<ArrowUpRight size={22} />} name="Publisher" description="TikTok Content Posting API atau konektor publikasi." configured={config.publisherConfigured||(config.tiktok.enabled&&config.tiktok.configured)} configuredLabel="Koneksi dikonfigurasi" unconfiguredLabel="Ekspor manual"><p>Token TikTok dapat diatur pada Backend & API → Publisher TikTok. Penjadwalan lokal dan ekspor paket tersedia. Untuk webhook, pengiriman eksternal memerlukan <code>MARKETING_PUBLISH_URL</code> dan kredensial konektor di environment server.</p></ConnectionRow>
      <ConnectionRow icon={<ShieldCheck size={22} />} name="Akses kantor" description="Perlindungan akses aplikasi dan endpoint kantor." configured={config.accessProtected} configuredLabel="Dilindungi" unconfiguredLabel="Mode lokal"><p>{config.accessProtected ? 'Kantor menggunakan perlindungan akses sesuai konfigurasi server.' : <>Aktifkan <code>OFFICE_ACCESS_TOKEN</code> di environment sebelum menyediakan akses publik.</>}</p></ConnectionRow>
    </section><aside className="wp-settings-aside"><section className="wp-card wp-settings-info"><div className="wp-summary-icon"><LockKeyhole size={21} /></div><h3>Kunci tetap privat.</h3><p>Simpan API key melalui Backend & API atau environment. Kunci lokal disimpan terenkripsi di server dan tidak dikembalikan ke browser.</p><div className="wp-settings-rule" /><span className="wp-small-label">SETELAH MENGUBAH KONFIGURASI</span><ol><li>Simpan melalui Backend & API.</li><li>Uji koneksi model tersimpan.</li><li>Jalankan pekerjaan berikutnya.</li></ol></section><section className="wp-settings-promise"><ShieldCheck size={20} /><h3>Dipimpin manusia.</h3><p>Agen menyiapkan pekerjaan. Marketing Manager memberi arahan, meminta revisi, dan menyetujui hasil sebelum publikasi.</p></section></aside></div>
    <section className="wp-scope wp-card"><h3>Cakupan kantor Anda</h3><div><span><Check size={15} /> 4 divisi, {state.agents.length-1} agen spesialis</span><span><Check size={15} /> Chat lintas divisi & arahan manager</span><span><Check size={15} /> Brief → riset → produksi → review</span><span><Check size={15} /> Riwayat dokumen & revisi</span><span><Check size={15} /> Jadwal lokal & ekspor kampanye</span><span><Check size={15} /> Analitik dari metrik yang dimasukkan</span></div></section>
  </>;
}

function ConnectionRow({ icon, name, description, configured, configuredLabel, unconfiguredLabel, children }: {
  icon: ReactNode; name: string; description: string; configured: boolean;
  configuredLabel: string; unconfiguredLabel: string; children: ReactNode;
}) {
  return <div className="wp-connection"><span className="wp-connection-icon">{icon}</span><div className="wp-grow"><div className="wp-connection-title"><h4>{name}</h4><span className={`wp-status ${configured ? 'wp-status-approved' : 'wp-status-pending'}`}><span className="wp-status-dot" />{configured ? configuredLabel : unconfiguredLabel}</span></div><p>{description}</p><div className="wp-connection-help">{children}</div></div></div>;
}

function TeamPanel({ state, config, onSelectAgent, onManageAgents }: WorkPanelsProps) {
  const manager = state.agents.find(agent => agent.division === 'manager');
  return <>
    <SectionTitle eyebrow="ORANG YANG TEPAT, PERAN YANG JELAS" title="Satu kantor. Banyak keahlian."
      aside={<button className="wp-button wp-button-outlined" onClick={onManageAgents}><Plus size={15}/>Tambah agen & skill</button>}>
      Kenali tim Anda. Setiap agen punya peran, konteks kerja, dan tanggung jawab sendiri.
    </SectionTitle>
    <button className="wp-manager-card wp-card" onClick={() => manager && onSelectAgent(manager.id)}><Portrait agent={manager} size={66} /><div className="wp-grow"><span className="wp-small-label">HUMAN IN THE LOOP</span><h3>Anda, Marketing Manager.</h3><p>Menetapkan arah, mengoordinasikan tim, dan memberi persetujuan akhir.</p></div><span className="wp-human-badge"><ShieldCheck size={14} /> Pengambil keputusan</span><ArrowUpRight size={19} /></button>
    <div className="wp-team-grid">{DIVISIONS.filter(division => division.id !== 'manager').map(division => <section className="wp-division-card wp-card" key={division.id} style={{ '--division-color': division.color, '--division-tint': division.tint } as CSSProperties}><header><span className="wp-division-symbol">{division.id === 'marketing' ? <Target size={20} /> : division.id === 'design' ? <WandSparkles size={20} /> : division.id === 'analytics' ? <BarChart3 size={20} /> : <CalendarClock size={20} />}</span><div><h3>{division.name}</h3><p>{division.subtitle}</p></div><span className="wp-agent-count">{state.agents.filter(agent => agent.division === division.id).length} agen</span></header><div className="wp-division-agents">{state.agents.filter(agent => agent.division === division.id).map(agent => {
      const assigned = state.tasks.filter(task => task.agentId === agent.id);
      const current = assigned.find(task => task.status === 'running');
      const statusLabel = current ? 'Sedang bekerja' : agent.status === 'review' ? 'Menunggu review' : agent.status === 'error' ? 'Perlu perhatian' : 'Siap menerima tugas';
      return <button key={agent.id} className="wp-team-agent" onClick={() => onSelectAgent(agent.id)}><Portrait agent={agent} size={54} /><span className="wp-team-agent-copy"><strong>{agent.name}</strong><span>{agent.role}</span><small><span className={`wp-agent-status-dot ${current ? 'is-working' : ''}`} />{statusLabel}</small></span><ArrowUpRight size={15} /></button>;
    })}</div><footer><span><MessageSquare size={13} /> Melapor ke Marketing Manager</span><span>{config.aiConfigured ? 'AI dikonfigurasi' : 'Mode demo tersedia'}</span></footer></section>)}</div>
    <div className="wp-team-protocol"><MessageSquare size={20} /><div><h3>Kolaborasi dengan konteks.</h3><p>Gunakan grup umum untuk arahan lintas divisi, atau ruang divisi untuk diskusi terfokus. Tugas dan hasil kerja tetap terhubung dengan brief kampanye.</p></div></div>
  </>;
}
