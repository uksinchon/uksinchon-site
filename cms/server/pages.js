import {esc,renderDelta,CATEGORY_DEFINITIONS,safeLink,todayKorea} from './content.js';
import {publicationDates} from './publication.js';
const ORIGIN='https://uksinchon.com';
const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';
const time=(value,label)=>value?`${label} <time datetime="${esc(value)}">${esc(stamp(value))}</time>`:'';
const slugPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
export function htmlResponse(html,{status=200,privatePage=false}={}) {
 return new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'private, no-store':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",...(privatePage?{'X-Robots-Tag':'noindex, nofollow'}:{})}});
}
function shell(title,description,body,{path='/blog/',schema=null,robots='',article=false,image=null}={}) {
 const metaImage=image?`<meta property="og:image" content="${esc(image.url)}"><meta property="og:image:alt" content="${esc(image.alt)}"><meta name="twitter:card" content="summary_large_image">`:'';
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | 영국유학센터 신촌점</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${article?'article':'website'}"><meta property="og:url" content="${esc(ORIGIN+path)}"><meta property="og:locale" content="ko_KR">${metaImage}<link rel="canonical" href="${esc(ORIGIN+path)}"><link rel="stylesheet" href="/blog/styles.css"><link rel="icon" href="/favicon.ico">${robots?'<meta name="robots" content="'+esc(robots)+'">':''}${article?'<script defer src="/assets/blog-edit.js"></script>':''}${schema?'<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>':''}</head><body><a class="skip" href="#main">본문 바로가기</a><header class="wrap top"><a href="/" class="brand">영국유학센터 신촌점<small>UK EDUCATION CENTRE · SINCHON</small></a><nav aria-label="주요 메뉴"><a href="/blog/">블로그</a><a href="https://pf.kakao.com/_VNmTxd" rel="noopener noreferrer">상담하기 ↗</a></nav></header><main id="main" class="wrap">${body}</main><footer class="wrap footer"><strong>영국유학센터 신촌점</strong><p>서울특별시 서대문구 신촌로 127, 신촌르메이르타운 3차 307호</p><p><a href="tel:+8223931030">02-393-1030</a> · <a href="/">홈페이지</a></p></footer></body></html>`;
}
function sourcesHTML(s) {
 const urls=s.sources?s.sources.split('\n').filter(safeLink):[];if(!urls.length)return '';
 const details=new Map((s.sourceDetails||[]).map(x=>[x.url,x]));
 return '<section class="sources"><h2>출처·참고 자료</h2><ul>'+urls.map(url=>{
  const item=details.get(url);return '<li><a href="'+esc(url)+'" rel="noopener noreferrer">'+esc(item?.title||url)+'</a>'+(item?.publisher?' · '+esc(item.publisher):'')+(item?.kind==='official'?' <span class="source-kind">공식 자료</span>':'')+'</li>';
 }).join('')+'</ul>'+(!s.publication&&s.verifiedAt&&s.schemaVersion!==2?'<p>원고에 기재된 정보 확인일: '+esc(s.verifiedAt)+'</p>':'')+'</section>';
}
export function articlePage(s,p,preview=false,{related=[]}={}) {
 const {publishedAt,modifiedAt}=publicationDates(s,p),path='/blog/'+p.slug+'/';
 const checked=!preview?s.publication?.factCheck:null;
 const hero=s.heroImageId&&s.imageMeta?.[s.heroImageId]&&!s.imageMeta[s.heroImageId].decorative?{url:ORIGIN+'/media/'+s.heroImageId,alt:s.imageMeta[s.heroImageId].alt||''}:null;
 const article={'@type':['guide','comparison'].includes(s.contentType)?'Article':'BlogPosting','@id':ORIGIN+path+'#article',headline:s.title,description:s.summary,
  ...(publishedAt?{datePublished:publishedAt}:{}),...(modifiedAt?{dateModified:modifiedAt}:{}),...(hero?{image:[hero.url]}:{}),
  author:{'@type':'Person',name:s.authorName,...(s.publication?.authorId?{'@id':ORIGIN+'/#author-'+s.publication.authorId}:{})},
  publisher:{'@type':'Organization','@id':ORIGIN+'/#organization',name:'영국유학센터 신촌점',url:ORIGIN,logo:{'@type':'ImageObject',url:ORIGIN+'/logo.png'}},mainEntityOfPage:ORIGIN+path};
 const breadcrumbs={'@type':'BreadcrumbList',itemListElement:[{name:'홈',item:ORIGIN+'/'},{name:'블로그',item:ORIGIN+'/blog/'},{name:s.title,item:ORIGIN+path}].map((x,i)=>({'@type':'ListItem',position:i+1,...x}))};
 const schema=preview?null:{'@context':'https://schema.org','@graph':[article,breadcrumbs]};
 const byline=preview?esc(s.authorName)+' · 공개 전 초안':esc(s.authorName)+' · '+time(publishedAt,'최초 발행')+(modifiedAt&&modifiedAt!==publishedAt?' · '+time(modifiedAt,'내용 수정'):'');
 const review=checked?`<section class="fact-review" aria-label="자료 확인"><p>${time(checked.checkedAt,'마지막 사실 확인')} · 검토 ${esc(checked.reviewerName)}</p><p>확인 범위: ${esc(checked.scope)}</p></section>`:'';
 const due=!preview&&s.reviewDueAt&&s.reviewDueAt<todayKorea()?'<p class="freshness-note">이 안내의 재확인 시점이 지났습니다. 현재 적용 조건은 공식 자료와 상담으로 다시 확인해 주세요.</p>':'';
 const relatedHTML=related.length?'<nav class="related" aria-label="함께 읽을 글"><h2>다음 질문도 함께 살펴보세요</h2><ul>'+related.map(row=>'<li><a href="/blog/'+esc(row.slug)+'/">'+esc(row.title)+'</a></li>').join('')+'</ul></nav>':'';
 const body=`${preview?'<aside class="preview-note">비공개 미리보기입니다. 저장된 현재 초안이며 공개본은 바뀌지 않았습니다.</aside>':''}<article class="article"><nav class="breadcrumbs" aria-label="현재 위치"><a href="/">홈</a><span aria-hidden="true"> / </span><a href="/blog/">블로그</a></nav><p class="eyebrow">${esc(s.category)}</p><h1>${esc(s.title||'제목 없는 초안')}</h1><p class="summary">${esc(s.summary)}</p><p class="byline">${byline}</p><p class="edit-entry" hidden><a id="edit-post" class="button" data-slug="${esc(p.slug)}">이 글 수정하기</a></p>${s.appliesTo?'<p class="applicability"><strong>적용 대상·시점</strong> '+esc(s.appliesTo)+'</p>':''}${review}${due}<div class="article-body">${renderDelta(s.delta,s.imageMeta||{},s.heroImageId||'')}</div>${sourcesHTML(s)}${relatedHTML}<aside class="consult"><h2>내 조건에 맞는 준비가 궁금하신가요?</h2><p>현재 학력, 희망 과정과 입학 시기를 알려주시면 다음 준비를 함께 정리해 드립니다.</p><a class="button" href="https://pf.kakao.com/_VNmTxd" rel="noopener noreferrer">카카오톡으로 상담하기 ↗</a></aside></article>`;
 return htmlResponse(shell(s.title||'초안 미리보기',s.summary,body,{path,schema,robots:preview?'noindex,nofollow':'',article:true,image:hero}),{privatePage:preview});
}
export async function relatedPosts(db,s,postId) {
 const ids=(s.relatedIds||[]).filter(id=>id!==postId).slice(0,8);if(!ids.length)return [];
 const rows=(await db.prepare(`SELECT p.id,p.slug,json_extract(v.snapshot,'$.title') AS title FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision WHERE p.id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results;
 return ids.map(id=>rows.find(row=>row.id===id)).filter(Boolean);
}
function missing() {return htmlResponse(shell('글을 찾을 수 없습니다','','<section class="empty"><h1>글을 찾을 수 없습니다.</h1><a href="/blog/">블로그 목록으로</a></section>',{robots:'noindex,follow'}),{status:404});}
const redirect=url=>new Response(null,{status:308,headers:{Location:url,'Cache-Control':'public, max-age=0, must-revalidate'}});
const head=(r,request)=>request.method==='HEAD'?new Response(null,{status:r.status,headers:r.headers}):r;
export async function publicBlog({request,env}) {
 const url=new URL(request.url),pathname=url.pathname;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 if(pathname==='/blog')return redirect('/blog/'+url.search);
 const slug=pathname.replace(/^\/blog\//,'').replace(/\/$/,'');
 if(slug&&!slugPattern.test(slug))return head(missing(),request);
 if(slug&&!pathname.endsWith('/'))return redirect(pathname+'/'+url.search);
 if(!env.CMS_DB)return head(htmlResponse(shell('블로그 준비 중','영국유학센터 신촌점 블로그','<section class="empty"><h1>블로그를 준비하고 있습니다.</h1><p>지금 상담은 홈페이지에서 이용하실 수 있습니다.</p><a href="/">홈으로</a></section>',{robots:'noindex,follow'}),{status:503}),request);
 try {
  if(slug) {
   const p=await env.CMS_DB.prepare('SELECT p.*,v.snapshot FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision WHERE p.slug=?').bind(slug).first();
   if(!p)return head(missing(),request);
   const s=JSON.parse(p.snapshot);return head(articlePage(s,p,false,{related:await relatedPosts(env.CMS_DB,s,p.id)}),request);
  }
  const params=url.searchParams;
  if(params.getAll('page').length>1||params.getAll('category').length>1)return head(missing(),request);
  const rawPage=params.get('page');if(rawPage!==null&&(!/^\d+$/.test(rawPage)||Number(rawPage)<1||Number(rawPage)>10000))return head(missing(),request);
  const page=Number(rawPage)||1,rawCategory=params.get('category');
  const category=rawCategory?CATEGORY_DEFINITIONS.find(c=>c.code===rawCategory||c.label===rawCategory):null;
  if(rawCategory!==null&&!category)return head(missing(),request);
  const normalized=new URLSearchParams(params);let normalize=false;
  if(rawPage!==null&&(page===1||String(page)!==rawPage)){if(page===1)normalized.delete('page');else normalized.set('page',String(page));normalize=true;}
  if(category&&rawCategory!==category.code){normalized.set('category',category.code);normalize=true;}
  if(normalize)return redirect('/blog/'+(normalized.size?'?'+normalized.toString():''));
  let query='SELECT p.slug,p.published_at,v.snapshot FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision';const args=[];
  if(category){query+=" WHERE (json_extract(v.snapshot,'$.categoryCode')=? OR json_extract(v.snapshot,'$.category')=?)";args.push(category.code,category.label);}
  query+=' ORDER BY p.published_at DESC,p.id DESC LIMIT 13 OFFSET ?';args.push((page-1)*12);
  const rows=(await env.CMS_DB.prepare(query).bind(...args).all()).results;
  if(page>1&&!rows.length)return head(missing(),request);
  const cards=rows.slice(0,12).map(row=>{const s=JSON.parse(row.snapshot);return `<article class="post-card"><p class="eyebrow">${esc(s.category)}</p><h2><a href="/blog/${esc(row.slug)}/">${esc(s.title)}</a></h2><p>${esc(s.summary)}</p><small>${esc(s.authorName)} · ${time(row.published_at,'발행')}</small></article>`;}).join('');
  const paging=n=>{const q=new URLSearchParams();if(category)q.set('category',category.code);if(n>1)q.set('page',String(n));return '/blog/'+(q.size?'?'+q.toString():'');};
  const title=(category?category.label+' 글':'신촌점 블로그')+(page>1?' · '+page+'페이지':'');
  const body=`<section class="intro"><p class="eyebrow">FROM OUR CONSULTATIONS</p><h1>${category?esc(category.label)+' 안내와 이야기':'영국 유학, 궁금한 것부터 차근차근.'}</h1><p>신촌점에서 전하는 준비 안내와 상담 이야기입니다.</p></section><nav class="categories" aria-label="글 주제"><a href="/blog/" ${!category?'aria-current="page"':''}>전체</a>${CATEGORY_DEFINITIONS.map(c=>'<a href="/blog/?category='+c.code+'" '+(category?.code===c.code?'aria-current="page"':'')+'>'+esc(c.label)+'</a>').join('')}</nav><section class="post-list">${cards||'<p class="empty">아직 공개된 글이 없습니다. 첫 이야기를 준비하고 있습니다.</p>'}</section><nav class="pagination" aria-label="글 목록 페이지">${page>1?'<a rel="prev" href="'+esc(paging(page-1))+'">← 이전</a>':''}<span>${page}페이지</span>${rows.length>12?'<a rel="next" href="'+esc(paging(page+1))+'">다음 →</a>':''}</nav>`;
  return head(htmlResponse(shell(title,'영국유학센터 신촌점의 어학연수·대학·대학원·비용 안내와 상담 이야기',body,{path:paging(page),robots:category||!rows.length?'noindex,follow':''})),request);
 }catch(e){console.error('Blog read failed',e?.name);return head(htmlResponse(shell('블로그 준비 중','','<section class="empty"><h1>블로그를 준비하고 있습니다.</h1><a href="/">홈페이지에서 상담하기</a></section>',{robots:'noindex,follow'}),{status:503}),request);}
}
export async function publishedURLs(db) {
 if(!db)return [];
 try{return (await db.prepare('SELECT p.slug,p.published_at,v.snapshot FROM cms_posts p JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.published_revision ORDER BY p.published_at DESC,p.id DESC').all()).results.map(p=>({slug:p.slug,modifiedAt:publicationDates(JSON.parse(p.snapshot),p).modifiedAt}));}catch{return [];}
}
export {ORIGIN};
