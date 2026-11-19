/** Home integration uses only fictional local accounts and approved snapshots. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
import {homePage} from '../cms/server/home.js';
const f=await fixture({port:process.env.CMS_HOME_UI_FIXTURE?8802:undefined});
const admin=f.client(),reader=f.client(),checks=[];
const pass=name=>{checks.push(name);console.log('PASS',name);};
const data={schemaVersion:2,category:'어학연수',contentType:'guide',delta:{ops:[{insert:'실제 학교 정보가 아닌 홈페이지 검증용 가상 글입니다.\n'}]}};
async function draft(title){const {id}=await admin.api('posts',{method:'POST',body:{},expected:201});await admin.api('posts/'+id,{method:'PUT',body:{...data,title,summary:'공개 승인본의 가상 요약입니다.',revision:1}});return id;}
async function read(id){return admin.api('posts/'+id);}
async function publish(id){const current=await read(id);return admin.api('posts/'+id+'/publish',{method:'POST',body:{revision:current.post.revision}});}
try{
 const empty=(await reader.request('/')).data;
 assert(empty.includes('영국 유학, 어학연수'));assert(empty.includes('내 조건에서'));assert(empty.includes('class="note-card note-fallback"'));
 assert(!empty.includes('홈페이지를 준비하고 있습니다'));assert(!empty.includes('파고다'));
 for(const name of ['이정민','이경민','이경호'])assert(empty.includes(name));
 const schema=JSON.parse(empty.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert(schema['@graph'].some(x=>x['@id']==='https://uksinchon.com/#organization'));assert(!empty.includes('FAQPage'));assert(!empty.includes('aggregateRating'));
 assert(empty.includes('rel="canonical" href="https://uksinchon.com/"'));assert(!empty.includes('name="robots"'));
 pass('the full home, real staff and consultation links remain available before CMS setup, with truthful schema and category fallbacks');

 await admin.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'Admin',email:'home-admin@example.test',password:PASSWORD}});
 const ids=[];
 for(let i=0;i<3;i++){const id=await draft('홈 화면 가상 공개 노트 '+i);await publish(id);ids.push(id);}
 const malicious=await draft('<script>가상 XSS</script> $&');await publish(malicious);ids.push(malicious);
 const privateId=await draft('노출되면 안 되는 가상 비공개 제목');
 let page=(await reader.request('/')).data;
 assert.equal((page.match(/class="note-card"/g)||[]).length,3);assert(!page.includes('note-fallback'));
 assert(!page.includes('홈 화면 가상 공개 노트 0'));assert(!page.includes('노출되면 안 되는 가상 비공개 제목'));
 assert(page.includes('&lt;script&gt;가상 XSS&lt;/script&gt; $&'));assert(!page.includes('<script>가상 XSS'));
 assert(page.includes('영국유학센터 신촌점 · 발행'));assert(!page.includes('Admin · 발행'));
 const item=await read(malicious);assert(page.includes('/blog/'+item.post.slug+'/'));
 pass('initial HTML contains only the latest three approved posts, escapes titles and literal dollar sequences, and uses consistent public author attribution');

 await admin.api('posts/'+malicious,{method:'PUT',body:{...item.snapshot,title:'발행 전 수정된 가상 제목',revision:item.post.revision}});
 page=(await reader.request('/')).data;assert(page.includes('&lt;script&gt;가상 XSS&lt;/script&gt;'));assert(!page.includes('발행 전 수정된 가상 제목'));
 await publish(malicious);page=(await reader.request('/')).data;assert(page.includes('발행 전 수정된 가상 제목'));assert(!page.includes('&lt;script&gt;가상 XSS&lt;/script&gt;'));
 const versionsBefore=(await f.db.prepare('SELECT COUNT(*) AS n FROM cms_versions').first()).n;
 await reader.request('/');await reader.request('/?utm_source=fixture');
 assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM cms_versions').first()).n,versionsBefore);
 pass('editing keeps the old approved home title until republication; homepage reads never modify drafts or publication history');

 let current=await read(malicious);await admin.api('posts/'+malicious+'/unpublish',{method:'POST',body:{revision:current.post.revision}});
 page=(await reader.request('/')).data;assert(!page.includes('/blog/'+current.post.slug+'/'));assert(page.includes('홈 화면 가상 공개 노트 0'));
 current=await read(ids[2]);await admin.api('posts/'+ids[2]+'/trash',{method:'POST',body:{revision:current.post.revision}});
 page=(await reader.request('/')).data;assert(!page.includes('/blog/'+current.post.slug+'/'));assert.equal((page.match(/class="note-card"/g)||[]).length,2);
 await reader.request('/blog/'+current.post.slug+'/',{expected:404});
 pass('unpublishing and trash immediately remove posts from home, without filling remaining slots with fake articles');

 const canonical=await reader.request('/index.html?utm_source=fixture',{expected:308});assert.equal(canonical.response.headers.get('Location'),'/?utm_source=fixture');
 await reader.request('/index.html',{method:'POST',expected:405});await reader.request('/',{method:'POST',expected:405});
 const head=await reader.request('/',{method:'HEAD'});assert.equal(head.data,'');assert(head.response.headers.get('Cache-Control').includes('must-revalidate'));
 assert(!head.response.headers.has('ETag'));
 pass('legacy index URLs redirect once with query parameters preserved; HEAD and method handling are explicit and dynamic HTML has no stale asset ETag');

 const raw=fs.readFileSync('index.html','utf8');let forwarded;
 const offline=await homePage({request:new Request('https://fixture.test/',{method:'HEAD',headers:{'If-None-Match':'old-asset'}}),env:{CMS_DB:{prepare(){throw new Error('fictional database outage');}}},next:async r=>{forwarded=r;return new Response(raw,{headers:{'Content-Type':'text/html','ETag':'old-asset','Last-Modified':'old','Content-Encoding':'gzip'}});}});
 assert.equal(await offline.text(),'');assert.equal(forwarded.method,'GET');assert(!forwarded.headers.has('If-None-Match'));assert(!offline.headers.has('Content-Encoding'));assert(!offline.headers.has('Last-Modified'));
 const fallback=await homePage({request:new Request('https://fixture.test/'),env:{},next:async()=>new Response(raw,{headers:{'Content-Type':'text/html'}})});
 assert((await fallback.text()).includes('note-fallback'));
 pass('missing or failing CMS storage keeps the real static home usable and response headers match the generated body');

 for(const match of raw.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  const href=match[1];assert(!href.startsWith('javascript:'));
  if(href.startsWith('#'))assert(raw.includes('id="'+href.slice(1)+'"'),href);
  else if(href.startsWith('/'))assert(['/','/blog/','/pharmacy/','/counsel/','/admin/','/hello-uk/','/study-path/'].some(prefix=>href.split('?')[0]===prefix)||href==='/counsel/privacy.html'||href.startsWith('/blog/?'),href);
 }
 for(const match of raw.matchAll(/src="(\/assets\/home\/[^\"]+)"/g))assert(fs.existsSync('.'+match[1]));
 assert(!raw.includes('<form'));assert.equal((raw.match(/<!--home-notes:start-->/g)||[]).length,1);
 pass('all home anchors, owned staff images and consultation destinations are concrete; the home collects no new form data');

 const report={passed:checks.length,checks,productionDataModified:false};fs.writeFileSync('/workspace/신촌점_메인_서버검증.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(process.env.CMS_HOME_UI_FIXTURE){console.log('HOME FIXTURE READY '+f.base);await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await f.mf.dispose();}
