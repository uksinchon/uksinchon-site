import {esc,renderDelta,CATEGORIES,safeLink} from './content.js';
const ORIGIN='https://uksinchon.com';
const stamp=value=>value?new Date(value).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';
export function htmlResponse(html,{status=200,privatePage=false}={}) {return new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'private, no-store':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; script-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",...(privatePage?{'X-Robots-Tag':'noindex, nofollow'}:{})}});}
function shell(title,description,body,{path='/blog/',schema=null,noindex=false}={}) {
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | 영국유학센터 신촌점</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="article"><link rel="canonical" href="${esc(ORIGIN+path)}"><link rel="stylesheet" href="/blog/styles.css"><link rel="icon" href="/favicon.ico">${noindex?'<meta name="robots" content="noindex,nofollow">':''}${schema?'<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>':''}</head><body><a class="skip" href="#main">본문 바로가기</a><header class="wrap top"><a href="/" class="brand">영국유학센터 신촌점<small>UK EDUCATION CENTRE · SINCHON</small></a><nav><a href="/blog/">블로그</a><a href="https://pf.kakao.com/_VNmTxd" rel="noopener noreferrer">상담하기 ↗</a></nav></header><main id="main" class="wrap">${body}</main><footer class="wrap footer"><strong>영국유학센터 신촌점</strong><p>서울특별시 서대문구 신촌로 127, 신촌르메이르타운 3차 307호</p><p><a href="tel:+8223931030">02-393-1030</a> · <a href="/">홈페이지</a></p></footer></body></html>`;
}
export function articlePage(s,p,preview=false) {
 const created=p.published_at||p.created_at;const modified=p.content_updated_at||p.updated_at;
 const schema=preview?null:{'@context':'https://schema.org','@type':'BlogPosting',headline:s.title,description:s.summary,datePublished:created,dateModified:modified,author:{'@type':'Person',name:s.authorName},publisher:{'@type':'Organization',name:'영국유학센터 신촌점',url:ORIGIN},mainEntityOfPage:ORIGIN+'/blog/'+p.slug+'/'};
 const sources=s.sources?s.sources.split('\n').filter(safeLink):[];
 const body=`${preview?'<aside class="preview-note">비공개 미리보기입니다. 저장된 현재 초안이며 공개본은 바뀌지 않았습니다.</aside>':''}<article class="article"><a class="back" href="/blog/">← 전체 글</a><p class="eyebrow">${esc(s.category)}</p><h1>${esc(s.title||'제목 없는 초안')}</h1><p class="summary">${esc(s.summary)}</p><p class="byline">${esc(s.authorName)} · 발행 ${esc(stamp(created))}${modified&&modified!==created?' · 수정 '+esc(stamp(modified)):''}</p><div class="article-body">${renderDelta(s.delta)}</div>${sources.length?'<section class="sources"><h2>출처·참고 자료</h2><ul>'+sources.map(url=>'<li><a href="'+esc(url)+'" rel="noopener noreferrer">'+esc(url)+'</a></li>').join('')+'</ul>'+(s.verifiedAt?'<p>정보 확인일: '+esc(s.verifiedAt)+'</p>':'')+'</section>':''}<aside class="consult"><h2>내 조건에 맞는 준비가 궁금하신가요?</h2><p>현재 학력, 희망 과정과 입학 시기를 알려주시면 다음 준비를 함께 정리해 드립니다.</p><a class="button" href="https://pf.kakao.com/_VNmTxd" rel="noopener noreferrer">카카오톡으로 상담하기 ↗</a></aside></article>`;
 return htmlResponse(shell(s.title||'초안 미리보기',s.summary,body,{path:'/blog/'+p.slug+'/',schema,noindex:preview}),{privatePage:preview});
}
export async function publicBlog({request,env}) {
 const url=new URL(request.url);const slug=url.pathname.replace(/^\/blog\/?/,'').replace(/\/$/,'');
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405});
 if(!env.CMS_DB)return htmlResponse(shell('블로그 준비 중','영국유학센터 신촌점 블로그','<section class="empty"><h1>블로그를 준비하고 있습니다.</h1><p>지금 상담은 홈페이지에서 이용하실 수 있습니다.</p><a href="/">홈으로</a></section>',{noindex:true}),{status:503});
 try {
  if(slug){
   const p=await env.CMS_DB.prepare('SELECT p.*,v.snapshot,v.created_at AS content_updated_at FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision WHERE p.slug=?').bind(slug).first();
   if(!p)return htmlResponse(shell('글을 찾을 수 없습니다','','<section class="empty"><h1>글을 찾을 수 없습니다.</h1><a href="/blog/">블로그 목록으로</a></section>',{noindex:true}),{status:404});
   return articlePage(JSON.parse(p.snapshot),p);
  }
  const category=CATEGORIES.includes(url.searchParams.get('category'))?url.searchParams.get('category'):'';
  const page=Math.max(1,Math.min(10000,Math.floor(Number(url.searchParams.get('page'))||1)));let query='SELECT p.slug,p.published_at,v.snapshot,v.created_at AS content_updated_at FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision';const args=[];
  if(category){query+=" WHERE json_extract(v.snapshot,'$.category')=?";args.push(category);}
  query+=' ORDER BY p.published_at DESC LIMIT 13 OFFSET ?';args.push((page-1)*12);
  const rows=(await env.CMS_DB.prepare(query).bind(...args).all()).results;
  const cards=rows.slice(0,12).map(row=>{const s=JSON.parse(row.snapshot);return `<article class="post-card"><p class="eyebrow">${esc(s.category)}</p><h2><a href="/blog/${esc(row.slug)}/">${esc(s.title)}</a></h2><p>${esc(s.summary)}</p><small>${esc(s.authorName)} · ${esc(stamp(row.published_at))}</small></article>`;}).join('');
  const paging=n=>'/blog/?'+new URLSearchParams({...category?{category}:{},page:n});
  const body=`<section class="intro"><p class="eyebrow">FROM OUR CONSULTATIONS</p><h1>영국 유학, 궁금한 것부터 차근차근.</h1><p>신촌점에서 전하는 준비 안내와 상담 이야기입니다.</p></section><nav class="categories" aria-label="글 주제"><a href="/blog/" ${!category?'aria-current="page"':''}>전체</a>${CATEGORIES.map(c=>'<a href="/blog/?category='+encodeURIComponent(c)+'" '+(category===c?'aria-current="page"':'')+'>'+esc(c)+'</a>').join('')}</nav><section class="post-list">${cards||'<p class="empty">아직 공개된 글이 없습니다. 첫 이야기를 준비하고 있습니다.</p>'}</section><nav class="pagination">${page>1?'<a rel="prev" href="'+esc(paging(page-1))+'">← 이전</a>':''}${rows.length>12?'<a rel="next" href="'+esc(paging(page+1))+'">다음 →</a>':''}</nav>`;
  return htmlResponse(shell('신촌점 블로그','영국유학센터 신촌점의 어학연수·대학·대학원·비용 안내와 상담 이야기',body,{path:page>1?'/blog/?page='+page:'/blog/',noindex:!!category||!rows.length}));
 }catch(e){console.error('Blog read failed',e?.name);return htmlResponse(shell('블로그 준비 중','','<section class="empty"><h1>블로그를 준비하고 있습니다.</h1><a href="/">홈페이지에서 상담하기</a></section>',{noindex:true}),{status:503});}
}
export async function publishedURLs(db){if(!db)return [];try{return (await db.prepare('SELECT p.slug,v.created_at FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision ORDER BY p.published_at DESC').all()).results;}catch{return [];}}
export {ORIGIN};
