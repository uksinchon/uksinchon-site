import {esc} from './content.js';
import {publicAuthor} from './pages.js';

// Only approved snapshots are projected; private draft titles never reach the home page.
export async function recentHomeNotes(db) {
 if(!db)return null;
 try {
  const {results}=await db.prepare(`SELECT p.slug,p.published_at,
   json_extract(v.snapshot,'$.title') AS title,json_extract(v.snapshot,'$.summary') AS summary,
   json_extract(v.snapshot,'$.category') AS category,json_extract(v.snapshot,'$.authorName') AS author_name
   FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision
   ORDER BY p.published_at DESC,p.id DESC LIMIT 3`).all();
  const rows=(results||[]).filter(p=>typeof p.title==='string'&&p.title.trim()&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(p.slug));
  if(!rows.length)return null;
  return rows.map(p=>{
   const date=p.published_at&&Number.isFinite(Date.parse(p.published_at))?new Date(p.published_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';
   const byline=esc(publicAuthor({authorName:p.author_name}).name)+(date?' · 발행 <time datetime="'+esc(p.published_at)+'">'+esc(date)+'</time>':'');
   return '<article class="note-card"><span class="tag">'+esc(String(p.category||'신촌 UK 노트').slice(0,80))+'</span><h3><a href="/blog/'+esc(p.slug)+'/">'+esc(p.title.slice(0,180))+'</a></h3><p>'+esc(String(p.summary||'').slice(0,240))+'</p><span class="note-meta">'+byline+'</span></article>';
  }).join('');
 }catch{return null;}
}

export async function homePage({request,env,next}) {
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 // Pages context.next serves the static template without another route lookup or binding.
 const asset=await next(new Request(request.url,{method:'GET'}));
 if(asset.status!==200||!asset.headers.get('Content-Type')?.includes('text/html'))return request.method==='HEAD'?new Response(null,{status:asset.status,headers:asset.headers}):asset;
 const template=await asset.text(),notes=await recentHomeNotes(env.CMS_DB);
 const html=notes?template.replace(/<!--home-notes:start-->[\s\S]*?<!--home-notes:end-->/,()=>'<!--home-notes:start-->'+notes+'<!--home-notes:end-->'):template;
 const headers=new Headers(asset.headers);
 for(const name of ['Content-Length','Content-Encoding','ETag','Last-Modified','Age'])headers.delete(name);
 headers.set('Cache-Control','public, max-age=0, must-revalidate');headers.set('Content-Type','text/html; charset=utf-8');headers.set('X-Content-Type-Options','nosniff');
 return new Response(request.method==='HEAD'?null:html,{status:200,headers});
}
