/** Public attribution regression; all accounts and publications are fictional. */
import assert from 'node:assert/strict';
import {publicAuthor,articlePage,ORIGIN} from '../cms/server/pages.js';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
const team='영국유학센터 신촌점';
const checks=[];const pass=name=>{checks.push(name);console.log('PASS',name);};
for(const name of ['',undefined,'Admin',' ADMIN ','Administrator','editor','관리자','운영자','작성자',team]){
 assert.deepEqual(publicAuthor({authorName:name}),{'@type':'Organization','@id':ORIGIN+'/#organization',name:team,url:ORIGIN+'/'});
}
pass('generic account labels resolve to the branch Organization without inventing a personal author');
const person=publicAuthor({authorName:'가상 실명 작성자',publication:{authorId:'fictional-owner'}});
assert.deepEqual(person,{'@type':'Person',name:'가상 실명 작성자','@id':ORIGIN+'/#author-fictional-owner'});
assert.equal(publicAuthor({authorName:'Admin Smith'})['@type'],'Person');
pass('explicit personal authors and their existing identity are preserved');
const dates={publishedAt:'2026-11-01T01:00:00.000Z',contentModifiedAt:'2026-11-02T02:00:00.000Z'};
const snapshot={authorName:'Admin',title:'가상 작성자 검증',category:'어학연수',summary:'검증용 가상 요약',delta:{ops:[{insert:'검증용 가상 원고\n'}]},publication:{...dates,authorId:'fictional-owner',factCheck:{reviewerName:'Admin',checkedAt:'2026-11-01',scope:'가상 자료 대조'}}};
const post={slug:'story-fictional',published_at:dates.publishedAt};
const schema=html=>JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1])['@graph'][0];
const detail=await articlePage(snapshot,post).text();const data=schema(detail);
assert(detail.includes('<p class="byline">'+team+' · '));assert.equal(data.author.name,team);assert.equal(data.author['@type'],'Organization');assert.equal(data.author.url,ORIGIN+'/');
assert.equal(data.datePublished,dates.publishedAt);assert.equal(data.dateModified,dates.contentModifiedAt);assert(detail.includes('검토 Admin'));
assert.equal(snapshot.authorName,'Admin');
pass('visible detail and JSON-LD share the author while review accountability and dates stay intact');
const preview=articlePage(snapshot,post,true);assert.equal(preview.headers.get('X-Robots-Tag'),'noindex, nofollow');
const draft=await preview.text();assert(draft.includes(team+' · 공개 전 초안'));assert(!draft.includes('application/ld+json'));
const escaped=await articlePage({...snapshot,authorName:'<script>fictional</script>'},post).text();assert(escaped.includes('&lt;script&gt;fictional&lt;/script&gt;'));assert(!escaped.includes('<script>fictional</script>'));
pass('private preview uses the same attribution and explicit names remain safely escaped');
const f=await fixture();
try{
 const a=f.client(),anonymous=f.client();
 await a.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'Admin',email:'public-author@example.test',password:PASSWORD}});
 const {id}=await a.api('posts',{method:'POST',body:{},expected:201});
 await a.api('posts/'+id,{method:'PUT',body:{revision:1,schemaVersion:2,title:'가상 작성자 목록 검증',category:'어학연수',contentType:'news',delta:{ops:[{insert:'실제 학교나 운영 글이 아닌 검증용 원고입니다.\n'}]}}});
 const published=await a.api('posts/'+id+'/publish',{method:'POST',body:{revision:2}});
 const before=await a.api('posts/'+id);
 const live=(await anonymous.request(published.url)).data;
 assert.equal(schema(live).author.name,team);assert.equal(schema(live).author['@type'],'Organization');
 for(const path of ['/blog/','/blog/?category=english']){
  const html=(await anonymous.request(path)).data;
  assert(html.includes('<small>'+team+' · '));assert(!html.includes('<small>Admin · '));assert(html.includes(published.url));
 }
 pass('anonymous published detail and both list views consistently replace Admin with branch attribution');
 const after=await a.api('posts/'+id);assert.deepEqual(after,before);
 assert.equal(after.snapshot.authorName,'Admin');assert.equal(after.snapshot.publication.authorId,after.post.owner_id);
 assert.equal(after.snapshot.publication.approvedByName,'Admin');assert.equal(after.post.revision,3);
 const sitemap=(await anonymous.request('/sitemap.xml')).data;
 assert(sitemap.includes(published.url));assert(sitemap.includes('<lastmod>'+after.snapshot.publication.contentModifiedAt+'</lastmod>'));
 pass('public reads leave original snapshots, ownership, approval, revisions, URLs and sitemap dates unchanged');
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await f.mf.dispose();}
