/** Sinchon reviews board: fictional local accounts and posts only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,SETUP_KEY,PASSWORD} from './lib/seo-fixture.mjs';
const f=await fixture({});
const admin=f.client(),reader=f.client(),checks=[];
const pass=n=>{checks.push(n);console.log('PASS',n);};
async function post(title,category,{publish=true}={}){
 const {id}=await admin.api('posts',{method:'POST',body:{},expected:201});
 await admin.api('posts/'+id,{method:'PUT',body:{schemaVersion:2,title,summary:title+' 요약',category,contentType:'case',delta:{ops:[{insert:'가상 본문입니다.\n'}]},revision:1}});
 if(publish)await admin.api('posts/'+id+'/publish',{method:'POST',body:{revision:2}});
 return (await admin.api('posts/'+id)).post;
}
try{
 let home=(await reader.request('/')).data;
 assert(home.includes('<!--home-reviews:start-->')&&home.includes('www.ukcentre.co.kr/review/'));
 assert(home.includes('href="/reviews/"')&&home.includes('href="https://www.ukcentre.co.kr/intro/"'));
 pass('before any review the home keeps the three linked head-office stories and links to /reviews/ and the head-office introduction');

 await admin.api('setup',{method:'POST',body:{setupToken:SETUP_KEY,name:'Admin',email:'reviews@example.test',password:PASSWORD}});
 const note=await post('가상 어학연수 노트','어학연수');
 const review=await post('가상 신촌점 후기 – 리즈 석사','신촌점 후기');
 const draft=await post('가상 비공개 후기','신촌점 후기',{publish:false});
 assert.equal((await admin.api('posts/'+review.id)).snapshot.categoryCode,'reviews');
 pass('staff write a review with the same editor by choosing the 신촌점 후기 category');

 const blog=(await reader.request('/blog/')).data;
 assert(blog.includes('가상 어학연수 노트')&&!blog.includes('가상 신촌점 후기'));
 assert(!/category=reviews/.test(blog));
 const board=(await reader.request('/reviews/')).data;
 assert(board.includes('가상 신촌점 후기 – 리즈 석사')&&!board.includes('가상 어학연수 노트')&&!board.includes('가상 비공개 후기'));
 assert(board.includes('rel="canonical" href="https://uksinchon.com/reviews/"'));
 pass('reviews appear only on /reviews/ (published ones), never in the UK note list or its category tabs');

 const moved=await reader.request('/blog/?category=reviews',{expected:308});assert.equal(moved.response.headers.get('Location'),'/reviews/');
 await reader.request('/reviews',{expected:308});await reader.request('/reviews/?page=0',{expected:404});
 const article=(await reader.request('/blog/'+review.slug+'/')).data;
 assert(article.includes('<a href="/reviews/">신촌점 후기</a>')&&article.includes('"name":"신촌점 후기"'));
 const noteArticle=(await reader.request('/blog/'+note.slug+'/')).data;assert(noteArticle.includes('<a href="/blog/">신촌 UK 노트</a>'));
 pass('a review page links back to the reviews board in its breadcrumb; the old category URL redirects to /reviews/');

 home=(await reader.request('/')).data;
 const notes=home.match(/<!--home-notes:start-->([\s\S]*?)<!--home-notes:end-->/)[1];
 const revs=home.match(/<!--home-reviews:start-->([\s\S]*?)<!--home-reviews:end-->/)[1];
 assert(notes.includes('가상 어학연수 노트')&&!notes.includes('가상 신촌점 후기'));
 assert(revs.includes('/blog/'+review.slug+'/')&&!revs.includes('ukcentre.co.kr/review/'));
 const site=(await reader.request('/sitemap.xml')).data;assert(site.includes('/reviews/')&&site.includes('/team/'));
 pass('the home shows the latest reviews in the stories section and keeps them out of the UK note cards; the sitemap lists /reviews/ and /team/');

 const team=fs.readFileSync('team/index.html','utf8');
 for(const t of ['이정민','이경민','이경호','수속 진행 가능 분야','오시는 길','UK Certified Education Counsellor'])assert(team.includes(t),t);
 assert(!team.includes('ukcentre.co.kr/intro'));
 pass('the team page holds the full Sinchon introduction without sending visitors to the head-office site');
}finally{await f.close?.();}
console.log(JSON.stringify({passed:checks.length}));process.exit(0);
