'use client';
import {useState,type FormEvent} from 'react';
import type {OfficeAction} from '@/lib/office/types';
import {loadTikTokCreator,type TikTokCreator} from './TikTokSettings';
const PRIVACY:Record<string,string>={PUBLIC_TO_EVERYONE:'Publik',MUTUAL_FOLLOW_FRIENDS:'Teman saling mengikuti',FOLLOWER_OF_CREATOR:'Pengikut',SELF_ONLY:'Hanya saya'};
export default function TikTokPublishForm({publicationId,busy,ready,action}:{publicationId:string;busy:boolean;ready:boolean;action:(a:OfficeAction)=>Promise<void>}){
 const [creator,setCreator]=useState<TikTokCreator|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const [videoUrl,setVideoUrl]=useState('');const [title,setTitle]=useState('');const [privacy,setPrivacy]=useState('');const [consent,setConsent]=useState(false);
 const [comments,setComments]=useState(false);const [duet,setDuet]=useState(false);const [stitch,setStitch]=useState(false);const [organic,setOrganic]=useState(false);const [branded,setBranded]=useState(false);
 async function load(){setLoading(true);setError('');setPrivacy('');setConsent(false);try{setCreator(await loadTikTokCreator());}catch(err){setCreator(null);setError(err instanceof Error?err.message:'Akun belum tersedia.');}finally{setLoading(false);}}
 async function submit(e:FormEvent){e.preventDefault();if(!consent)return;setError('');try{await action({type:'publishTikTok',publicationId,videoUrl,title,privacyLevel:privacy,consent:true,disableComment:!comments,disableDuet:!duet,disableStitch:!stitch,brandOrganic:organic,brandContent:branded});}catch(err){setError(err instanceof Error?err.message:'Pengiriman belum berhasil.');}}
 return <form className="backend-card tiktok-publish-form" onSubmit={submit} data-testid="tiktok-publish-form"><h3>Publish video TikTok</h3><p className="backend-footnote">URL video final harus tersedia pada domain/prefix yang diverifikasi di aplikasi TikTok. Pengiriman hanya dapat dilakukan saat atau setelah jadwal tiba. Setelah dikirim, TikTok memproses video; periksa status untuk konfirmasi tayang.</p><button type="button" className="button secondary" data-testid="tiktok-load-creator" onClick={()=>void load()} disabled={busy||loading}>{loading?'Memuat…':'Muat akun & pilihan privasi'}</button>
 {creator&&<><p className="backend-footnote">Akun tujuan: <strong>{creator.creator_nickname} (@{creator.creator_username})</strong> · maksimum {creator.max_video_post_duration_sec} detik</p>
 <label>URL video HTTPS<input data-testid="tiktok-video-url" type="url" required maxLength={2000} value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://domain-terverifikasi.example/video.mp4"/></label>
 <label>Caption final<textarea data-testid="tiktok-title" required maxLength={2200} value={title} onChange={e=>setTitle(e.target.value)} rows={3}/></label>
 <label>Privasi<select required data-testid="tiktok-privacy" value={privacy} onChange={e=>setPrivacy(e.target.value)}><option value="">Pilih privasi…</option>{creator.privacy_level_options.map(p=><option value={p} key={p}>{PRIVACY[p]||p}</option>)}</select></label>
 <label className="backend-checkbox"><input type="checkbox" checked={comments} disabled={creator.comment_disabled} onChange={e=>setComments(e.target.checked)}/>Izinkan komentar</label>
 <label className="backend-checkbox"><input type="checkbox" checked={duet} disabled={creator.duet_disabled} onChange={e=>setDuet(e.target.checked)}/>Izinkan Duet</label>
 <label className="backend-checkbox"><input type="checkbox" checked={stitch} disabled={creator.stitch_disabled} onChange={e=>setStitch(e.target.checked)}/>Izinkan Stitch</label>
 <label className="backend-checkbox"><input type="checkbox" checked={organic} onChange={e=>setOrganic(e.target.checked)}/>Konten mempromosikan bisnis saya</label>
 <label className="backend-checkbox"><input type="checkbox" checked={branded} onChange={e=>setBranded(e.target.checked)}/>Konten berbayar / kerja sama brand lain (tidak dapat privat)</label>
 <label className="backend-checkbox"><input data-testid="tiktok-consent" type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>Sebagai Marketing Manager, saya menyetujui video, caption, akun, dan privasi yang dipilih serta penggunaan musik sesuai <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">Music Usage Confirmation TikTok</a>.</label>
 <button type="submit" data-testid="tiktok-submit" className="button primary" disabled={busy||!ready||!privacy||!consent}>Kirim video ke TikTok</button></>}
 {error&&<p className="backend-error" role="alert">{error}</p>}
 </form>;
}
