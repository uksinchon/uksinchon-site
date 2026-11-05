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
 const report={passed:checks.length,checks,productionDataModified:false};fs.writeFileSync('/workspace/SEO_통합검증.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(process.env.CMS_SEO_UI_FIXTURE){console.log('SEO FIXTURE READY '+f.base);await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await f.mf.dispose();}
