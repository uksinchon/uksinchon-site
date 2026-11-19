import {esc,imageIds} from './content.js';
import {publicAuthor} from './pages.js';
import {homeClips} from './clips.js';

// Only approved snapshots are projected; private draft titles never reach the home page.
export async function recentHomeNotes(db) {
 if(!db)return null;
 try {
  const {results}=await db.prepare(`SELECT p.id,p.slug,p.published_at,v.snapshot,
   json_extract(v.snapshot,'$.title') AS title,json_extract(v.snapshot,'$.summary') AS summary,
   json_extract(v.snapshot,'$.category') AS category,json_extract(v.snapshot,'$.authorName') AS author_name
   FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision
   ORDER BY p.published_at DESC,p.id DESC LIMIT 3`).all();
  const rows=(results||[]).filter(p=>typeof p.title==='string'&&p.title.trim()&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(p.slug));
  if(!rows.length)return null;
  const images=new Map();
  for(const p of rows)images.set(p.id,await noteImage(db,p));
  return rows.map(p=>{
   const date=p.published_at&&Number.isFinite(Date.parse(p.published_at))?new Date(p.published_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';
   const byline=esc(publicAuthor({authorName:p.author_name}).name)+(date?' · 발행 <time datetime="'+esc(p.published_at)+'">'+esc(date)+'</time>':'');
   const img=images.get(p.id),href='/blog/'+esc(p.slug)+'/';
   const thumb=img?'<a class="note-thumb" href="'+href+'" tabindex="-1" aria-hidden="true"><img src="/media/'+esc(img.id)+'" alt="" loading="lazy" decoding="async"></a>':'<a class="note-thumb note-thumb-empty" href="'+href+'" tabindex="-1" aria-hidden="true"><span>SINCHON UK NOTE</span></a>';
   return '<article class="note-card">'+thumb+'<span class="tag">'+esc(String(p.category||'신촌 UK 노트').slice(0,80))+'</span><h3><a href="/blog/'+esc(p.slug)+'/">'+esc(p.title.slice(0,180))+'</a></h3><p>'+esc(String(p.summary||'').slice(0,240))+'</p><span class="note-meta">'+byline+'</span></article>';
  }).join('');
 }catch{return null;}
}

// A published, non-decorative photo for the card: the chosen hero image first, else the first photo in the text.
async function noteImage(db,p){
 try{
  const snap=JSON.parse(p.snapshot||'{}');const meta=snap.imageMeta||{};
  const ids=[snap.heroImageId,...(snap.delta?.ops?imageIds(snap):[])].filter((id,i,a)=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)&&a.indexOf(id)===i&&!meta[id]?.decorative);
  for(const id of ids){if(await db.prepare('SELECT 1 FROM cms_public_media WHERE post_id=? AND media_id=?').bind(p.id,id).first())return {id};}
 }catch{}
 return null;
}

export async function homePage({request,env,next}) {
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 // Pages context.next serves the static template without another route lookup or binding.
 const asset=await next(new Request(request.url,{method:'GET'}));
 if(asset.status!==200||!asset.headers.get('Content-Type')?.includes('text/html'))return request.method==='HEAD'?new Response(null,{status:asset.status,headers:asset.headers}):asset;
 const template=await asset.text(),[notes,clips]=await Promise.all([recentHomeNotes(env.CMS_DB),homeClips(env)]);
 let html=notes?template.replace(/<!--home-notes:start-->[\s\S]*?<!--home-notes:end-->/,()=>'<!--home-notes:start-->'+notes+'<!--home-notes:end-->'):template;
 if(clips)html=html.replace(/<!--home-clips:start-->[\s\S]*?<!--home-clips:end-->/,()=>'<!--home-clips:start-->'+clips+'<!--home-clips:end-->').replace('<section id="clips" class="section soft" aria-labelledby="clips-title" hidden>','<section id="clips" class="section soft" aria-labelledby="clips-title">');
 const headers=new Headers(asset.headers);
 for(const name of ['Content-Length','Content-Encoding','ETag','Last-Modified','Age'])headers.delete(name);
 headers.set('Cache-Control','public, max-age=0, must-revalidate');headers.set('Content-Type','text/html; charset=utf-8');headers.set('X-Content-Type-Options','nosniff');
 return new Response(request.method==='HEAD'?null:html,{status:200,headers});
}
