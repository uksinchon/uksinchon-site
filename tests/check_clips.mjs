/** Home Shorts: fictional RSS and an in-memory table only. Set CLIPS_LIVE=1 to also read the real public channel feed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {channelShorts,homeClips,clipsAdmin} from '../cms/server/clips.js';
import {homePage} from '../cms/server/home.js';
const checks=[];const pass=n=>{checks.push(n);console.log('PASS',n);};
const entry=(id,title,short=true,day='2026-11-1')=>`<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><link rel="alternate" href="https://www.youtube.com/${short?'shorts/':'watch?v='}${id}"/><published>${day}7T00:00:00+00:00</published></entry>`;
const feed=`<feed><title>채널</title><link rel="alternate" href="https://www.youtube.com/channel/x"/>${[
 entry('AAAAAAAAAA1','첫 쇼츠 &amp; &lt;script&gt;'),entry('AAAAAAAAAA2','긴 영상',false),entry('AAAAAAAAAA3','둘째'),entry('AAAAAAAAAA4','셋째'),entry('AAAAAAAAAA5','넷째'),entry('AAAAAAAAAA6','다섯째'),entry('bad id!','잘못된 ID')].join('')}</feed>`;
const fakeFetch=async()=>new Response(feed,{status:200});
function fakeDB(){const rows=new Map();return {rows,prepare(sql){let args=[];const st={bind(...a){args=a;return st;},
 async run(){if(sql.startsWith('INSERT'))rows.set(args[0],{video_id:args[0]});if(sql.startsWith('DELETE'))rows.delete(args[0]);return {};},
 async all(){return {results:[...rows.values()]};},async first(){return null;}};return st;}};}

const shorts=await channelShorts(fakeFetch);
assert.deepEqual(shorts.map(v=>v.id),['AAAAAAAAAA1','AAAAAAAAAA3','AAAAAAAAAA4','AAAAAAAAAA5','AAAAAAAAAA6']);
pass('only Shorts with valid IDs are taken from the channel feed; long videos are skipped');

const db=fakeDB();
let html=await homeClips({CMS_DB:db},fakeFetch);
assert.equal((html.match(/class="clip"/g)||[]).length,4);assert(!html.includes('AAAAAAAAAA6'));
assert(html.includes('&lt;script&gt;')&&!html.includes('<script>'));
pass('home shows the latest four Shorts with escaped titles');

const admin={id:'u1',name:'관리자'};
await clipsAdmin(db,['clips','AAAAAAAAAA1'],'POST',{hidden:true},admin,fakeFetch);
html=await homeClips({CMS_DB:db},fakeFetch);
assert(!html.includes('AAAAAAAAAA1')&&html.includes('AAAAAAAAAA6'));
const list=await clipsAdmin(db,['clips'],'GET',null,admin,fakeFetch);assert(list.videos.find(v=>v.id==='AAAAAAAAAA1').hidden);
await clipsAdmin(db,['clips','AAAAAAAAAA1'],'POST',{hidden:false},admin,fakeFetch);
assert((await homeClips({CMS_DB:db},fakeFetch)).includes('AAAAAAAAAA1'));
await assert.rejects(clipsAdmin(db,['clips','<bad>'],'POST',{hidden:true},admin,fakeFetch));
pass('an administrator can hide a Short from the home and show it again; the next one fills its place');

assert.equal(await homeClips({CMS_DB:db},async()=>new Response('',{status:500})),null);
assert.equal(await homeClips({CMS_DB:db},async()=>{throw new Error('offline');}),null);
assert.equal(await homeClips({HOME_CLIPS:'off'},fakeFetch),null);
pass('if YouTube fails the home still renders and the clip section stays hidden');

const template=fs.readFileSync('index.html','utf8');
const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch;
try{
 const res=await homePage({request:new Request('https://uksinchon.com/'),env:{},next:async()=>new Response(template,{headers:{'Content-Type':'text/html'}})});
 const page=await res.text();
 assert(page.includes('<section id="clips" class="section soft" aria-labelledby="clips-title">')&&page.includes('data-video="AAAAAAAAAA1"'));
 globalThis.fetch=async()=>new Response('',{status:503});
 const off=await (await homePage({request:new Request('https://uksinchon.com/'),env:{},next:async()=>new Response(template,{headers:{'Content-Type':'text/html'}})})).text();
 assert(off.includes('aria-labelledby="clips-title" hidden>'));
}finally{globalThis.fetch=realFetch;}
pass('the home page reveals the clip section only when Shorts are available');

if(process.env.CLIPS_LIVE){const live=await channelShorts(fetch);assert(live.length>0);console.log('LIVE',live.slice(0,4).map(v=>v.title));pass('the real Sinchon channel feed returns Shorts');}
console.log(JSON.stringify({passed:checks.length},null,1));
