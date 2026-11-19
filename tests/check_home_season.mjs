/** Home season cards chosen by an administrator; fictional local accounts and notes only. */
import assert from 'node:assert/strict';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
const f=await fixture({});
const admin=f.client(),reader=f.client(),checks=[];
const pass=n=>{checks.push(n);console.log('PASS',n);};
async function note(title,summary,publish=true){
 const {id}=await admin.api('posts',{method:'POST',body:{},expected:201});
 await admin.api('posts/'+id,{method:'PUT',body:{schemaVersion:2,title,summary,category:'석사·대학원',contentType:'news',delta:{ops:[{insert:'가상 본문입니다.\n'}]},revision:1}});
 if(publish)await admin.api('posts/'+id+'/publish',{method:'POST',body:{revision:2}});
 return (await admin.api('posts/'+id)).post;
}
const card=(page,n)=>page.match(new RegExp('<!--season-'+n+':start-->([\\s\\S]*?)<!--season-'+n+':end-->'))[1];
try{
 let page=(await reader.request('/')).data;
 const defaults=[1,2,3].map(n=>card(page,n));
 assert(defaults[0].includes('수능 4~6등급')&&defaults[1].includes('자동장학금'));
 pass('before any setting the three default season cards render (with the two requested note links)');

 await admin.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'Admin',email:'season@example.test',password:PASSWORD}});
 const a=await note('가상 석사 장학금 노트','가상 요약 A'),draft=await note('가상 비공개 노트','비공개',false);
 const list=await admin.api('season');assert(list.posts.some(p=>p.id===a.id)&&!list.posts.some(p=>p.id===draft.id));
 await admin.api('season/1',{method:'PUT',body:{postId:draft.id},expected:400});
 await admin.api('season/2',{method:'PUT',body:{postId:a.id,tag:'<b>석사</b>',headline:'',body:''}});
 page=(await reader.request('/')).data;
 assert(card(page,2).includes('/blog/'+a.slug+'/')&&card(page,2).includes('가상 석사 장학금 노트')&&card(page,2).includes('&lt;b&gt;석사&lt;/b&gt;'));
 assert.equal(card(page,1),defaults[0]);assert.equal(card(page,3),defaults[2]);
 pass('an administrator links a published note to one card; blank text falls back to the note, input is escaped, other cards stay default');

 await admin.api('season/2',{method:'PUT',body:{postId:a.id,tag:'장학금',headline:'직접 쓴 제목',body:'직접 쓴 설명'}});
 page=(await reader.request('/')).data;assert(card(page,2).includes('직접 쓴 제목')&&card(page,2).includes('직접 쓴 설명'));
 const cur=await admin.api('posts/'+a.id);await admin.api('posts/'+a.id+'/unpublish',{method:'POST',body:{revision:cur.post.revision}});
 page=(await reader.request('/')).data;assert.equal(card(page,2),defaults[1]);
 pass('custom text is used, and if the linked note is unpublished the default card returns automatically');

 const again=await admin.api('posts/'+a.id);await admin.api('posts/'+a.id+'/publish',{method:'POST',body:{revision:again.post.revision}});
 await admin.api('season/2',{method:'PUT',body:{postId:null}});
 page=(await reader.request('/')).data;assert.equal(card(page,2),defaults[1]);
 const staff=f.client();await admin.api('users',{method:'POST',body:{email:'staff-s@example.test',name:'직원',password:PASSWORD},expected:201});
 await staff.api('login',{method:'POST',body:{email:'staff-s@example.test',password:PASSWORD}});
 await staff.request('/api/cms/season',{expected:403});
 pass('reset restores the default card, and staff accounts cannot change the season cards');
}finally{await f.close?.();}
console.log(JSON.stringify({passed:checks.length}));process.exit(0);
