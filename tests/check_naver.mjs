/** Isolated Workers/D1 integration. All network and AI responses are fixtures. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve(process.env.CMS_TOOLING_DIR||'/tmp/uksinchon-cms-tools','package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');const {build}=require('esbuild');
const root=process.cwd();const out=path.join(root,'.wrangler/naver-test-worker.js');fs.mkdirSync(path.dirname(out),{recursive:true});
const entry=`import {handleCMS} from ${JSON.stringify(path.join(root,'cms/server/api.js'))};import {publicBlog} from ${JSON.stringify(path.join(root,'cms/server/pages.js'))};export default{fetch(request,env){const ai=request.headers.get('x-fixture-ai')==='yes';const settings={...env,OPENAI_API_KEY:ai?'fixture-api-key':undefined,CMS_REWRITE_MODEL:ai?'fixture-model':undefined};const u=new URL(request.url);if(u.pathname.startsWith('/api/cms/'))return handleCMS({request,env:settings});if(u.pathname.startsWith('/blog/')&&u.pathname!=='/blog/styles.css')return publicBlog({request,env:settings});return fetch('https://fixture-assets.local'+u.pathname);}}`;
await build({stdin:{contents:entry,resolveDir:root},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:out});
const quote='2027년 일반영어 24주 과정은 원문 기준 주당 £300이며 예약 조건과 숙소 비용을 별도로 확인해야 합니다.';
let ids=['111111111','222222222'];let changed=false;let badBody=new Set();let aiMode='valid',aiCalls=0,bodyCalls=0,aiGate=null,gateEntered=false;
const title=id=>'가상 어학연수 안내 '+id;
const bodyText=()=>quote+(changed?' 추가 조건은 학교에 다시 확인해 주세요.':'')+' 학생의 목표와 수업량을 함께 검토하고 해당 가격표의 적용 기간과 포함하지 않은 비용을 확인합니다.';
const feed=()=>`<?xml version="1.0"?><rss><channel>${ids.map(id=>`<item><title><![CDATA[${title(id)}]]></title><link>https://blog.naver.com/pedu2/${id}?fromRss=true</link><description><![CDATA[<p>${quote.slice(0,35)}${changed?'changed':''}...</p>]]></description><pubDate>Mon, 02 Nov 2026 11:00:00 +0900</pubDate></item>`).join('')}</channel></rss>`;
const html=id=>badBody.has(id)?'<html>private or unavailable</html>':`<html><head><meta property="og:title" content="${title(id)}"></head><body><div class="se-main-container"><div><p>${bodyText()}</p><img src="https://postfiles.pstatic.net/fixture.jpg"><p>위의 내용은 가상 테스트이며 실제 학교 가격이 아닙니다.</p></div></div></body></html>`;
function aiOutput(input){const evidence=aiMode==='bad-evidence'?'원문에 존재하지 않는 가상의 근거 문구':quote;return {title:aiMode==='bad-number'?'2027년 24주 과정 £999 견적':'2027년 일반영어 24주, 비용 비교 전 확인할 조건',summary:'원문에 안내된 금액과 적용 조건을 나누어 확인합니다.',category:'어학연수',answer:quote,answer_evidence:evidence,sections:[{heading:'가격과 적용 조건',paragraphs:[quote],bullets:['수업량과 숙소 비용을 별도로 확인합니다.'],evidence}],questions:[],review_notes:['사진 속 조건은 별도 확인해 주세요.']};}
const mf=new Miniflare(convertV4MiniflareOptions({...(process.env.CMS_NAVER_UI_FIXTURE?{host:'127.0.0.1',port:8794}:{}),modules:true,script:fs.readFileSync(out,'utf8'),compatibilityDate:'2026-10-30',d1Databases:{CMS_DB:'naver-test-database'},bindings:{CMS_LOCAL_DEV:'true',CMS_SETUP_TOKEN:'fixture-setup-key-never-used-in-production',CMS_NAVER_CRON_TOKEN:'fixture-cron-key-never-used-in-production'},outboundService:async request=>{
 const u=new URL(request.url);
 if(u.hostname==='fixture-assets.local'){
  const assets=path.join(root,'.wrangler/dev-public');let target=path.resolve(assets,'.'+decodeURIComponent(u.pathname));if(!target.startsWith(assets+'/'))return new Response('not found',{status:404});if(u.pathname.endsWith('/'))target=path.join(target,'index.html');if(!fs.existsSync(target))return new Response('not found',{status:404});const ext=path.extname(target);return new Response(fs.readFileSync(target),{headers:{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon'})[ext]||'text/plain','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}});
 }
 if(u.hostname==='rss.blog.naver.com')return new Response(feed(),{headers:{'Content-Type':'text/xml'}});
 if(u.hostname==='blog.naver.com'){bodyCalls++;return new Response(html(u.searchParams.get('logNo')),{headers:{'Content-Type':'text/html'}});}
 if(u.hostname==='api.openai.com'){aiCalls++;gateEntered=true;if(aiGate)await aiGate;const b=await request.json();const input=JSON.parse(b.input);assert.equal(b.store,false);assert(!b.tools);return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(aiOutput(input))}]}]}),{headers:{'Content-Type':'application/json'}});}
 throw new Error('Unexpected outbound request '+u.hostname);
}}));
let cookie='';const checks=[];const pass=name=>{checks.push(name);console.log('PASS',name);};
async function api(route,{method='GET',body,expected=200,ai=false,cron=false,origin='https://cms.test',useCookie=true,cronKey=true}={}){
 const headers={Origin:origin,...(useCookie&&cookie?{Cookie:cookie}:{}),...(ai?{'x-fixture-ai':'yes'}:{}),...(cron&&cronKey?{Authorization:'Bearer fixture-cron-key-never-used-in-production'}:{})};if(body!==undefined)headers['Content-Type']='application/json';
 const response=await mf.dispatchFetch('https://cms.test/api/cms/'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,expected,JSON.stringify({route,status:response.status,data}));if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];return data;
}
async function publicRead(slug,status=200){const r=await mf.dispatchFetch('https://cms.test/blog/'+slug+'/');assert.equal(r.status,status);return r.text();}
try {
 await api('setup',{method:'POST',body:{setupToken:'fixture-setup-key-never-used-in-production',name:'가상 관리자',email:'admin@example.test',password:'FictionalPassword123!'}});
 const manualId=(await api('posts',{method:'POST',body:{},expected:201})).id;assert.equal((await api('posts/'+manualId)).naver,null);
 pass('migration is lazy and existing manual drafts work before Naver tables exist');
 const adminCookie=cookie;
 await api('users',{method:'POST',body:{name:'가상 직원',email:'writer@example.test',password:'TemporaryPassword123!'},expected:201});
 await api('login',{method:'POST',body:{email:'writer@example.test',password:'TemporaryPassword123!'}});
 await api('password',{method:'POST',body:{currentPassword:'TemporaryPassword123!',password:'ChangedPassword123!'}});
 await api('naver',{expected:403});cookie=adminCookie;
 pass('ordinary staff cannot access the Naver source inbox or its original content');

 await api('naver',{useCookie:false,expected:401});await api('naver/config',{method:'POST',body:{enabled:true},origin:'https://other.test',expected:403});
 await api('naver/config',{method:'POST',body:{enabled:true}});
 let result=await api('naver/check',{method:'POST',body:{},ai:true});assert(result.baseline&&result.count===2);assert.equal(aiCalls,0);assert.equal(bodyCalls,0);assert.equal((await api('posts')).posts.length,1);
 pass('first sync baselines old posts without body fetches, AI calls or duplicate drafts');
 await api('naver/check',{method:'POST',body:{},ai:true});assert.equal(aiCalls,0);
 ids.push('333333333');result=await api('naver/check',{method:'POST',body:{}});assert.equal(result.waiting,1);let inbox=await api('naver');assert.equal(inbox.items.find(x=>x.id==='333333333').status,'awaiting_ai');assert.equal(aiCalls,0);
 pass('new RSS item fetches full text and waits honestly when no AI key is configured');
 await api('naver/cron',{method:'POST',body:{},useCookie:false,cron:true,cronKey:false,expected:401});
 result=await api('naver/cron',{method:'POST',body:{},useCookie:false,cron:true,ai:true});assert.equal(result.drafts,1);assert.equal(aiCalls,1);
 let item=(await api('naver/items/333333333')).item;let p=(await api('posts/'+item.post_id)).post;let s=(await api('posts/'+item.post_id)).snapshot;
 assert.equal(p.published_revision,null);assert.equal(item.mode,'ai');await publicRead(p.slug,404);
 await api('naver/check',{method:'POST',body:{},ai:true});assert.equal(aiCalls,1);
 await api('posts/'+p.id+'/publish',{method:'POST',body:{revision:p.revision},useCookie:false,cron:true,expected:401});
 pass('authenticated cron creates one unapproved draft; rechecks do not duplicate the post or AI call');
 await api('posts/'+p.id+'/publish',{method:'POST',body:{revision:p.revision},expected:400});
 await api('naver/items/'+item.id+'/review',{method:'POST',body:{revision:p.revision,sourceHash:item.source_hash,checks:{facts:true}},expected:400});
 await api('naver/items/'+item.id+'/review',{method:'POST',body:{revision:p.revision,sourceHash:item.source_hash,checks:{facts:true,conditions:true,rights:true}}});
 await api('posts/'+p.id+'/publish',{method:'POST',body:{revision:p.revision}});assert((await publicRead(p.slug)).includes(item.url));
 pass('publication requires explicit full checklist for the current revision and keeps the original source link');
 const saved=await api('posts/'+p.id,{method:'PUT',body:{...s,title:'사람이 수정한 제목',revision:p.revision}});p.revision=saved.revision;
 await api('posts/'+p.id+'/publish',{method:'POST',body:{revision:p.revision},expected:400});assert(!(await publicRead(p.slug)).includes('사람이 수정한 제목'));
 pass('editing invalidates the reviewed revision while preserving the live approved article');
 changed=true;await api('naver/check',{method:'POST',body:{}});item=(await api('naver/items/'+item.id)).item;assert.equal(item.status,'source_changed');assert.equal(item.source_complete,0);assert((await publicRead(p.slug)).includes('2027년 일반영어'));
 await api('naver/items/'+item.id+'/fetch',{method:'POST',body:{}});item=(await api('naver/items/'+item.id)).item;
 aiMode='bad-number';const before=(await api('posts/'+p.id)).post.revision;await api('naver/items/'+item.id+'/draft',{method:'POST',body:{mode:'ai'},ai:true,expected:400});assert.equal((await api('posts/'+p.id)).post.revision,before);
 aiMode='bad-evidence';await api('naver/items/'+item.id+'/draft',{method:'POST',body:{mode:'ai'},ai:true,expected:400});
 pass('changed sources invalidate review; invented numbers and untraceable evidence cannot become a draft');
 aiMode='valid';let release;aiGate=new Promise(resolve=>release=resolve);gateEntered=false;
 const pending=api('naver/items/'+item.id+'/draft',{method:'POST',body:{mode:'ai'},ai:true,expected:400});
 for(let i=0;i<100&&!gateEntered;i++)await new Promise(r=>setTimeout(r,10));assert(gateEntered);
 s=(await api('posts/'+p.id)).snapshot;const newer=await api('posts/'+p.id,{method:'PUT',body:{...s,title:'AI 처리 중 사람이 저장한 내용',revision:before}});release();await pending;aiGate=null;assert.equal((await api('posts/'+p.id)).post.revision,newer.revision);
 pass('AI result cannot overwrite a human edit made while generation was in progress');
 ids.push('444444444');badBody.add('444444444');await api('naver/check',{method:'POST',body:{}});const missing=(await api('naver/items/444444444')).item;assert.equal(missing.status,'needs_input');assert.equal(missing.source_complete,0);
 await api('naver/items/444444444/draft',{method:'POST',body:{mode:'manual'},expected:400});
 await api('naver/items/444444444/text',{method:'POST',body:{text:bodyText(),confirmed:false},expected:400});await api('naver/items/444444444/text',{method:'POST',body:{text:bodyText(),confirmed:true}});
 const raw=await api('naver/items/444444444/draft',{method:'POST',body:{mode:'manual'}});assert(raw.postId);assert.equal((await api('naver/items/444444444')).item.mode,'manual');
 pass('RSS excerpts cannot masquerade as full source; confirmed manual text creates a clearly labelled non-AI draft');
 ids.push('555555555');aiMode='bad-number';await api('naver/check',{method:'POST',body:{},ai:true});const callsBefore=aiCalls;await api('naver/check',{method:'POST',body:{},ai:true});assert.equal(aiCalls,callsBefore);assert.equal((await api('naver/items/555555555')).item.status,'editing_error');
 await api('naver/url',{method:'POST',body:{url:'https://blog.naver.com/another/333333333'},expected:400});
 pass('AI failures wait for human action rather than incur repeated automatic calls; foreign blogs are rejected');
 const statuses=await api('naver');assert(statuses.config.last_cron_at);
 await api('naver/config',{method:'POST',body:{enabled:false}});const disabled=await api('naver/cron',{method:'POST',body:{},useCookie:false,cron:true,ai:true});assert(disabled.disabled);
 pass('last cron invocation is recorded; disabling source stops scheduled processing');
 const report={passed:checks.length,checks,aiCallsAreFixtures:true,productionPostsPublished:0};fs.writeFileSync('/workspace/신촌점_네이버연동_통합검증.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(process.env.CMS_NAVER_UI_FIXTURE){await mf.ready;console.log('FIXTURE READY http://127.0.0.1:8794');await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await mf.dispose();}
