/** Direct staff publishing against a fictional Worker + D1; never production. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
const f=await fixture({port:process.env.CMS_STAFF_PUBLISH_UI_FIXTURE?8800:undefined});
const admin=f.client(),staff=f.client(),other=f.client(),anon=f.client(),checks=[];
const pass=name=>{checks.push(name);console.log('PASS',name);};
const news={schemaVersion:2,title:'직원 직접 발행 가상 글',category:'상담 사례·소식',contentType:'news',delta:{ops:[{insert:'실제 학생이나 학교 정보가 아닌 직접 발행 검증용 원고입니다.\n'}]}};
const read=id=>staff.api('posts/'+id);
const create=async(client=staff,patch={})=>{
 const {id}=await client.api('posts',{method:'POST',body:{},expected:201});
 await client.api('posts/'+id,{method:'PUT',body:{...news,...patch,revision:1}});return id;
};
const action=(client,id,kind,revision,extra={})=>client.api('posts/'+id+'/'+kind,{method:'POST',body:{revision,...extra}});
try{
 await admin.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'가상 관리자',email:'staff-admin@example.test',password:PASSWORD}});
 for(const [client,suffix] of [[staff,'writer'],[other,'other']]){
  await admin.api('users',{method:'POST',body:{name:'가상 직원 '+suffix,email:'staff-'+suffix+'@example.test',password:PASSWORD},expected:201});
  await client.api('login',{method:'POST',body:{email:'staff-'+suffix+'@example.test',password:PASSWORD}});
  await client.api('posts',{expected:403});
  await client.api('password',{method:'POST',body:{currentPassword:PASSWORD,password:PASSWORD}});
 }
 const id=await create(),adminId=await create(admin);
 for(const target of [id,adminId])for(const kind of ['factcheck','publish','unpublish']){
  await other.api('posts/'+target+'/'+kind,{method:'POST',body:{revision:2,checks:{facts:true,conditions:true,rights:true}},expected:403});
 }
 await staff.api('posts/'+adminId+'/publish',{method:'POST',body:{revision:2},expected:403});
 pass('temporary-password and ownership checks still prevent staff from publishing or reviewing someone else’s posts');

 const bytes=execFileSync('python3',['-c',"from PIL import Image;import io,sys;b=io.BytesIO();Image.new('RGB',(12,8),(80,120,160)).save(b,format='WEBP');sys.stdout.buffer.write(b.getvalue())"]);
 const image=await staff.api('posts/'+id+'/images',{method:'POST',body:new Uint8Array(bytes),headers:{'Content-Type':'image/webp'},expected:201});
 await anon.request(image.url,{expected:404});
 await staff.api('posts/'+id,{method:'PUT',body:{...news,revision:2,delta:{ops:[...news.delta.ops,{insert:{image:image.url}},{insert:'\n'}]},imageMeta:{[image.id]:{alt:'가상 검증 이미지',rights:'직접 생성한 가상 이미지',source:'www.example.org/photos'}}}});
 const before=await read(id);assert.equal(before.post.status,'draft');
 const published=await action(staff,id,'publish',before.post.revision);
 let live=await read(id);const first=live.snapshot.publication;
 assert.equal(first.approvedById,live.post.owner_id);assert.equal(first.approvedByName,'가상 직원 writer');assert.equal(first.factCheck,null);
 assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM cms_events WHERE post_id=? AND action='review'").bind(id).first()).n,0);
 assert.equal(live.post.revision,before.post.revision+1);assert.equal(live.post.published_revision,live.post.revision);
 for(const path of [published.url,'/blog/','/sitemap.xml','/feed.xml'])assert((await anon.request(path)).data.includes(path===published.url?news.title:published.url));
 await anon.request(image.url);
 assert.equal(live.snapshot.imageMeta[image.id].source,'www.example.org/photos');
 const photoHTML=(await anon.request(published.url)).data;assert(photoHTML.includes('사진 출처: www.example.org/photos'));assert(!photoHTML.includes('href="www.example.org/photos"'));
 pass('a staff writer publishes directly from draft without any review request or administrator action; HTML, media, sitemap and RSS become public');

 const unchanged=await action(staff,id,'publish',live.post.revision);assert(unchanged.unchanged);assert.equal(unchanged.revision,live.post.revision);
 await staff.api('posts/'+id+'/publish',{method:'POST',body:{revision:before.post.revision},expected:409});
 await anon.api('posts/'+id+'/publish',{method:'POST',body:{revision:live.post.revision},expected:401});
 await staff.request('/api/cms/posts/'+id+'/unpublish',{method:'POST',body:{revision:live.post.revision},headers:{Origin:'https://other.example.test'},expected:403});
 assert.equal((await read(id)).post.published_revision,live.post.revision);
 pass('duplicate publishing is idempotent; stale, anonymous and cross-origin publication actions are rejected');

 await staff.api('posts/'+id,{method:'PUT',body:{...live.snapshot,revision:live.post.revision,title:'직원이 수정한 비공개 가상 제목',changeKind:'minor',changeNote:'가상 오탈자 교정'}});
 live=await read(id);assert((await anon.request(published.url)).data.includes(news.title));
 assert(!(await anon.request(published.url)).data.includes('직원이 수정한 비공개 가상 제목'));
 await action(staff,id,'publish',live.post.revision);live=await read(id);
 assert((await anon.request(published.url)).data.includes('직원이 수정한 비공개 가상 제목'));
 assert.equal(live.snapshot.publication.publishedAt,first.publishedAt);assert.equal(live.snapshot.publication.contentModifiedAt,first.contentModifiedAt);assert.equal(live.post.slug,before.post.slug);
 pass('staff republish their edits on the same URL while saved drafts and original publication dates remain independent');

 const guideId=await create(staff,{title:'직원 사실 확인 가상 안내',contentType:'guide',appliesTo:'가상 2027 학년도 조건',verifiedAt:'2026-11-02',reviewScope:'가상 공식 자료의 대상·조건 대조',sourceDetails:[{url:'https://example.org/official',title:'가상 공식 자료',publisher:'가상 기관',kind:'official'}]});
 await staff.api('posts/'+guideId+'/publish',{method:'POST',body:{revision:2},expected:400});
 await staff.api('posts/'+guideId+'/factcheck',{method:'POST',body:{revision:2,checks:{facts:true,conditions:true,rights:false}},expected:400});
 await action(staff,guideId,'factcheck',2,{checks:{facts:true,conditions:true,rights:true}});
 const guidePublic=await action(staff,guideId,'publish',2);let guide=await read(guideId);
 assert.equal(guide.snapshot.publication.factCheck.reviewerId,guide.post.owner_id);assert.equal(guide.snapshot.publication.factCheck.kind,'human');
 assert((await anon.request(guidePublic.url)).data.includes('검토 가상 직원 writer'));
 await staff.api('posts/'+guideId,{method:'PUT',body:{...guide.snapshot,revision:guide.post.revision,title:'조건이 바뀐 가상 안내',changeNote:'가상 조건 변경'}});
 guide=await read(guideId);await staff.api('posts/'+guideId+'/publish',{method:'POST',body:{revision:guide.post.revision},expected:400});
 await action(staff,guideId,'factcheck',guide.post.revision,{checks:{facts:true,conditions:true,rights:true}});
 await action(staff,guideId,'publish',guide.post.revision);
 pass('a writer records their own current-version fact check and publishes a guide; missing checks or changed conditions require author confirmation, not manager approval');

 const waiting=await create(staff,{title:'기존 검토 요청 상태의 가상 글'});
 await action(staff,waiting,'review',2);assert.equal((await read(waiting)).post.status,'review');
 await action(staff,waiting,'publish',2);assert((await read(waiting)).post.published_revision);
 const untouched=await create(staff,{title:'발행하지 않은 가상 초안'});await anon.request('/blog/story-'+untouched+'/',{expected:404});
 pass('existing review-requested posts can be self-published while other drafts are not automatically published');

 await action(staff,id,'unpublish',live.post.revision);await anon.request(published.url,{expected:404});await anon.request(image.url,{expected:404});
 for(const path of ['/blog/','/sitemap.xml','/feed.xml'])assert(!(await anon.request(path)).data.includes(published.url));
 live=await read(id);assert.equal(live.post.published_revision,null);assert((await staff.api('posts/'+id+'/versions')).versions.length>=5);
 await action(staff,id,'publish',live.post.revision);live=await read(id);assert.equal(live.snapshot.publication.publishedAt,first.publishedAt);
 await action(admin,id,'unpublish',live.post.revision);await anon.request(published.url,{expected:404});
 pass('writers can unpublish and republish their own articles and media with history preserved; administrators retain moderation access');

 for(const route of ['users','naver','counsel','posts?status=trash'])await staff.api(route,{expected:403});
 await staff.api('posts/'+id+'/trash',{method:'POST',body:{revision:live.post.revision},expected:403});
 const me=(await staff.api('me')).user;assert.equal(me.role,'author');
 const disabled=(await other.api('me')).user;await admin.api('users/'+disabled.id+'/active',{method:'POST',body:{active:false}});
 await other.api('posts/'+id+'/publish',{method:'POST',body:{revision:live.post.revision},expected:401});
 pass('direct publishing grants no account, inbox, import or trash privileges; disabled staff sessions remain unusable');

 console.log(JSON.stringify({passed:checks.length,checks,productionDataModified:false},null,2));
 if(process.env.CMS_STAFF_PUBLISH_UI_FIXTURE){console.log('STAFF PUBLISH FIXTURE READY '+f.base);await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await f.mf.dispose();}
