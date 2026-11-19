/** Home note cards show a published photo from each note; only fictional local data is used. */
import assert from 'node:assert/strict';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
const f=await fixture({port:process.env.CMS_HOME_IMG_FIXTURE?8803:undefined});
const admin=f.client(),reader=f.client(),checks=[];
const pass=name=>{checks.push(name);console.log('PASS',name);};
const photo=Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoQAAwAAUAmJZACdLoAA5gA/t+APtTYqp53f4tpHQpPAAAA','base64');
async function note(title,build){
 const {id}=await admin.api('posts',{method:'POST',body:{},expected:201});
 const imgs=[];for(let i=0;i<2;i++)imgs.push(await admin.api('posts/'+id+'/images',{method:'POST',body:photo,headers:{'Content-Type':'image/webp'},expected:201}));
 const cur=await admin.api('posts/'+id);
 await admin.api('posts/'+id,{method:'PUT',body:{...cur.snapshot,schemaVersion:2,title,summary:'가상 요약',category:'어학연수',contentType:'news',...build(imgs),revision:cur.post.revision}});
 const now=await admin.api('posts/'+id);await admin.api('posts/'+id+'/publish',{method:'POST',body:{revision:now.post.revision}});
 return {id,imgs};
}
const meta=(imgs,extra={})=>Object.fromEntries(imgs.map(m=>[m.id,{alt:'가상 사진',rights:'직접 만든 가상 이미지',...extra}]));
const body=(imgs)=>({ops:[{insert:'가상 본문입니다.\n'},...imgs.map(m=>({insert:{image:m.url}})),{insert:'\n'}]});
try{
 await admin.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'Admin',email:'home-img@example.test',password:PASSWORD}});
 const plain=await note('본문 사진만 있는 가상 노트',imgs=>({imageMeta:meta(imgs),delta:body(imgs)}));
 const hero=await note('대표 사진을 고른 가상 노트',imgs=>({imageMeta:meta(imgs),heroImageId:imgs[1].id,delta:body(imgs)}));
 const deco=await note('장식 사진만 있는 가상 노트',imgs=>({imageMeta:meta(imgs,{decorative:true}),delta:body(imgs)}));
 const page=(await reader.request('/')).data;
 assert.equal((page.match(/class="note-card"/g)||[]).length,3);
 assert(page.includes('/media/'+plain.imgs[0].id),'first body photo is used when no hero is chosen');
 assert(page.includes('/media/'+hero.imgs[1].id)&&!page.includes('/media/'+hero.imgs[0].id),'chosen hero photo wins');
 assert(!deco.imgs.some(m=>page.includes('/media/'+m.id))&&page.includes('note-thumb-empty'),'decorative photos are skipped');
 pass('home note cards use the hero photo, else the first body photo, and skip decorative ones');
 for(const m of [plain.imgs[0],hero.imgs[1]])await reader.request('/media/'+m.id,{expected:200});
 pass('every photo shown on the home card is publicly served');
 // A photo added to a draft after publication must not appear until republished.
 const extra=await admin.api('posts/'+deco.id+'/images',{method:'POST',body:photo,headers:{'Content-Type':'image/webp'},expected:201});
 const cur=await admin.api('posts/'+deco.id);
 await admin.api('posts/'+deco.id,{method:'PUT',body:{...cur.snapshot,imageMeta:{...cur.snapshot.imageMeta,[extra.id]:{alt:'새 가상 사진',rights:'가상'}},heroImageId:extra.id,delta:{ops:[...cur.snapshot.delta.ops,{insert:{image:extra.url}},{insert:'\n'}]},revision:cur.post.revision}});
 assert(!(await reader.request('/')).data.includes('/media/'+extra.id));
 pass('unpublished draft photos never reach the home page');
}finally{await f.close?.();}
console.log(JSON.stringify({passed:checks.length,checks},null,1));process.exit(0);
