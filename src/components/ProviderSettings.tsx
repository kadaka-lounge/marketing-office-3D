'use client';
import {useState,type FormEvent} from 'react';
import {Check,KeyRound,Save,ShieldCheck,Sparkles} from 'lucide-react';
import type {OfficeAction,OfficeConfig,ProviderId} from '@/lib/office/types';
interface Props {config:OfficeConfig;busy:boolean;action:(action:OfficeAction)=>Promise<void>}
const DETAILS:Record<ProviderId,{name:string;division:string;description:string;endpoint:string}>={
 claude:{name:'Claude · Anthropic',division:'Data Analyst',description:'Atlas, Nova, dan agen tambahan Data Analyst memakai Claude saat koneksi ini aktif.',endpoint:'https://api.anthropic.com/v1/messages'},
 gemini:{name:'Gemini · Google',division:'Graphic Design · Luna',description:'Luna dan agen tambahan Graphic Design memakai Gemini untuk brief, arahan visual, dan spesifikasi desain.',endpoint:'https://generativelanguage.googleapis.com/v1beta'},
 openai:{name:'ChatGPT · OpenAI API',division:'Graphic Design · Pixel',description:'Pixel memakai OpenAI. Jika Gemini dinonaktifkan, seluruh agen Graphic Design memakai OpenAI. Kunci ini juga tersedia untuk GPT Image; langganan ChatGPT berbeda dari akses API.',endpoint:'https://api.openai.com/v1'},
};
export default function ProviderSettings(props:Props){
 return <div><p className="backend-footnote">Aktifkan provider untuk mengganti backend utama pada divisi tersebut. Provider aktif tanpa kunci akan menghentikan tugas dengan pesan konfigurasi. Digital Marketing dan pekerjaan teks Publisher tetap memakai backend utama. Jika provider divisi dinonaktifkan, agen kembali memakai backend utama yang dipilih.</p><div className="backend-grid">{props.config.providers.map(p=><CredentialCard key={p.provider} {...props} provider={p.provider}/>)}<CredentialCard {...props} provider="meta"/></div></div>;
}
function CredentialCard({provider,config,busy,action}:Props&{provider:ProviderId|'meta'}){
 const meta=provider==='meta';const status=meta?config.meta:config.providers.find(p=>p.provider===provider)!;
 const info=meta?{name:'Meta · Instagram / Facebook',division:'Publisher',description:'Token Meta Graph (Facebook Login) untuk menguji identitas akun Instagram/Facebook yang terhubung. Token sosial ini bukan API model AI. Uji identitas tidak memverifikasi izin publikasi atau mengunggah konten.',endpoint:'https://graph.facebook.com/v23.0/me'}:DETAILS[provider];
 const [model,setModel]=useState<string>(config.providers.find(p=>p.provider===provider)?.model||'');
 const [enabled,setEnabled]=useState(status.enabled);const [apiKey,setApiKey]=useState('');const [clearKey,setClearKey]=useState(false);
 const [testing,setTesting]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 async function save(event:FormEvent){
  event.preventDefault();setError('');setMessage('');
  const credentials={enabled,...(apiKey?{apiKey}:{}),clearKey};
  try{
   await action(meta?{type:'saveMeta',settings:credentials}:{type:'saveProvider',provider,settings:{...credentials,model}});
   setMessage('Konfigurasi tersimpan. Kunci tetap hanya di server.');setClearKey(false);
  }catch(err){setError(err instanceof Error?err.message:'Konfigurasi belum tersimpan.');}finally{setApiKey('');}
 }
 async function test(){
  setTesting(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/office/providers/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Koneksi gagal.');
   setMessage(meta?`Token valid untuk ${result.account.name} (${result.account.id}). Belum ada konten dipublikasikan.`:`Koneksi berhasil. Model ${result.model} mengembalikan teks.`);
  }catch(err){setError(err instanceof Error?err.message:'Koneksi gagal.');}finally{setTesting(false);}
 }
 return <form className="backend-card" onSubmit={save} data-testid={`provider-${provider}`}>
  <div className="backend-card-title"><span className="backend-icon"><KeyRound size={21}/></span><div><h3>{info.name}</h3><p>{info.division}</p></div><span className={`backend-status ${status.enabled&&status.configured?'connected':''}`}>{status.enabled&&status.configured?'Dikonfigurasi':status.enabled?'Kunci diperlukan':'Nonaktif'}</span></div>
  <p className="backend-footnote">{info.description}</p>
  <label className="backend-checkbox"><input type="checkbox" data-testid={`${provider}-enabled`} checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Aktifkan {meta?'koneksi Meta':'provider divisi'}</label>
  {!meta&&<label>Model<input required data-testid={`${provider}-model`} maxLength={160} value={model} onChange={e=>setModel(e.target.value)}/><small>Gunakan ID model yang tersedia pada akun API Anda.</small></label>}
  <label>{meta?'Token Meta baru':'API key baru'}<input type="password" data-testid={`${provider}-key`} autoComplete="new-password" spellCheck={false} maxLength={4096} value={apiKey} onChange={e=>{setApiKey(e.target.value);if(e.target.value)setClearKey(false);}} placeholder="Kosongkan untuk mempertahankan kunci tersimpan"/></label>
  <label className="backend-checkbox"><input type="checkbox" data-testid={`${provider}-clear`} checked={clearKey} onChange={e=>{setClearKey(e.target.checked);if(e.target.checked)setApiKey('');}}/>Hapus kunci dan nonaktifkan kunci environment</label>
  <div className="backend-key-state"><ShieldCheck size={14}/>{status.keySource==='stored'?'Kunci terenkripsi tersimpan':status.keySource==='environment'?'Kunci dari environment':'Belum ada kunci'}</div>
  <p className="backend-footnote">Endpoint tetap: {info.endpoint}</p>
  {meta&&<p className="backend-footnote">Publikasi tetap melalui ekspor manual atau webhook Publisher dengan tindakan Marketing Manager. Token ini tidak mengaktifkan publikasi langsung. Atur koneksi TikTok melalui tab Publisher TikTok.</p>}
  {error&&<p className="backend-error" role="alert">{error}</p>}{message&&<p className="backend-success" role="status"><Check size={15}/>{message}</p>}
  <div className="backend-actions"><button className="button secondary" data-testid={`${provider}-test`} type="button" onClick={()=>void test()} disabled={busy||testing||!status.enabled||!status.configured}><Sparkles size={15}/>{testing?'Menguji…':'Uji koneksi tersimpan'}</button><button className="button primary" data-testid={`${provider}-save`} type="submit" disabled={busy||testing}><Save size={15}/>Simpan {meta?'token':'provider'}</button></div>
 </form>;
}
