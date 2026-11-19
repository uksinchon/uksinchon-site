// 신촌점 유튜브 채널(영국 유학 읽어주는 남자)의 최신 쇼츠를 홈에 보여준다.
// 유튜브 공개 RSS만 사용하므로 API 키가 필요 없다. 관리자는 영상을 홈에서 숨길 수 있다.
import {esc} from './content.js';
export const CHANNEL_ID='UCImGPdQRYjZlV_3tzNAgeXg';
const FEED='https://www.youtube.com/feeds/videos.xml?channel_id='+CHANNEL_ID;
const HIDDEN_SCHEMA='CREATE TABLE IF NOT EXISTS cms_clip_hidden (video_id TEXT PRIMARY KEY, hidden_by TEXT NOT NULL, hidden_at TEXT NOT NULL)';
const ID=/^[A-Za-z0-9_-]{11}$/;
const unxml=s=>String(s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');

// 채널의 최신 영상 중 쇼츠만 (RSS의 링크가 /shorts/ 인 것)
export async function channelShorts(fetcher=fetch){
 const res=await fetcher(FEED,{cf:{cacheTtl:1800,cacheEverything:true}});
 if(!res.ok)return [];
 const xml=await res.text();
 return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m=>{
  const e=m[1];
  return {id:(e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)||[])[1],title:unxml((e.match(/<title>([^<]*)<\/title>/)||[])[1]).slice(0,120),
   published:(e.match(/<published>([^<]+)<\/published>/)||[])[1]||'',short:/<link rel="alternate" href="https:\/\/www\.youtube\.com\/shorts\//.test(e)};
 }).filter(v=>v.short&&ID.test(v.id||''));
}

export async function hiddenClips(db){
 if(!db)return new Set();
 try{await db.prepare(HIDDEN_SCHEMA).run();return new Set((await db.prepare('SELECT video_id FROM cms_clip_hidden').all()).results.map(r=>r.video_id));}
 catch{return new Set();}
}

// 홈에 넣을 HTML. 실패하거나 영상이 없으면 null (영역은 숨김 유지)
export async function homeClips(env,fetcher=fetch){
 if(env.HOME_CLIPS==='off')return null;
 try{
  const [videos,hidden]=await Promise.all([channelShorts(fetcher),hiddenClips(env.CMS_DB)]);
  const list=videos.filter(v=>!hidden.has(v.id)).slice(0,4);
  if(!list.length)return null;
  return list.map(v=>'<a class="clip" href="https://www.youtube.com/shorts/'+v.id+'" target="_blank" rel="noopener noreferrer" data-video="'+v.id+'"><img src="https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async"><span class="clip-play" aria-hidden="true">▶</span><span class="clip-title">'+esc(v.title)+'</span></a>').join('');
 }catch{return null;}
}

// 관리자: 최신 쇼츠 목록과 숨김 상태, 숨기기/다시 보이기
export async function clipsAdmin(db,parts,method,body,user,fetcher=fetch){
 await db.prepare(HIDDEN_SCHEMA).run();
 if(parts.length===1&&method==='GET'){
  const [videos,hidden]=await Promise.all([channelShorts(fetcher).catch(()=>null),hiddenClips(db)]);
  if(!videos)throw Object.assign(new Error('유튜브 채널 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),{status:502});
  return {channel:'https://www.youtube.com/channel/'+CHANNEL_ID,videos:videos.map(v=>({...v,hidden:hidden.has(v.id)}))};
 }
 const id=parts[1];
 if(parts.length===2&&method==='POST'&&ID.test(id||'')){
  if(body?.hidden===true)await db.prepare('INSERT OR REPLACE INTO cms_clip_hidden(video_id,hidden_by,hidden_at) VALUES(?,?,?)').bind(id,user.id,new Date().toISOString()).run();
  else await db.prepare('DELETE FROM cms_clip_hidden WHERE video_id=?').bind(id).run();
  return {ok:true,id,hidden:body?.hidden===true};
 }
 throw Object.assign(new Error('요청한 기능을 찾을 수 없습니다.'),{status:404});
}
