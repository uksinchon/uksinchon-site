/** Isolated D1/Workers environment. No production bindings, AI calls or external writes. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(path.resolve(process.env.CMS_TOOLING_DIR||'/tmp/uksinchon-cms-tools','package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');
export const SETUP_KEY='fixture-seo-setup-key-not-for-production-2026';
export const PASSWORD='FictionalSeoPassword123!';
export async function fixture({port}={}) {
 const root=process.cwd(),out=path.join(root,'.wrangler/seo-test-worker.js');fs.mkdirSync(path.dirname(out),{recursive:true});
 const file=name=>JSON.stringify(path.join(root,name));
 const entry=`import {handleCMS} from ${file('cms/server/api.js')};import {publicBlog} from ${file('cms/server/pages.js')};import {onRequestGet as sitemap} from ${file('functions/sitemap.xml.js')};import {onRequestGet as feed} from ${file('functions/feed.xml.js')};import {onRequest as media} from ${file('functions/media/[id].js')};export default{fetch(request,env){const u=new URL(request.url);if(u.pathname.startsWith('/api/cms/'))return handleCMS({request,env});if(u.pathname==='/sitemap.xml')return sitemap({request,env});if(u.pathname==='/feed.xml')return feed({request,env});if(u.pathname.startsWith('/media/'))return media({request,env,params:{id:u.pathname.split('/')[2]}});if(u.pathname==='/blog'||(u.pathname.startsWith('/blog/')&&u.pathname!=='/blog/styles.css'))return publicBlog({request,env});return fetch('https://fixture-assets.local'+u.pathname);}}`;
 await build({stdin:{contents:entry,resolveDir:root},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:out});
 const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',...(port?{port}:{}),modules:true,script:fs.readFileSync(out,'utf8'),compatibilityDate:'2026-10-30',d1Databases:{CMS_DB:'seo-fictional-database'},bindings:{CMS_LOCAL_DEV:'true',CMS_SETUP_TOKEN:SETUP_KEY},outboundService:async request=>{
  const u=new URL(request.url);if(u.hostname!=='fixture-assets.local')throw new Error('Unexpected external request: '+u.hostname);
  const allowed=u.pathname==='/'||u.pathname==='/index.html'||u.pathname==='/logo.png'||u.pathname==='/favicon.ico'||u.pathname==='/robots.txt'||u.pathname==='/blog/styles.css'||u.pathname.startsWith('/admin/')||u.pathname.startsWith('/assets/');
  if(!allowed)return new Response('not found',{status:404});
  const target=path.resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));if(!target.startsWith(root+'/')||!fs.existsSync(target)||!fs.statSync(target).isFile())return new Response('not found',{status:404});
  const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain'}[path.extname(target)]||'application/octet-stream';
  const headers={'Content-Type':type};if(u.pathname.startsWith('/admin/'))Object.assign(headers,{'X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
  return new Response(fs.readFileSync(target),{headers});
 }}));
 const base=(await mf.ready).origin;
 function client(){let cookie='';return {async request(url,{method='GET',body,expected=200,headers={}}={}){
  const r=await fetch(base+url,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];const raw=await r.text();let data=raw;if(r.headers.get('Content-Type')?.includes('application/json'))data=JSON.parse(raw);
  if(r.status!==expected)throw new Error(JSON.stringify({url,method,status:r.status,expected,data}));return {data,response:r};
 },async api(route,options){return (await this.request('/api/cms/'+route,options)).data;}};}
 return {mf,base,client,db:await mf.getD1Database('CMS_DB')};
}
