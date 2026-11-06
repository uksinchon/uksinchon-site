/** Fictional local D1 only: reversible deletion, permissions and publication safety. */
import assert from 'node:assert/strict';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
import {movePost} from '../cms/server/trash.js';
import {createNaverDraft} from '../cms/server/naver.js';
import {applyReviewedPilot} from '../cms/server/reviewed-pilots.js';
import {handleCMS} from '../cms/server/api.js';

const sourceId='555555555555';
const naverHTML={[sourceId]:'<meta property="og:title" content="가상 휴지통 원문"><div class="se-main-container"><p>이 글은 휴지통 기능을 검증하기 위한 가상 원문입니다. 실제 학교 정보나 학생 사례가 아니며 실제 조건 또는 가격으로 사용할 수 없습니다. 본문과 원고의 보존 여부만 검증합니다.</p></div>'};
const f=await fixture({port:process.env.CMS_TRASH_UI_FIXTURE?8798:undefined,naverHTML});
const a=f.client(),staff=f.client(),anonymous=f.client(),checks=[];
const pass=name=>{checks.push(name);console.log('PASS',name);};
const news={schemaVersion:2,title:'가상 삭제 검증 글',category:'상담 사례·소식',contentType:'news',delta:{ops:[{insert:'실제 운영 글이 아닌 격리된 삭제 기능 검증용 원고입니다.\n'}]}};
const read=id=>a.api('posts/'+id);
async function create(client=a,patch={}){const id=(await client.api('posts',{method:'POST',body:{},expected:201})).id;await client.api('posts/'+id,{method:'PUT',body:{...news,...patch,revision:1}});return read(id);}
async function action(id,kind,revision){return a.api('posts/'+id+'/'+kind,{method:'POST',body:{revision}});}

try{
 await a.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'가상 휴지통 관리자',email:'trash-admin@example.test',password:PASSWORD}});
 await a.api('users',{method:'POST',body:{name:'가상 휴지통 직원',email:'trash-author@example.test',password:PASSWORD},expected:201});
 await staff.api('login',{method:'POST',body:{email:'trash-author@example.test',password:PASSWORD}});
 await staff.api('password',{method:'POST',body:{currentPassword:PASSWORD,password:PASSWORD}});
 const own=await create(staff,{title:'직원 소유의 가상 초안'});
 // Exercise an already initialized pre-feature database, not only fresh setup.
 await f.db.prepare('DROP TABLE cms_post_trash').run();
 assert((await a.api('posts')).posts.some(x=>x.id===own.post.id));
 assert(await f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cms_post_trash'").first());
 assert((await f.db.prepare("SELECT sql FROM sqlite_master WHERE name='cms_posts'").first()).sql.includes("'draft','review','published'"));
 pass('initialized databases add only the trash table on demand; existing posts and the original status schema remain intact');

 const id=own.post.id;
 await anonymous.api('posts/'+id+'/trash',{method:'POST',body:{revision:own.post.revision},expected:401});
 await staff.api('posts/'+id+'/trash',{method:'POST',body:{revision:own.post.revision},expected:403});
 await staff.api('posts?status=trash',{expected:403});
 await a.request('/api/cms/posts/'+id+'/trash',{method:'POST',body:{revision:own.post.revision},headers:{Origin:'https://unrelated.example.test'},expected:403});
 await a.api('posts/'+id+'/trash',{method:'GET',expected:404});
 await a.api('posts/'+id+'/trash',{method:'POST',body:{revision:1},expected:409});
 assert.equal((await read(id)).post.revision,own.post.revision);
 await action(id,'trash',own.post.revision);
 await staff.api('posts/'+id,{expected:410});
 assert(!(await staff.api('posts')).posts.some(x=>x.id===id));
 await staff.api('posts/'+id+'/restore',{method:'POST',body:{revision:own.post.revision+1},expected:403});
 pass('deletion and trash access require an admin, same origin, POST and current revision; staff cannot delete even their own post');

 let data=await create(a,{title:'가상 공개 글 · 사진과 관련 링크'});const pId=data.post.id;
 const photo=Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoQAAwAAUAmJZACdLoAA5gA/t+APtTYqp53f4tpHQpPAAAA','base64');
 const image=await a.api('posts/'+pId+'/images',{method:'POST',body:photo,headers:{'Content-Type':'image/webp'},expected:201});
 await a.api('posts/'+pId,{method:'PUT',body:{...data.snapshot,revision:data.post.revision,delta:{ops:[{insert:'가상 공개 사진을 함께 삭제하는지 검증합니다.\n'},{insert:{image:image.url}},{insert:'\n'}]},imageMeta:{[image.id]:{alt:'가상 초록색 이미지',rights:'검증용으로 직접 생성한 이미지'}},heroImageId:image.id}});
 data=await read(pId);const pub=await action(pId,'publish',data.post.revision);data=await read(pId);
 const firstPublished=data.post.published_at,slug=data.post.slug;
 const related=await create(a,{title:'가상 관련 글',relatedIds:[pId]});const relatedPub=await action(related.post.id,'publish',related.post.revision);
 assert((await anonymous.request(relatedPub.url)).data.includes(pub.url));await anonymous.request(image.url);
 const saved=JSON.stringify(data.snapshot),oldRevision=data.post.revision;
 await action(pId,'trash',oldRevision);
 for(const path of [pub.url,image.url])await anonymous.request(path,{expected:404});
 for(const path of ['/blog/','/sitemap.xml','/feed.xml',relatedPub.url])assert(!(await anonymous.request(path)).data.includes(pub.url));
 assert(!(await a.api('posts?q='+encodeURIComponent('가상 공개 글'))).posts.length);
 const trash=(await a.api('posts?status=trash&q='+encodeURIComponent('가상 공개 글'))).posts;
 assert.equal(trash.length,1);assert(trash[0].is_trashed&&trash[0].trashed_at);assert.equal(trash[0].published_revision,null);
 assert.equal((await f.db.prepare('SELECT snapshot FROM cms_versions WHERE post_id=? AND revision=?').bind(pId,oldRevision).first()).snapshot,saved);
 assert(await f.db.prepare('SELECT id FROM cms_media WHERE id=?').bind(image.id).first());
 await a.request(image.url);
 pass('a public post disappears from lists, related links, sitemap, RSS and anonymous media while all original versions and image bytes are retained');

 for(const path of ['', '/preview','/versions','/versions/1'])await a.api('posts/'+pId+path,{expected:410});
 await a.api('posts/'+pId,{method:'PUT',body:{...data.snapshot,revision:oldRevision},expected:410});
 for(const kind of ['publish','review','unpublish','factcheck'])await a.api('posts/'+pId+'/'+kind,{method:'POST',body:{revision:oldRevision+1,checks:{facts:true,conditions:true,rights:true}},expected:410});
 await a.api('posts/'+pId+'/images',{method:'POST',body:photo,headers:{'Content-Type':'image/webp'},expected:410});
 await a.api('posts/'+pId+'/trash',{method:'POST',body:{revision:oldRevision+1},expected:409});
 await a.api('posts/'+pId+'/restore',{method:'POST',body:{revision:oldRevision},expected:409});
 await action(pId,'restore',oldRevision+1);data=await read(pId);
 assert.equal(data.post.revision,oldRevision+2);assert.equal(data.post.slug,slug);assert.equal(data.post.published_at,firstPublished);assert.equal(data.post.published_revision,null);assert.equal(data.post.status,'draft');assert(!data.snapshot.publication);assert.equal(data.factReview,null);
 assert.deepEqual(data.snapshot.delta,JSON.parse(saved).delta);await anonymous.request(pub.url,{expected:404});await anonymous.request(image.url,{expected:404});
 await a.api('posts/'+pId,{method:'PUT',body:{...data.snapshot,title:'stale edit must not win',revision:oldRevision},expected:409});
 assert.equal((await read(pId)).snapshot.title,data.snapshot.title);
 pass('trash blocks stale editors and publication; restore creates a new private revision with the same URL and first-publication date, never an automatic republication');

 const guide=await create(a,{title:'가상 사실 확인 안내',contentType:'guide',appliesTo:'가상 2027년도',verifiedAt:'2026-11-06',reviewScope:'검증용 자료 대조',sourceDetails:[{url:'https://example.org/fictional-official',title:'가상 공식 자료',publisher:'가상 기관',kind:'official'}]});
 await a.api('posts/'+guide.post.id+'/factcheck',{method:'POST',body:{revision:guide.post.revision,checks:{facts:true,conditions:true,rights:true}}});
 const guidePub=await action(guide.post.id,'publish',guide.post.revision);let g=await read(guide.post.id);const oldModified=g.snapshot.publication.contentModifiedAt;
 await action(g.post.id,'trash',g.post.revision);await action(g.post.id,'restore',g.post.revision+1);g=await read(g.post.id);
 await a.api('posts/'+g.post.id+'/publish',{method:'POST',body:{revision:g.post.revision},expected:400});
 await a.api('posts/'+g.post.id+'/factcheck',{method:'POST',body:{revision:g.post.revision,checks:{facts:true,conditions:true,rights:true}}});
 await action(g.post.id,'publish',g.post.revision);g=await read(g.post.id);assert.equal(g.snapshot.publication.contentModifiedAt,oldModified);await anonymous.request(guidePub.url);
 pass('restored sensitive guidance needs current review and separate publication; unchanged content does not acquire an invented modification date');

 await a.api('naver/url',{method:'POST',body:{url:'https://blog.naver.com/pedu2/'+sourceId}});
 const draft=await a.api('naver/items/'+sourceId+'/draft',{method:'POST',body:{mode:'manual'}});let n=await read(draft.postId);await action(n.post.id,'trash',n.post.revision);
 const source=(await a.api('naver/items/'+sourceId)).item;assert(source.post_trashed);assert.equal(source.post_id,n.post.id);
 assert((await a.api('naver')).items.find(x=>x.id===sourceId).post_trashed);
 for(const kind of ['draft','codex-reviewed','review'])await a.api('naver/items/'+sourceId+'/'+kind,{method:'POST',body:{mode:'manual',revision:n.post.revision+1,checks:{facts:true,conditions:true,rights:true}},expected:410});
 const actor=await f.db.prepare("SELECT * FROM cms_users WHERE role='admin'").first();
 await assert.rejects(createNaverDraft(f.db,sourceId,'manual',{},actor),e=>e.status===410);
 await assert.rejects(applyReviewedPilot(f.db,source,{onlyNew:true},actor),e=>e.status===410);
 const after=await f.db.prepare('SELECT revision FROM cms_posts WHERE id=?').bind(n.post.id).first();assert.equal(after.revision,n.post.revision+1);
 pass('Naver regeneration, source review and completed Codex import cannot recreate or overwrite a trashed post; its source association remains intact');

 const race=await create(a,{title:'가상 동시 저장·삭제 검증'});
 const results=await Promise.allSettled([
  movePost(f.db,race.post,race.snapshot,actor),
  a.api('posts/'+race.post.id,{method:'PUT',body:{...race.snapshot,title:'동시 저장 결과',revision:race.post.revision}})
 ]);
 const winners=results.filter((r,i)=>r.status==='fulfilled'&&(i===0?r.value?.ok:r.value?.revision));assert.equal(winners.length,1);
 const state=await f.db.prepare('SELECT * FROM cms_posts WHERE id=?').bind(race.post.id).first();assert.equal(state.revision,race.post.revision+1);
 assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM cms_versions WHERE post_id=?').bind(race.post.id).first()).n,state.revision);
 assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM cms_events WHERE post_id=? AND action='trash'").bind(race.post.id).first()).n,results[0].status==='fulfilled'&&results[0].value?.ok?1:0);
 pass('a concurrent save and deletion have exactly one winner with no orphan snapshot, false deletion event or lost revision');

 // Deterministic interleaving: deletion commits just after the request reads an
 // active post. A guessed next revision must not bypass the final write guard.
 const login=await fetch(f.base+'/api/cms/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email:'trash-admin@example.test',password:PASSWORD})});
 assert.equal(login.status,200);const cookie=login.headers.get('Set-Cookie').split(';')[0];
 for(const upload of [false,true]){
  const target=await create(a,{title:'가상 요청 진행 중 삭제 '+upload});let intercepted=false;
  const db={batch:statements=>f.db.batch(statements),prepare(sql){const prepared=f.db.prepare(sql);
   if(!sql.includes('AS is_trashed FROM cms_posts p WHERE p.id=?'))return prepared;
   return {bind(...values){const bound=prepared.bind(...values);return {async first(){const active=await bound.first();if(!intercepted){intercepted=true;assert((await movePost(f.db,active,target.snapshot,actor)).ok);}return active;}};}};
  }};
  const request=new Request(f.base+'/api/cms/posts/'+target.post.id+(upload?'/images':''),{method:upload?'POST':'PUT',headers:{Origin:f.base,Cookie:cookie,'Content-Type':upload?'image/webp':'application/json'},body:upload?photo:JSON.stringify({...target.snapshot,title:'must not be saved',revision:target.post.revision+1})});
  const response=await handleCMS({request,env:{CMS_DB:db,CMS_LOCAL_DEV:'true'}});assert.equal(response.status,409);assert(intercepted);
  assert.equal((await f.db.prepare('SELECT revision FROM cms_posts WHERE id=?').bind(target.post.id).first()).revision,target.post.revision+1);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM cms_media WHERE post_id=?').bind(target.post.id).first()).n,0);
 }
 pass('writes already in flight recheck trash at commit; a guessed future revision or image upload cannot modify a deleted post');

 console.log('OK:',checks.length,'trash checks');
 if(process.env.CMS_TRASH_UI_FIXTURE){console.log('TRASH FIXTURE READY',f.base);await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await f.mf.dispose();}
