// 홈 "지금 가장 많이 묻는 영국유학" 카드 3개. 관리자가 카드마다 연결할 공개 노트와 문구를 고른다.
// 설정이 없거나 연결한 노트가 비공개·휴지통이면 index.html의 기본 카드를 그대로 쓴다.
import {esc} from './content.js';
import {TRASH_SCHEMA} from './schema.js';
const SCHEMA="CREATE TABLE IF NOT EXISTS cms_home_season (slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 3), post_id TEXT, tag TEXT NOT NULL DEFAULT '', headline TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', updated_at TEXT, updated_by TEXT)";
// 카드 배경 사진은 자리마다 고정 (노트 이미지는 글씨가 많아 카드 배경으로 쓰지 않음)
export const SLOT_PHOTOS=[
 {src:'/assets/home/manchester.webp',w:760,h:506},
 {src:'/assets/home/ucl.webp',w:760,h:506},
 {src:'/assets/home/students-lunch.webp',w:600,h:400}];
const PUBLISHED=`SELECT p.id,p.slug,json_extract(v.snapshot,'$.title') AS title,json_extract(v.snapshot,'$.summary') AS summary,json_extract(v.snapshot,'$.category') AS category,p.published_at
 FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision
 WHERE p.published_revision IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cms_post_trash t WHERE t.post_id=p.id)`;
const clean=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);

export function seasonCard(slot,c){
 const ph=SLOT_PHOTOS[slot-1];
 return '<a class="season-card" href="/blog/'+esc(c.slug)+'/"><img src="'+ph.src+'" alt="" width="'+ph.w+'" height="'+ph.h+'" loading="lazy" decoding="async"><span class="season-body"><span class="tag">'+esc(c.tag||c.category||'신촌 UK 노트')+'</span><strong>'+esc(c.headline||c.title)+'</strong><span class="season-text">'+esc(c.body||c.summary||'')+'</span><span class="go">노트 읽기 →</span></span></a>';
}

// 홈 렌더링용: {1:html,2:html,...} (설정된 자리만)
export async function homeSeason(db){
 if(!db)return null;
 try{
  // 홈 읽기에서는 테이블을 만들지 않는다. 아직 설정 전이면 오류 → 기본 카드
  const {results}=await db.prepare(`SELECT s.slot,s.tag,s.headline,s.body,x.slug,x.title,x.summary,x.category FROM cms_home_season s JOIN (${PUBLISHED}) x ON x.id=s.post_id ORDER BY s.slot`).all();
  const out={};for(const r of results||[])if(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(r.slug))out[r.slot]=seasonCard(r.slot,r);
  return Object.keys(out).length?out:null;
 }catch{return null;}
}

export async function seasonAdmin(db,parts,method,body,user){
 await db.batch([db.prepare(SCHEMA),db.prepare(TRASH_SCHEMA)]);
 if(parts.length===1&&method==='GET'){
  const slots=(await db.prepare('SELECT slot,post_id,tag,headline,body,updated_at FROM cms_home_season ORDER BY slot').all()).results||[];
  const posts=(await db.prepare(PUBLISHED+' ORDER BY p.published_at DESC LIMIT 200').all()).results||[];
  return {slots,posts};
 }
 const slot=Number(parts[1]);
 if(parts.length===2&&method==='PUT'&&[1,2,3].includes(slot)){
  const postId=body?.postId?String(body.postId):null;
  if(postId){
   const ok=await db.prepare(PUBLISHED+' AND p.id=?').bind(postId).first();
   if(!ok)throw Object.assign(new Error('공개된 노트만 연결할 수 있습니다. 노트를 먼저 공개해 주세요.'),{status:400});
  }
  if(!postId){await db.prepare('DELETE FROM cms_home_season WHERE slot=?').bind(slot).run();return {ok:true,slot,reset:true};}
  await db.prepare('INSERT OR REPLACE INTO cms_home_season(slot,post_id,tag,headline,body,updated_at,updated_by) VALUES(?,?,?,?,?,?,?)')
   .bind(slot,postId,clean(body.tag,30),clean(body.headline,80),clean(body.body,160),new Date().toISOString(),user.id).run();
  return {ok:true,slot};
 }
 throw Object.assign(new Error('요청한 기능을 찾을 수 없습니다.'),{status:404});
}
