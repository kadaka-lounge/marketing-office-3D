import {z} from 'zod';
import {tiktokConnection} from './backend';
import {OfficeError} from './validation';
import type {OfficeAction} from '../types';
const API='https://open.tiktokapis.com/v2/post/publish';
export class TikTokRejected extends OfficeError {}
async function request(endpoint:string,body:unknown){
 const connection=tiktokConnection();
 if(!connection.enabled||!connection.key)throw new OfficeError('Aktifkan dan simpan access token TikTok di Backend & API → Publisher TikTok.',409);
 let response:Response;
 try{response=await fetch(`${API}/${endpoint}/`,{method:'POST',headers:{Authorization:`Bearer ${connection.key}`,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(60000)});}
 catch{throw new OfficeError('Koneksi TikTok terputus. Jika pengiriman sudah dimulai, periksa akun TikTok sebelum membuat pengiriman baru.',502);}
 if(!response.ok){
  const message=`TikTok gagal (HTTP ${response.status}). Periksa token, scope video.publish, akses aplikasi, dan kuota.`;
  if(response.status>=400&&response.status<500&&response.status!==408)throw new TikTokRejected(message,409);
  throw new OfficeError(message,502);
 }
 let payload;
 try{payload=await response.json();}catch{throw new OfficeError('Respons TikTok tidak valid; periksa status pengiriman sebelum mencoba kembali.',502);}
 if(typeof payload?.error?.code!=='string')throw new OfficeError('Respons TikTok tidak menyertakan konfirmasi yang valid.',502);
 if(['internal_error','timeout'].includes(payload.error.code))throw new OfficeError('TikTok belum dapat memastikan hasil permintaan. Periksa status pengiriman sebelum mencoba kembali.',502);
 if(payload.error.code!=='ok')throw new TikTokRejected('TikTok menolak permintaan. Periksa scope, masa berlaku token, izin aplikasi, domain video, dan pengaturan akun.',409);
 return payload.data;
}
const creatorSchema=z.object({creator_username:z.string().max(200),creator_nickname:z.string().max(200),privacy_level_options:z.array(z.enum(['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'])).min(1),comment_disabled:z.boolean(),duet_disabled:z.boolean(),stitch_disabled:z.boolean(),max_video_post_duration_sec:z.number().positive()});
export async function tiktokCreator(){
 const result=creatorSchema.safeParse(await request('creator_info/query',{}));
 if(!result.success)throw new OfficeError('TikTok tidak mengembalikan informasi creator yang valid.',502);
 return result.data;
}
export type TikTokPost=Extract<OfficeAction,{type:'publishTikTok'}>;
export async function validateTikTokPost(post:TikTokPost){
 const creator=await tiktokCreator();
 if(!creator.privacy_level_options.includes(post.privacyLevel as typeof creator.privacy_level_options[number]))throw new OfficeError('Pilihan privasi tidak tersedia pada akun TikTok ini. Muat ulang informasi creator.',409);
 if(post.brandContent&&post.privacyLevel==='SELF_ONLY')throw new OfficeError('Konten berbayar tidak dapat memakai privasi Hanya saya.',409);
 return creator;
}
export async function initializeTikTokPost(post:TikTokPost,creator:Awaited<ReturnType<typeof tiktokCreator>>){
 const data=await request('video/init',{post_info:{title:post.title,privacy_level:post.privacyLevel,disable_comment:creator.comment_disabled||post.disableComment,disable_duet:creator.duet_disabled||post.disableDuet,disable_stitch:creator.stitch_disabled||post.disableStitch,brand_organic_toggle:post.brandOrganic,brand_content_toggle:post.brandContent},source_info:{source:'PULL_FROM_URL',video_url:post.videoUrl}});
 if(typeof data?.publish_id!=='string'||!data.publish_id||data.publish_id.length>300)throw new OfficeError('TikTok belum memberikan ID pengiriman. Periksa akun sebelum mengirim lagi.',502);
 return data.publish_id as string;
}
export async function tiktokPostStatus(publishId:string){
 const data=await request('status/fetch',{publish_id:publishId});
 if(!['PUBLISH_COMPLETE','FAILED','PROCESSING_UPLOAD','PROCESSING_DOWNLOAD','SEND_TO_USER_INBOX'].includes(data?.status))throw new OfficeError('Status TikTok belum dikenal. Pengiriman tetap dicatat sebagai sedang diproses.',502);
 return data.status as string;
}
