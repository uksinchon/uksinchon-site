/** Finite Codex review packets. Only fictional D1, accounts and source responses. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
import {pilotReview,reviewContent,CODEX_REVIEWER,reviewedPilots} from '../cms/server/reviewed-pilots.js';
import {cleanSnapshot,factReadiness,imageIds,textOf} from '../cms/server/content.js';
const checks=[];const pass=n=>{checks.push(n);console.log('PASS',n);};
const first=reviewedPilots[0],post={revision:2};
const bound={id:first.sourceId,source_complete:1,status:'draft_ready',source_hash:first.sourceHash,approved_source_hash:first.sourceHash,approved_by:CODEX_REVIEWER,prompt_version:first.id,approved_revision:2};
assert(pilotReview(first.snapshot,bound,post,'2026-11-06')?.kind==='ai');
for(const change of [{source_complete:0},{source_hash:'changed'},{approved_source_hash:'changed'},{approved_by:'a-human'},{prompt_version:'client-forged'},{approved_revision:1},{status:'source_changed'}])assert.equal(pilotReview(first.snapshot,{...bound,...change},post,'2026-11-06'),null);
assert.equal(pilotReview({...first.snapshot,title:'unreviewed edit'},bound,post,'2026-11-06'),null);
assert.equal(pilotReview(first.snapshot,bound,post,'2099-01-01'),null);
assert.equal(reviewContent({...first.snapshot,authorName:'actual account',publication:{factCheck:{kind:'human'}}}),reviewContent(first.snapshot));
pass('proof binds exact reviewed content, source, revision, server identity and expiry; client approval fields cannot manufacture it');
for(const p of reviewedPilots){const s=cleanSnapshot(p.snapshot,'fictional account');assert.equal(factReadiness(s),'');assert.equal(imageIds(s).length,0);assert(s.sources.includes(p.sourceURL));assert(s.reviewScope.startsWith('Codex의 AI 검토.'));assert(p.verdicts.held.length);assert(p.sourceHash.match(/^[a-f0-9]{64}$/));assert.equal(reviewContent(s),reviewContent(p.snapshot));}
const scholarship=textOf(reviewedPilots[4].snapshot);assert(scholarship.includes('7월 31일')&&scholarship.includes('8월 31일'));
assert(!textOf(reviewedPilots[2].snapshot).match(/[1-9]\d*(\.\d+)?%/));
pass('all five real editorial packets retain source and limits, omit unlicensed media, expose scholarship date conflict and remove unverified ratio numbers');

const fictional=structuredClone(reviewedPilots),naverHTML={};
for(const p of fictional){
 const title='가상 원문 '+p.sourceId,text='이것은 검증용 가상 원문입니다. 실제 학생이나 학교의 자료가 아니며 오직 격리된 편집 기능 검증을 위해 만든 내용입니다. 최신 조건이나 실제 상담 결과로 사용할 수 없습니다.';
 p.sourceHash=crypto.createHash('sha256').update(JSON.stringify([title,text])).digest('hex');
 naverHTML[p.sourceId]='<meta property="og:title" content="'+title+'"><div class="se-main-container"><p>'+text+'</p></div>';
}
fictional[4].validUntil='2020-01-01';
const f=await fixture({pilotPackets:fictional,naverHTML,port:process.env.CMS_CODEX_UI_FIXTURE?8797:undefined});
const a=f.client(),anon=f.client(),staff=f.client();
try{
 await a.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'가상 적용 관리자',email:'codex-admin@example.test',password:PASSWORD}});
 await a.api('users',{method:'POST',body:{name:'가상 직원',email:'codex-author@example.test',password:PASSWORD},expected:201});
 await staff.api('login',{method:'POST',body:{email:'codex-author@example.test',password:PASSWORD}});
 const id=fictional[0].sourceId,route='naver/items/'+id+'/codex-reviewed';
 await anon.api(route,{method:'POST',body:{},expected:401});await staff.api(route,{method:'POST',body:{},expected:403});
 await a.api('naver/url',{method:'POST',body:{url:fictional[0].sourceURL}});
 const applied=await a.api(route,{method:'POST',body:{onlyNew:true,snapshot:{title:'cannot supply a packet'},reviewerKind:'human'}});
 let data=await a.api('posts/'+applied.postId);assert.equal(data.snapshot.title,fictional[0].snapshot.title);assert.equal(data.factReview.kind,'ai');assert.equal(data.factReview.name,'Codex (AI 검토)');
 const count=await f.db.prepare("SELECT COUNT(*) n FROM cms_events WHERE action='factcheck'").first();assert.equal(count.n,0);
 await anon.request('/blog/'+data.post.slug+'/',{expected:404});
 const existing=await a.api(route,{method:'POST',body:{onlyNew:true}});assert(existing.skipped);assert.equal((await a.api('posts/'+applied.postId)).post.revision,1);
 await a.api(route,{method:'POST',body:{revision:0},expected:409});
 pass('only an authenticated admin applies the server packet; application keeps a private draft, records AI honestly and preserves existing drafts');
 const published=await a.api('posts/'+applied.postId+'/publish',{method:'POST',body:{revision:1}});
 data=await a.api('posts/'+applied.postId);assert.equal(data.snapshot.publication.factCheck.kind,'ai');assert.equal(data.snapshot.publication.factCheck.evidenceId,fictional[0].id);assert.equal(data.snapshot.publication.approvedByName,'가상 적용 관리자');assert.equal(data.snapshot.publication.factCheck.reviewerName,'Codex (AI 검토)');
 const live=(await anon.request(published.url)).data;assert(live.includes('Codex (AI 검토)'));assert(live.includes('£33,000'));assert(live.includes('<table>'));
 pass('separate publication seals the AI evidence and actual publication operator without a false human fact-check event');
 await a.api('posts/'+applied.postId,{method:'PUT',body:{...data.snapshot,revision:data.post.revision,title:'가상 변경된 조건',publication:{factCheck:{kind:'ai',reviewerName:'forged'}}}});
 data=await a.api('posts/'+applied.postId);assert.equal(data.factReview,null);assert(!data.snapshot.publication);
 await a.api('posts/'+applied.postId+'/publish',{method:'POST',body:{revision:data.post.revision},expected:400});
 assert.equal((await anon.request(published.url)).data,live);
 const reapplied=await a.api(route,{method:'POST',body:{revision:data.post.revision}});assert.equal(reapplied.postId,applied.postId);
 data=await a.api('posts/'+applied.postId);assert(data.factReview?.kind==='ai');assert.equal(data.post.slug,published.url.split('/')[2]);
 const old=await f.db.prepare('SELECT snapshot FROM cms_versions WHERE post_id=? AND revision=3').bind(applied.postId).first();assert(JSON.parse(old.snapshot).title==='가상 변경된 조건');
 pass('content edits invalidate review; reapplication is an explicit new immutable revision and keeps the live approval and URL');
 naverHTML[id]=naverHTML[id].replace('최신 조건','변경된 조건');
 await a.api('posts/'+applied.postId+'/publish',{method:'POST',body:{revision:data.post.revision},expected:409});
 assert.equal((await anon.request(published.url)).data,live);
 await a.api(route,{method:'POST',body:{revision:data.post.revision},expected:409});
 pass('publication rereads the source and rejects a changed original; neither an old hash nor client checks can force approval');
 const unavailable=fictional[1];await a.api('naver/url',{method:'POST',body:{url:unavailable.sourceURL}});const ready=await a.api('naver/items/'+unavailable.sourceId+'/codex-reviewed',{method:'POST',body:{onlyNew:true}});
 delete naverHTML[unavailable.sourceId];await a.api('posts/'+ready.postId+'/publish',{method:'POST',body:{revision:1},expected:400});
 const expired=fictional[4];await a.api('naver/url',{method:'POST',body:{url:expired.sourceURL}});await a.api('naver/items/'+expired.sourceId+'/codex-reviewed',{method:'POST',body:{onlyNew:true},expected:409});
 await a.api('naver/items/999999999999/codex-reviewed',{method:'POST',body:{},expected:404});
 pass('unreadable sources, expired evidence and non-catalogue articles fail closed; no general AI approval or paid API is activated');
 console.log('OK:',checks.length,'Codex review checks');
 if(process.env.CMS_CODEX_UI_FIXTURE){console.log('Fictional UI fixture:',f.base);await new Promise(()=>{});}
}finally{await f.mf.dispose();}
