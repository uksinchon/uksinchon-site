/** All posts, accounts, source HTML and image responses are fictional and local. */
import assert from 'node:assert/strict';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
import {fictionalPNG,FICTIONAL_WEBP,imageFixture} from './lib/naver-image-fixture.mjs';
import {naverImageURL,rasterInfo,downloadNaverImage,MAX_NAVER_IMAGE_BYTES} from '../cms/server/naver-images.js';
import {digest} from '../cms/server/naver.js';
const checks=[];const pass=message=>{checks.push(message);console.log('PASS',message);};
for(const value of ['http://postfiles.pstatic.net/a.png','https://postfiles.pstatic.net.evil.test/a','https://127.0.0.1/a','https://[::1]/a','file:///etc/passwd','https://user:password@postfiles.pstatic.net/a','https://postfiles.pstatic.net:8443/a','https://pstatic.net/a'])assert.equal(naverImageURL(value),null);
assert(naverImageURL('https://postfiles.pstatic.net/a.png'));assert(naverImageURL('https://storep-phinf.pstatic.net/a.png'));
assert.deepEqual(rasterInfo(fictionalPNG()),{type:'image/png',extension:'png',width:16,height:12});assert.equal(rasterInfo(FICTIONAL_WEBP).width,16);
const apng=Buffer.concat([fictionalPNG().subarray(0,33),Buffer.from('000000006163544c00000000','hex'),fictionalPNG().subarray(33)]);assert.equal(rasterInfo(apng),null);
const animatedWebp=Buffer.from('524946461600000057454250565038580a000000020000000f00000b0000','hex');assert.equal(rasterInfo(animatedWebp),null);
// SOF header fixture exercises bounded JPEG dimension parsing, not image decoding.
const jpeg=Buffer.from('ffd8ffc0000b08000c001001011100ffd9','hex');assert.equal(rasterInfo(jpeg).height,12);assert.equal(rasterInfo(Buffer.from('<svg/>')),null);
pass('only HTTPS Naver image hosts are accepted; raster headers validate dimensions without accepting HTML or SVG');

const url='https://postfiles.pstatic.net/fictional/unit.png',key=await digest(url),item={source_complete:1,source_hash:'fictional-source',images:JSON.stringify([url])},body={sourceHash:item.source_hash,key};
let calls=0;
const good=async(target,options)=>{calls++;assert.equal(target,url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert(!options.headers.Cookie&&!options.headers.Authorization);return new Response(fictionalPNG(),{headers:{'Content-Type':'image/png'}});};
const downloaded=await downloadNaverImage(item,'0',body,good);assert.equal(downloaded.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),fictionalPNG());assert.equal(calls,1);
for(const [candidate,index,params,status] of [[item,'0',{...body,key:'changed'},409],[item,'-1',body,404],[item,'200',body,404],[item,'0',{...body,sourceHash:'changed'},409],[{...item,source_complete:0},'0',body,409],[{...item,images:JSON.stringify(['https://postfiles.pstatic.net/another.png'])},'0',body,409]])await assert.rejects(downloadNaverImage(candidate,index,params,good),e=>e.status===status);
assert.equal(calls,1);
pass('download is bound to stored source, exact image key and index; stale or swapped image lists fail before any external request');

const badResponses=[
 [()=>new Response(null,{status:302,headers:{Location:'http://169.254.169.254/'}}),502],
 [()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}}),415],
 [()=>new Response('<html/>',{headers:{'Content-Type':'image/jpeg'}}),415],
 [()=>new Response('GIF89a',{headers:{'Content-Type':'image/gif'}}),415],
 [()=>new Response(fictionalPNG(),{headers:{'Content-Type':'image/png','Content-Length':String(MAX_NAVER_IMAGE_BYTES+1)}}),413],
 [()=>new Response(new Uint8Array(MAX_NAVER_IMAGE_BYTES+1),{headers:{'Content-Type':'image/png'}}),413],
 [()=>{const data=fictionalPNG();data.writeUInt32BE(25000,16);return new Response(data,{headers:{'Content-Type':'image/png'}});},413],
 [()=>{throw new Error('fictional connection failure');},502]
];
for(const [make,status] of badResponses)await assert.rejects(downloadNaverImage(item,'0',body,async()=>make()),e=>e.status===status);
const external='https://external.example.test/a.png';await assert.rejects(downloadNaverImage({...item,images:JSON.stringify([external])},'0',{...body,key:await digest(external)},good),e=>e.status===400);assert.equal(calls,1);
pass('redirects, unsupported or disguised files, oversized headers/streams/dimensions and connection failures are rejected without arbitrary URL fetching');

const source=imageFixture();const f=await fixture({port:process.env.CMS_NAVER_IMAGES_UI_FIXTURE?8799:undefined,naverHTML:source.naverHTML,imageResponses:source.imageResponses});
const a=f.client(),staff=f.client(),anonymous=f.client();
try{
 await a.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'가상 사진 관리자',email:'images-admin@example.test',password:PASSWORD}});
 await a.api('users',{method:'POST',body:{name:'가상 사진 직원',email:'images-author@example.test',password:PASSWORD},expected:201});await staff.api('login',{method:'POST',body:{email:'images-author@example.test',password:PASSWORD}});await staff.api('password',{method:'POST',body:{currentPassword:PASSWORD,password:PASSWORD}});
 const registered=await a.api('naver/url',{method:'POST',body:{url:'https://blog.naver.com/pedu2/'+source.id}});const sourceHash=registered.item.source_hash;
 const base='naver/items/'+source.id+'/images',query='?'+new URLSearchParams({sourceHash});
 await anonymous.api(base+query,{expected:401});await staff.api(base+query,{expected:403});
 const list=await a.api(base+query);assert.equal(list.images.length,14);assert(list.images[0].available);assert(!list.images[3].available);const path=index=>base+'/'+index+'?'+new URLSearchParams({sourceHash,key:list.images[index].key});
 await anonymous.request('/api/cms/'+path(0),{expected:401});await staff.request('/api/cms/'+path(0),{expected:403});
 const image=await a.request('/api/cms/'+path(0));assert.equal(image.response.headers.get('Content-Type'),'image/png');assert.equal(image.response.headers.get('Cache-Control'),'private, no-store');assert.equal(image.response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(image.response.headers.get('X-Robots-Tag'),'noindex, nofollow');
 await a.api(base+'/0?'+new URLSearchParams({sourceHash,key:'wrong'}),{expected:409});await a.api(path(2),{expected:415});await a.api(path(3),{expected:400});await a.api(path(4),{expected:415});
 assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM cms_media').first()).n,0);
 pass('real Workers routes keep image lists and bytes administrator-only, private and noindex; preview/download creates no media or posts');

 const draft=await a.api('naver/items/'+source.id+'/draft',{method:'POST',body:{mode:'manual'}});let current=await a.api('posts/'+draft.postId);
 const uploaded=await a.api('posts/'+draft.postId+'/images',{method:'POST',body:FICTIONAL_WEBP,headers:{'Content-Type':'image/webp'},expected:201});await anonymous.request(uploaded.url,{expected:404});
 const patch={...current.snapshot,appliesTo:'가상 2027년도',verifiedAt:'2026-11-06',reviewScope:'가상 조건과 가상 사진만 대조',sourceDetails:[{url:'https://example.org/fictional-official',title:'가상 공식 출처',publisher:'가상 기관',kind:'official'}],imageMeta:{[uploaded.id]:{source:source.urls[0]}},delta:{ops:[...current.snapshot.delta.ops,{insert:{image:uploaded.url}},{insert:'\n'}]},revision:current.post.revision};
 await a.api('posts/'+draft.postId,{method:'PUT',body:patch});current=await a.api('posts/'+draft.postId);assert(!current.snapshot.publication);assert.equal(current.factReview,null);assert.equal(current.snapshot.imageMeta[uploaded.id].rights,'');assert.equal(current.snapshot.imageMeta[uploaded.id].alt,'');
 await a.api('posts/'+draft.postId+'/publish',{method:'POST',body:{revision:current.post.revision},expected:400});
 current.snapshot.imageMeta[uploaded.id].alt='직접 생성한 가상 초록색 사각형';current.snapshot.imageMeta[uploaded.id].rights='검증용으로 직접 생성한 이미지';await a.api('posts/'+draft.postId,{method:'PUT',body:{...current.snapshot,revision:current.post.revision}});current=await a.api('posts/'+draft.postId);
 const reviewChecks={facts:true,conditions:true,rights:true};await a.api('naver/items/'+source.id+'/review',{method:'POST',body:{revision:current.post.revision,sourceHash,checks:reviewChecks}});await a.api('posts/'+draft.postId+'/factcheck',{method:'POST',body:{revision:current.post.revision,checks:reviewChecks}});
 const published=await a.api('posts/'+draft.postId+'/publish',{method:'POST',body:{revision:current.post.revision}});const html=(await anonymous.request(published.url)).data;assert(html.includes('src="/media/'));assert(!html.includes('<img src="https://postfiles.pstatic.net'));await anonymous.request(uploaded.url);
 assert.equal((await a.api('naver/items/'+source.id)).item.images,registered.item.images);
 pass('imported bytes use existing private WebP storage; source metadata persists and optional descriptions/rights persist and publication still requires current source review');

 current=await a.api('posts/'+draft.postId);await a.api('posts/'+draft.postId+'/trash',{method:'POST',body:{revision:current.post.revision}});await a.api(base+query,{expected:410});await a.api(path(0),{expected:410});
 pass('trashed articles cannot download or import source images');

 // A fresh connected draft for the browser workflow; never a production post.
 await a.api('posts/'+draft.postId+'/restore',{method:'POST',body:{revision:current.post.revision+1}});
 if(process.env.CMS_NAVER_IMAGES_UI_FIXTURE){const clean=await a.api('posts/'+draft.postId);await a.api('posts/'+draft.postId,{method:'PUT',body:{...clean.snapshot,revision:clean.post.revision,changeNote:'가상 사진 제거 후 화면 검증 준비',imageMeta:{},heroImageId:'',delta:{ops:clean.snapshot.delta.ops.filter(op=>typeof op.insert==='string')}}});}
 console.log('OK:',checks.length,'Naver image checks');
 if(process.env.CMS_NAVER_IMAGES_UI_FIXTURE){console.log('NAVER IMAGES FIXTURE READY',f.base,draft.postId);await new Promise(resolve=>process.once('SIGTERM',resolve));}
}finally{await f.mf.dispose();}
