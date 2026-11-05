/** Editorial/publication integration; only an isolated fictional D1 is modified. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
const f=await fixture({port:process.env.CMS_SEO_UI_FIXTURE?8796:undefined});
const checks=[];const pass=name=>{checks.push(name);console.log('PASS',name);};
const a=f.client(),anonymous=f.client();
const official={url:'https://example.org/official',title:'가상 검증 자료',publisher:'가상 기관',kind:'official'};
const guide={schemaVersion:2,title:'검증용 입학 안내 · 실제 학교 정보 아님',category:'대학·파운데이션',contentType:'guide',appliesTo:'가상 2027 학년도',verifiedAt:'2026-11-01',reviewScope:'검증용 자료의 조건과 예외',sourceDetails:[official],sources:'https://example.org/reference',delta:{ops:[{insert:'가상 조건의 검증용 본문입니다. 실제 학교 정보로 사용할 수 없습니다.\n'}]}};
try{
 await a.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'가상 관리자',email:'seo-admin@example.test',password:PASSWORD}});
 let created=await a.api('posts',{method:'POST',body:{},expected:201});let p=(await a.api('posts/'+created.id)).post;
 let saved=await a.api('posts/'+p.id,{method:'PUT',body:{...guide,revision:p.revision}});p=(await a.api('posts/'+p.id)).post;
 await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:p.revision},expected:400});
 await anonymous.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:p.revision,checks:{facts:true,conditions:true,rights:true}},expected:401});
 await a.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:p.revision,checks:{facts:true,conditions:false,rights:true}},expected:400});
 await a.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:p.revision,checks:{facts:true,conditions:true,rights:true}}});
 let published=await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:p.revision}});assert.equal(published.revision,p.revision+1);
 let current=await a.api('posts/'+p.id);assert.equal(current.post.published_revision,current.post.revision);assert(current.snapshot.publication.factCheck.reviewerName==='가상 관리자');
 const first=current.snapshot.publication;const url=published.url;await anonymous.request(url);
 pass('official-condition guide cannot publish before a current authenticated human fact review; approval is immutable');
 await a.api('posts/'+p.id,{method:'PUT',body:{...current.snapshot,title:'사소한 오탈자 수정',changeKind:'minor',changeNote:'가상 오탈자 교정',revision:current.post.revision}});
 current=await a.api('posts/'+p.id);
 await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:current.post.revision},expected:400});
 const still=(await anonymous.request(url)).data;assert(still.includes(guide.title)&&!still.includes('사소한 오탈자 수정'));
 await a.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:current.post.revision,checks:{facts:true,conditions:true,rights:true}}});
 await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:current.post.revision}});current=await a.api('posts/'+p.id);
 assert.equal(current.snapshot.publication.publishedAt,first.publishedAt);assert.equal(current.snapshot.publication.contentModifiedAt,first.contentModifiedAt);assert.equal(current.post.slug,p.slug);
 pass('editing retains live approval and URL; new draft requires a new review; minor edit preserves the modification date');
 await a.api('posts/'+p.id,{method:'PUT',body:{...current.snapshot,publication:{contentModifiedAt:'2099-01-01'},changeKind:'substantive',changeNote:'가상 내용 조건 변경',delta:{ops:[{insert:'판단 조건을 실질적으로 바꾼 가상 검증 본문입니다.\n'}]},revision:current.post.revision}});
 current=await a.api('posts/'+p.id);assert(!current.snapshot.publication);
 await a.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:current.post.revision,checks:{facts:true,conditions:true,rights:true}}});
 await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:current.post.revision}});current=await a.api('posts/'+p.id);
 assert(current.snapshot.publication.contentModifiedAt>=first.contentModifiedAt);assert.notEqual(current.snapshot.publication.contentModifiedAt,'2099-01-01');
 const before=current.post.revision;const again=await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:before}});assert(again.unchanged&&again.revision===before);
 pass('substantive changes receive server approval time; forged dates are stripped; repeated approval is idempotent');
 await a.api('posts/'+p.id,{method:'PUT',body:{title:'old client',delta:guide.delta,revision:before},expected:409});
 pass('an outdated editor cannot drop the versioned metadata on a newer draft');
 const count=await f.db.prepare('SELECT COUNT(*) AS n FROM cms_versions WHERE post_id=?').bind(p.id).first();assert(count.n>=7);
 pass('every draft and approval snapshot remains in the existing version history without a bulk migration');

 const otherIds=[];
 for(let i=1;i<=24;i++){
  const id=(await a.api('posts',{method:'POST',body:{},expected:201})).id;
  await a.api('posts/'+id,{method:'PUT',body:{schemaVersion:2,title:'가상 목록 경계 '+i,category:'어학연수',contentType:'news',delta:{ops:[{insert:'목록 검증용 가상 글입니다. 실제 원고가 아닙니다.\n'}]},revision:1}});
  await a.api('posts/'+id+'/publish',{method:'POST',body:{revision:2}});otherIds.push(id);
 }
 const sequences=[];
 for(let n=1;n<=3;n++){
  const suffix=n===1?'':'?page='+n;const html=(await anonymous.request('/blog/'+suffix)).data;
  const slugs=[...html.matchAll(/<h2><a href="\/blog\/(story-[a-f0-9-]+)\//g)].map(x=>x[1]);
  assert.equal(slugs.length,n===3?1:12);assert(html.includes('rel="canonical" href="https://uksinchon.com/blog/'+suffix+'"'));
  assert(!html.includes('noindex'));sequences.push(...slugs);
 }
 assert.equal(new Set(sequences).size,25);
 await anonymous.request('/blog/?page=4',{expected:404});await anonymous.request('/blog/?page=2.5',{expected:404});await anonymous.request('/blog/?page=0',{expected:404});await anonymous.request('/blog/?page=2&page=3',{expected:404});await anonymous.request('/blog/?category=unknown',{expected:404});
 const filtered=(await anonymous.request('/blog/?category=english&page=2')).data;
 assert(filtered.includes('content="noindex,follow"'));assert(filtered.includes('rel="canonical" href="https://uksinchon.com/blog/?category=english&amp;page=2"'));
 const normalized=await anonymous.request('/blog/?category='+encodeURIComponent('어학연수')+'&page=1&utm_source=naver',{expected:308});assert.equal(normalized.response.headers.get('Location'),'/blog/?category=english&utm_source=naver');
 const slash=await anonymous.request('/blog/'+p.slug+'?utm_source=naver',{expected:308});assert.equal(slash.response.headers.get('Location'),'/blog/'+p.slug+'/?utm_source=naver');
 const head=await anonymous.request(url,{method:'HEAD'});assert.equal(head.data,'');
 pass('25 approved posts paginate as 12/12/1 with distinct canonical URLs, stable ordering, crawlable links and real 404 boundaries');
 pass('legacy category links normalize once, preserve campaign tags, and filtered pages use their own noindex-follow canonical');

 const photo=Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoQAAwAAUAmJZACdLoAA5gA/t+APtTYqp53f4tpHQpPAAAA','base64');
 const uploaded=await a.api('posts/'+p.id+'/images',{method:'POST',body:photo,headers:{'Content-Type':'image/webp'},expected:201});assert.equal(uploaded.width,16);assert.equal(uploaded.height,12);
 await anonymous.request(uploaded.url,{expected:404});
 const privateId=(await a.api('posts',{method:'POST',body:{},expected:201})).id;
 const table={caption:'가상 비교 표',columns:['항목','A','B'],rows:[['조건','<script>실행 금지</script>','미확인']],source:'https://example.org/table',notes:'실제 가격이나 학교 조건이 아닙니다.'};
 current=await a.api('posts/'+p.id);
 await a.api('posts/'+p.id,{method:'PUT',body:{...current.snapshot,contentType:'comparison',changeKind:'substantive',changeNote:'가상 사진·표 검증',imageMeta:{[uploaded.id]:{alt:'가상 검증 사진',caption:'검증용 16×12 이미지',rights:'직접 생성한 가상 이미지',width:999,height:999}},heroImageId:uploaded.id,relatedIds:[otherIds[0],privateId,p.id],delta:{ops:[{insert:'새 비교 조건을 확인하는 가상의 본문입니다.\n'},{insert:{image:uploaded.url}},{insert:'\n'},{insert:{comparisonTable:table}},{insert:'\n'}]},revision:current.post.revision}});
 current=await a.api('posts/'+p.id);assert.equal(current.snapshot.imageMeta[uploaded.id].width,16);
 const preview=(await a.request('/api/cms/posts/'+p.id+'/preview')).data;assert(preview.includes('/blog/story-'+otherIds[0]+'/'));assert(!preview.includes('/blog/story-'+privateId+'/'));
 await a.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:current.post.revision,checks:{facts:true,conditions:true,rights:true}}});
 await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:current.post.revision}});current=await a.api('posts/'+p.id);
 const html=(await anonymous.request(url)).data;
 assert(html.includes('width="16" height="12"'));assert(html.includes('<table>')&&html.includes('&lt;script&gt;실행 금지&lt;/script&gt;'));assert(!html.includes('<script>실행 금지'));
 assert(html.includes('가상 검증 사진')&&html.includes('og:image'));assert(html.includes('마지막 사실 확인')&&html.includes('가상 관리자'));
 assert(html.includes('/blog/story-'+otherIds[0]+'/'));assert(!html.includes('/blog/story-'+privateId+'/'));
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];const article=graph.find(x=>x['@type']==='Article');
 assert.equal(article.datePublished,current.post.published_at);assert.equal(article.dateModified,current.snapshot.publication.contentModifiedAt);assert(graph.some(x=>x['@type']==='BreadcrumbList'));
 await anonymous.request(uploaded.url);
 const sitemap=(await anonymous.request('/sitemap.xml')).data;assert(sitemap.includes('<lastmod>'+article.dateModified+'</lastmod>'));assert(!sitemap.includes(privateId));
 const feed=(await anonymous.request('/feed.xml')).data;assert.equal((feed.match(/<item>/g)||[]).length,20);assert(!feed.includes(p.slug));
 const oldModified=article.dateModified;
 await a.api('posts/'+p.id,{method:'PUT',body:{...current.snapshot,verifiedAt:'2026-11-02',reviewScope:'가상 자료를 다시 읽고 조건이 같음을 확인',changeKind:'minor',revision:current.post.revision}});current=await a.api('posts/'+p.id);
 await a.api('posts/'+p.id+'/factcheck',{method:'POST',body:{revision:current.post.revision,checks:{facts:true,conditions:true,rights:true}}});await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:current.post.revision}});current=await a.api('posts/'+p.id);
 assert.equal(current.snapshot.publication.contentModifiedAt,oldModified);assert.equal(current.snapshot.publication.factCheck.checkedAt,'2026-11-02');
 await a.api('posts/'+p.id+'/unpublish',{method:'POST',body:{revision:current.post.revision}});await anonymous.request(url,{expected:404});await anonymous.request(uploaded.url,{expected:404});
 await a.api('posts/'+p.id+'/publish',{method:'POST',body:{revision:current.post.revision}});current=await a.api('posts/'+p.id);assert.equal(current.snapshot.publication.contentModifiedAt,oldModified);
 pass('published HTML exposes accessible image/table metadata, real reviewers, matching schema/sitemap dates and only public related links');
 pass('fact-check-only updates and unpublish/republish preserve substantive date; unpublished media access is revoked');

 for(const sample of [
  {contentType:'case',category:'상담 사례·소식',requiresFactCheck:false,title:'가상 상담 사례 · 실제 학생 정보 없음'},
  {contentType:'news',category:'어학연수',requiresFactCheck:true,title:'가상 기준월 자료 · 실제 통계 아님'},
  {contentType:'news',category:'비용·장학금',requiresFactCheck:true,title:'가상 장학금 소식 · 실제 혜택 아님',reviewDueAt:'2026-11-03'}
 ]){
  const id=(await a.api('posts',{method:'POST',body:{},expected:201})).id;
  await a.api('posts/'+id,{method:'PUT',body:{...guide,...sample,revision:1}});
  if(sample.requiresFactCheck){
   await a.api('posts/'+id+'/publish',{method:'POST',body:{revision:2},expected:400});
   await a.api('posts/'+id+'/factcheck',{method:'POST',body:{revision:2,checks:{facts:true,conditions:true,rights:true}}});
  }
  const published=await a.api('posts/'+id+'/publish',{method:'POST',body:{revision:2}});const body=(await anonymous.request(published.url)).data;
  assert(!body.includes('FAQPage'));assert.equal(body.includes('마지막 사실 확인'),sample.requiresFactCheck);
  if(sample.reviewDueAt)assert(body.includes('재확인 시점이 지났습니다'));
 }
 pass('guide, comparison, time-based news, case and scholarship patterns use appropriate review rules without imposing a universal FAQ template');

 const owner=(await a.api('me')).user.id,legacyId=crypto.randomUUID(),legacySlug='story-'+legacyId;
 const legacy={title:'기존 v1 가상 글',category:'어학연수',authorName:'기존 가상 작성자',summary:'기존 구조 읽기 검증',verifiedAt:'2026-10-20',sources:'https://example.org/legacy',delta:{ops:[{insert:'v1 원고의 본문을 그대로 읽는 검증입니다.\n'}]}};
 await f.db.batch([
  f.db.prepare("INSERT INTO cms_posts(id,slug,owner_id,status,revision,published_revision,created_at,updated_at,published_at,save_token) VALUES(?,?,?,'published',1,1,?,?,?,?)").bind(legacyId,legacySlug,owner,'2026-10-20T00:00:00Z','2026-11-01T00:00:00Z','2026-10-28T00:00:00Z',crypto.randomUUID()),
  f.db.prepare('INSERT INTO cms_versions(post_id,revision,snapshot,actor_id,created_at) VALUES(?,1,?,?,?)').bind(legacyId,JSON.stringify(legacy),owner,'2026-10-20T00:00:00Z')
 ]);
 const legacyBody=(await anonymous.request('/blog/'+legacySlug+'/')).data;assert(legacyBody.includes(legacy.title));assert(!legacyBody.includes('dateModified'));assert(!legacyBody.includes('마지막 사실 확인'));assert(legacyBody.includes('원고에 기재된 정보 확인일'));
 const legacyCanonical='rel="canonical" href="https://uksinchon.com/blog/'+legacySlug+'/"';assert(legacyBody.includes(legacyCanonical));
 await a.api('posts/'+legacyId,{method:'PUT',body:{...legacy,schemaVersion:2,contentType:'news',changeKind:'minor',changeNote:'구형 원고의 표시 설정 정리',revision:1}});
 const oldStill=(await anonymous.request('/blog/'+legacySlug+'/')).data;assert(oldStill.includes(legacy.title));
 await a.api('posts/'+legacyId+'/publish',{method:'POST',body:{revision:2}});
 const upgraded=await a.api('posts/'+legacyId);assert.equal(upgraded.post.slug,legacySlug);assert.equal(upgraded.snapshot.publication.contentModifiedAt,null);
 assert.equal((await f.db.prepare('SELECT snapshot FROM cms_versions WHERE post_id=? AND revision=1').bind(legacyId).first()).snapshot,JSON.stringify(legacy));
 pass('an existing v1 database record upgrades through a new approval without changing URL, rewriting history or inventing a modification/review date');
 const report={passed:checks.length,checks,productionDataModified:false};fs.writeFileSync('/workspace/SEO_통합검증.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(process.env.CMS_SEO_UI_FIXTURE){console.log('SEO FIXTURE READY '+f.base);await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await f.mf.dispose();}
