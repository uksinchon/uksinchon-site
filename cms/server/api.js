import {SCHEMA} from './schema.js';
import {cleanSnapshot,imageIds,textOf,safeLink,webpDimensions,factReadiness,semanticContent} from './content.js';
import {publicationProblem,sealPublication} from './publication.js';
import {articlePage} from './pages.js';
import {syncNaver,importedItem,guardNaverPublish} from './naver.js';
import {naverAdmin} from './naver-api.js';
const encoder=new TextEncoder();
const now=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
class Failure extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(s,m)=>{throw new Failure(s,m);};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',...headers}});
const local=(r,e)=>e.CMS_LOCAL_DEV==='true'&&['localhost','127.0.0.1'].includes(new URL(r.url).hostname);
const cookieName=(r,e)=>local(r,e)?'cms_session':'__Host-cms_session';
const cookie=(r,e,token,clear=false)=>`${cookieName(r,e)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:28800}${local(r,e)?'':'; Secure'}`;
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0;}
async function hash(text){return b64(await crypto.subtle.digest('SHA-256',encoder.encode(text)));}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
function password(value){if(typeof value!=='string'||value.length<12||value.length>128)fail(400,'비밀번호는 12~128자로 입력해 주세요.');return value;}
function identity(body){const email=String(body.email||'').trim().toLowerCase();const name=String(body.name||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail(400,'이메일 주소를 확인해 주세요.');if(!name||name.length>50)fail(400,'표시할 이름은 1~50자로 입력해 주세요.');return {email,name};}
async function bodyOf(request){const text=await request.text();if(text.length>220000)fail(413,'본문이 너무 큽니다. 내용을 나누어 주세요.');try{return JSON.parse(text);}catch{fail(400,'요청 내용을 읽을 수 없습니다. 다시 시도해 주세요.');}}
async function ready(db){try{return !!await db.prepare('SELECT id FROM cms_bootstrap WHERE id=1').first();}catch(e){if(String(e).includes('no such table'))return false;throw e;}}
async function session(request,env){const token=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(request,env)+'='))?.split('=')[1];if(!token||token.length>128)fail(401,'로그인해 주세요.');const tokenHash=await hash(token);const user=await env.CMS_DB.prepare('SELECT u.* FROM cms_sessions s JOIN cms_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(tokenHash,now()).first();if(!user)fail(401,'로그인이 만료되었습니다. 다시 로그인해 주세요.');return {user,tokenHash};}
const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role,mustChange:!!u.must_change});
const admin=u=>{if(u.role!=='admin')fail(403,'관리자만 사용할 수 있습니다.');};
async function ownPost(db,id,user){const p=await db.prepare('SELECT * FROM cms_posts WHERE id=?').bind(id).first();if(!p)fail(404,'글을 찾을 수 없습니다.');if(p.owner_id!==user.id&&user.role!=='admin')fail(403,'작성한 글만 수정할 수 있습니다.');return p;}
async function snapshot(db,id,revision){const row=await db.prepare('SELECT snapshot FROM cms_versions WHERE post_id=? AND revision=?').bind(id,revision).first();return row?JSON.parse(row.snapshot):null;}
async function validImages(db,post,s,previous=null){
 for(const id of imageIds(s)){
  const dimensions=s.schemaVersion===2?previous?.imageMeta?.[id]:null;
  const needBytes=s.schemaVersion===2&&!(dimensions?.width&&dimensions?.height);
  const image=await db.prepare('SELECT id'+(needBytes?',data':'')+' FROM cms_media WHERE id=? AND post_id=?').bind(id,post.id).first();
  if(!image)fail(400,'이 글에 등록되지 않은 사진이 포함되어 있습니다. 사진을 다시 추가해 주세요.');
  if(s.schemaVersion===2){
   const size=needBytes?webpDimensions(image.data):{width:dimensions.width,height:dimensions.height};
   delete s.imageMeta[id].width;delete s.imageMeta[id].height;
   if(size)Object.assign(s.imageMeta[id],size);
  }
 }
}
async function factReview(db,id,revision){return db.prepare("SELECT e.actor_id,e.created_at,e.revision,u.name FROM cms_events e JOIN cms_users u ON u.id=e.actor_id WHERE e.post_id=? AND e.revision=? AND e.action='factcheck' ORDER BY e.created_at DESC,e.id DESC LIMIT 1").bind(id,revision).first();}
async function rateLimit(request,db,prefix,limit=60,byIP=true){const key=await hash(prefix+':'+(byIP?(request.headers.get('CF-Connecting-IP')||'local'):'account'));const stamp=now();await db.prepare('INSERT INTO cms_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END').bind(key,new Date(Date.now()+900000).toISOString(),stamp,stamp).run();const row=await db.prepare('SELECT count FROM cms_attempts WHERE key=?').bind(key).first();if(row.count>limit)fail(429,'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');return key;}
async function loginResponse(request,env,user){const token=b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-zA-Z0-9]/g,'')+uuid();const tokenHash=await hash(token);await env.CMS_DB.batch([env.CMS_DB.prepare('DELETE FROM cms_sessions WHERE expires_at<?').bind(now()),env.CMS_DB.prepare('INSERT INTO cms_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash,user.id,new Date(Date.now()+28800000).toISOString())]);return json({user:publicUser(user)},200,{'Set-Cookie':cookie(request,env,token)});}
export async function handleCMS(context){
 const {request,env}=context;const db=env.CMS_DB;const url=new URL(request.url);const path=url.pathname.replace(/^\/api\/cms\/?/,'').replace(/\/$/,'');const parts=path.split('/');
 try {
  if(path==='naver/cron'){
   if(request.method!=='POST')fail(405,'예약 실행은 POST만 받습니다.');
   if(!local(request,env)&&url.protocol!=='https:')fail(403,'HTTPS가 필요합니다.');
   const expected=env.CMS_NAVER_CRON_TOKEN;
   if(typeof expected!=='string'||expected.length<32)fail(503,'예약 감지 키가 설정되지 않았습니다.');
   if(!equal(request.headers.get('Authorization')||'','Bearer '+expected))fail(401,'예약 실행 인증이 필요합니다.');
   if(!db||!await ready(db))fail(503,'관리자 설정과 DB 연결이 필요합니다.');
   return json(await syncNaver(env,{cron:true}));
  }
  if(!['GET','POST','PUT'].includes(request.method))fail(405,'지원하지 않는 요청입니다.');
  if(request.method!=='GET'){
   if(request.headers.get('Origin')!==url.origin)fail(403,'다른 사이트에서 보낸 요청은 처리하지 않습니다. 새로고침해 주세요.');
   if(!local(request,env)&&url.protocol!=='https:')fail(403,'HTTPS 주소에서 접속해 주세요.');
   if(!path.endsWith('/images')&&!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'요청 형식을 확인해 주세요.');
  }
  if(path==='status'&&request.method==='GET')return json({storageConfigured:!!db,setupKeyConfigured:typeof env.CMS_SETUP_TOKEN==='string'&&env.CMS_SETUP_TOKEN.length>=32,initialized:db?await ready(db):false});
  if(!db)fail(503,'공동 저장 DB가 아직 연결되지 않았습니다. 관리자에게 연결을 요청해 주세요.');
  if(path==='setup'&&request.method==='POST'){
   const body=await bodyOf(request);
   if(typeof env.CMS_SETUP_TOKEN!=='string'||env.CMS_SETUP_TOKEN.length<32)fail(503,'관리자 초기 설정키가 연결되지 않았습니다.');
   if(!equal(String(body.setupToken||''),env.CMS_SETUP_TOKEN))fail(403,'초기 설정키가 일치하지 않습니다.');
   if(await ready(db))fail(409,'초기 설정이 완료되었습니다. 로그인해 주세요.');
   const {email,name}=identity(body);const pass=password(body.password);const salt=uuid();const id=uuid();const hashed=await passwordHash(pass,salt);const stamp=now();
   await db.batch(SCHEMA.map(sql=>db.prepare(sql)));
   try{await db.batch([db.prepare('INSERT INTO cms_bootstrap(id,created_at) VALUES(1,?)').bind(stamp),db.prepare("INSERT INTO cms_users(id,email,name,role,password_salt,password_hash,created_at) VALUES(?,?,?,'admin',?,?,?)").bind(id,email,name,salt,hashed,stamp)]);}catch{fail(409,'초기 설정이 이미 완료되었거나 충돌했습니다. 로그인 상태를 확인해 주세요.');}
   return loginResponse(request,env,{id,email,name,role:'admin',must_change:0});
  }
  if(!await ready(db))fail(503,'첫 관리자 설정을 완료해 주세요.');
  if(path==='login'&&request.method==='POST'){
   await db.prepare('DELETE FROM cms_attempts WHERE expires_at<?').bind(now()).run();await rateLimit(request,db,'login');const b=await bodyOf(request);const email=String(b.email||'').trim().toLowerCase();const accountKey=await rateLimit(request,db,'account:'+email,8,false);const u=await db.prepare('SELECT * FROM cms_users WHERE email=? AND active=1').bind(email).first();
   const given=typeof b.password==='string'&&b.password.length<=128?b.password:'';
   const hashed=await passwordHash(given,u?.password_salt||'no-user-salt');
   if(!u||!equal(hashed,u.password_hash))fail(401,'이메일 또는 비밀번호가 일치하지 않습니다.');
   await db.prepare('DELETE FROM cms_attempts WHERE key=?').bind(accountKey).run();return loginResponse(request,env,u);
  }
  const {user,tokenHash}=await session(request,env);
  if(path==='me'&&request.method==='GET')return json({user:publicUser(user)});
  if(path==='logout'&&request.method==='POST'){await db.prepare('DELETE FROM cms_sessions WHERE token_hash=?').bind(tokenHash).run();return json({ok:true},200,{'Set-Cookie':cookie(request,env,'',true)});}
  if(path==='password'&&request.method==='POST'){
   const b=await bodyOf(request);const pass=password(b.password);if(!equal(await passwordHash(String(b.currentPassword||''),user.password_salt),user.password_hash))fail(400,'현재 비밀번호가 일치하지 않습니다.');
   const salt=uuid();await db.batch([db.prepare('UPDATE cms_users SET password_salt=?,password_hash=?,must_change=0 WHERE id=?').bind(salt,await passwordHash(pass,salt),user.id),db.prepare('DELETE FROM cms_sessions WHERE user_id=? AND token_hash<>?').bind(user.id,tokenHash)]);return json({ok:true});
  }
  if(user.must_change)fail(403,'처음 받은 임시 비밀번호를 변경해 주세요.');
  if(parts[0]==='naver'){
   admin(user);try{return json(await naverAdmin(path,request.method,request.method==='GET'?{}:await bodyOf(request),env,user));}
   catch(e){fail(e.status||400,String(e.message).startsWith('D1_')?'네이버 연결 저장소를 처리하지 못했습니다.':e.message);}
  }
  if(path==='users'&&request.method==='GET'){admin(user);return json({users:(await db.prepare('SELECT id,email,name,role,active,must_change,created_at FROM cms_users ORDER BY created_at').all()).results});}
  if(path==='users'&&request.method==='POST'){
   admin(user);const b=await bodyOf(request);const {email,name}=identity(b);const salt=uuid();const pass=password(b.password);
   if(await db.prepare('SELECT id FROM cms_users WHERE email=?').bind(email).first())fail(409,'이미 등록된 이메일입니다.');
   await db.prepare("INSERT INTO cms_users(id,email,name,role,password_salt,password_hash,must_change,created_at) VALUES(?,?,?,'author',?,?,1,?)").bind(uuid(),email,name,salt,await passwordHash(pass,salt),now()).run();return json({ok:true},201);
  }
  if(parts[0]==='users'&&parts.length===3&&request.method==='POST'){
   admin(user);const target=await db.prepare('SELECT * FROM cms_users WHERE id=?').bind(parts[1]).first();if(!target||target.role==='admin')fail(400,'직원 계정만 이 화면에서 관리할 수 있습니다.');const b=await bodyOf(request);
   if(parts[2]==='reset'){const salt=uuid();await db.batch([db.prepare('UPDATE cms_users SET password_salt=?,password_hash=?,must_change=1 WHERE id=?').bind(salt,await passwordHash(password(b.password),salt),target.id),db.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(target.id)]);return json({ok:true});}
   if(parts[2]==='active'){await db.batch([db.prepare('UPDATE cms_users SET active=? WHERE id=?').bind(b.active===true?1:0,target.id),db.prepare('DELETE FROM cms_sessions WHERE user_id=?').bind(target.id)]);return json({ok:true});}
  }
  if(path==='posts'&&request.method==='GET'){
   const term=String(url.searchParams.get('q')||'').slice(0,100);const page=Math.max(1,Number(url.searchParams.get('page'))||1);const offset=(page-1)*30;
   const condition=user.role==='admin'?'1=1':'p.owner_id=?';const args=user.role==='admin'?[]:[user.id];const status=url.searchParams.get('status');let extra='';
   if(['draft','review','published'].includes(status)){extra+=' AND p.status=?';args.push(status);}
   if(term){extra+=" AND json_extract(v.snapshot,'$.title') LIKE ? ESCAPE '\\'";args.push('%'+term.replace(/[\\%_]/g,'\\$&')+'%');}
   const rows=await db.prepare(`SELECT p.*,u.name AS owner_name,json_extract(v.snapshot,'$.title') AS title,json_extract(v.snapshot,'$.category') AS category FROM cms_posts p JOIN cms_users u ON u.id=p.owner_id JOIN cms_versions v ON v.post_id=p.id AND v.revision=p.revision WHERE ${condition}${extra} ORDER BY p.updated_at DESC LIMIT 31 OFFSET ?`).bind(...args,offset).all();return json({posts:rows.results.slice(0,30),hasMore:rows.results.length>30,page});
  }
  if(path==='posts'&&request.method==='POST'){
   const id=uuid(),stamp=now();const data=cleanSnapshot({schemaVersion:2,title:'',category:'어학연수',delta:{ops:[{insert:'\n'}]}},user.name);
   await db.batch([db.prepare("INSERT INTO cms_posts(id,slug,owner_id,revision,created_at,updated_at,save_token) VALUES(?,?,?,1,?,?,?)").bind(id,'story-'+id,user.id,stamp,stamp,uuid()),db.prepare('INSERT INTO cms_versions(post_id,revision,snapshot,actor_id,created_at) VALUES(?,1,?,?,?)').bind(id,JSON.stringify(data),user.id,stamp)]);return json({id},201);
  }
  if(parts[0]==='posts'&&parts[1]){
   const post=await ownPost(db,parts[1],user);
   if(parts.length===2&&request.method==='GET')return json({post,snapshot:await snapshot(db,post.id,post.revision),naver:await importedItem(db,post.id),factReview:await factReview(db,post.id,post.revision)});
   if(parts.length===2&&request.method==='PUT'){
    const b=await bodyOf(request);const previous=await snapshot(db,post.id,post.revision);
    if(previous.schemaVersion===2&&Number(b.schemaVersion)!==2)fail(409,'편집기가 업데이트되었습니다. 현재 원고를 보관하고 화면을 새로고침해 주세요.');
    const owner=await db.prepare('SELECT name FROM cms_users WHERE id=?').bind(post.owner_id).first();let data;try{data=cleanSnapshot(b,owner.name);}catch(e){fail(400,e.message);}await validImages(db,post,data,previous);
    const revision=Number(b.revision);if(!Number.isInteger(revision))fail(400,'저장 버전을 확인해 주세요.');const stamp=now(),saveToken=uuid();
    const result=await db.batch([db.prepare("UPDATE cms_posts SET revision=revision+1,status='draft',updated_at=?,save_token=? WHERE id=? AND revision=?").bind(stamp,saveToken,post.id,revision),db.prepare('INSERT INTO cms_versions(post_id,revision,snapshot,actor_id,created_at) SELECT id,revision,?,?,? FROM cms_posts WHERE id=? AND save_token=?').bind(JSON.stringify(data),user.id,stamp,post.id,saveToken)]);
    if(result[0].meta.changes!==1)fail(409,'다른 창에서 이 글을 수정했습니다. 현재 내용을 내려받은 뒤 새로고침해 주세요.');return json({revision:revision+1,updatedAt:stamp});
   }
   if(parts[2]==='versions'&&parts.length===3&&request.method==='GET'){
    const rows=await db.prepare('SELECT v.revision,v.created_at,u.name AS editor FROM cms_versions v JOIN cms_users u ON u.id=v.actor_id WHERE v.post_id=? ORDER BY v.revision DESC LIMIT 100').bind(post.id).all();return json({versions:rows.results});
   }
   if(parts[2]==='versions'&&parts[3]&&request.method==='GET'){const s=await snapshot(db,post.id,Number(parts[3]));if(!s)fail(404,'버전을 찾을 수 없습니다.');return json({snapshot:s});}
   if(parts[2]==='preview'&&request.method==='GET')return articlePage(await snapshot(db,post.id,post.revision),post,true);
   if(parts[2]==='images'&&request.method==='POST'){
    if(!request.headers.get('Content-Type')?.startsWith('image/webp'))fail(415,'편집 화면에서 변환한 사진만 등록할 수 있습니다.');
    if(Number(request.headers.get('Content-Length'))>900000)fail(413,'사진을 줄여 다시 등록해 주세요.');const bytes=await request.arrayBuffer();const a=new Uint8Array(bytes);
    if(bytes.byteLength<16||bytes.byteLength>900000||String.fromCharCode(...a.slice(0,4))!=='RIFF'||String.fromCharCode(...a.slice(8,12))!=='WEBP')fail(400,'올바른 WebP 사진이 아닙니다.');
    const size=webpDimensions(bytes);if(!size||size.width>1600||size.height>1600)fail(400,'긴 쪽 1600px 이하의 WebP 사진을 등록해 주세요.');
    const id=uuid();await db.prepare('INSERT INTO cms_media(id,post_id,owner_id,mime,data,bytes,created_at) VALUES(?,?,?,\'image/webp\',?,?,?)').bind(id,post.id,user.id,bytes,bytes.byteLength,now()).run();return json({url:'/media/'+id,id,...size,bytes:bytes.byteLength},201);
   }
   if(parts[2]==='factcheck'&&parts.length===3&&request.method==='POST'){
    admin(user);const b=await bodyOf(request);if(Number(b.revision)!==post.revision)fail(409,'새 버전이 있습니다. 현재 원고를 다시 확인해 주세요.');
    const s=await snapshot(db,post.id,post.revision);const problem=factReadiness(s);if(problem)fail(400,problem);
    if(!b.checks||!['facts','conditions','rights'].every(key=>b.checks[key]===true))fail(400,'출처·적용 조건·개인정보와 사진 권리를 모두 대조해 주세요.');
    const stamp=now();const result=await db.prepare("INSERT INTO cms_events(id,post_id,actor_id,action,revision,created_at) SELECT ?,id,?,'factcheck',revision,? FROM cms_posts WHERE id=? AND revision=?").bind(uuid(),user.id,stamp,post.id,post.revision).run();
    if(result.meta.changes!==1)fail(409,'초안이 바뀌었습니다. 현재 버전을 다시 확인해 주세요.');
    return json({ok:true,revision:post.revision});
   }
   if(['review','publish','unpublish'].includes(parts[2])&&request.method==='POST'){
    const b=await bodyOf(request);if(Number(b.revision)!==post.revision)fail(409,'새 버전이 있습니다. 글을 다시 열어 주세요.');const s=await snapshot(db,post.id,post.revision);if(parts[2]!=='unpublish'&&(!s.title||!textOf(s)))fail(400,'제목과 본문을 입력한 뒤 요청해 주세요.');if(parts[2]!=='unpublish'&&s.sources.split('\n').filter(Boolean).some(url=>!safeLink(url)))fail(400,'참고 자료 주소를 완성하거나 지운 뒤 검토를 요청해 주세요.');const stamp=now(),saveToken=uuid();const statements=[];
    let resultingRevision=post.revision;
    if(parts[2]==='review')statements.push(db.prepare("UPDATE cms_posts SET status='review',updated_at=?,save_token=? WHERE id=? AND revision=?").bind(stamp,saveToken,post.id,post.revision));
    else {
     admin(user);
     if(parts[2]==='publish'){
      if(post.published_revision===post.revision)return json({ok:true,url:'/blog/'+post.slug+'/',revision:post.revision,unchanged:true});
      await validImages(db,post,s,s);
      let source;try{source=await guardNaverPublish(db,post,s);}catch(e){fail(400,e.message);}
      let reviewed=await factReview(db,post.id,post.revision);
      if(!reviewed&&s.publication?.factCheck)reviewed=await factReview(db,post.id,s.publication.factCheck.sourceRevision);
      const problem=publicationProblem(s,reviewed);if(problem)fail(400,problem);
      const last=post.published_revision?{revision:post.published_revision}:await db.prepare("SELECT revision FROM cms_events WHERE post_id=? AND action='publish' ORDER BY created_at DESC,id DESC LIMIT 1").bind(post.id).first();
      const previous=last?await snapshot(db,post.id,last.revision):null;
      if(s.schemaVersion===2&&previous&&semanticContent(previous)!==semanticContent(s)&&!s.changeNote)fail(400,'이번 수정의 이유와 범위를 입력해 주세요.');
      const approved=sealPublication(s,post,previous,reviewed,user,stamp);resultingRevision=post.revision+1;
      const gate=source?" AND EXISTS(SELECT 1 FROM cms_naver_items n WHERE n.post_id=cms_posts.id AND n.source_complete=1 AND n.status<>'source_changed' AND n.approved_revision=cms_posts.revision AND n.approved_source_hash=n.source_hash AND n.source_hash=?) AND NOT EXISTS(SELECT 1 FROM cms_naver_source WHERE poll_until>?)":'';
      const params=[stamp,stamp,saveToken,post.id,post.revision,...(source?[source.source_hash,stamp]:[])];
      statements.push(db.prepare("UPDATE cms_posts SET revision=revision+1,published_revision=revision+1,published_at=COALESCE(published_at,?),status='published',updated_at=?,save_token=? WHERE id=? AND revision=?"+gate).bind(...params));
      statements.push(db.prepare('INSERT INTO cms_versions(post_id,revision,snapshot,actor_id,created_at) SELECT id,revision,?,?,? FROM cms_posts WHERE id=? AND save_token=?').bind(JSON.stringify(approved),user.id,stamp,post.id,saveToken));
      if(source)statements.push(db.prepare('UPDATE cms_naver_items SET approved_revision=? WHERE post_id=? AND approved_revision=? AND source_hash=? AND EXISTS(SELECT 1 FROM cms_posts WHERE id=? AND save_token=?)').bind(resultingRevision,post.id,post.revision,source.source_hash,post.id,saveToken));
     }else statements.push(db.prepare("UPDATE cms_posts SET published_revision=NULL,status='draft',updated_at=?,save_token=? WHERE id=? AND revision=?").bind(stamp,saveToken,post.id,post.revision));
     statements.push(db.prepare('DELETE FROM cms_public_media WHERE post_id=? AND EXISTS(SELECT 1 FROM cms_posts WHERE id=? AND save_token=?)').bind(post.id,post.id,saveToken));
     if(parts[2]==='publish')for(const media of imageIds(s))statements.push(db.prepare('INSERT INTO cms_public_media(post_id,media_id) SELECT id,? FROM cms_posts WHERE id=? AND save_token=?').bind(media,post.id,saveToken));
    }
    statements.push(db.prepare('INSERT INTO cms_events(id,post_id,actor_id,action,revision,created_at) SELECT ?,id,?,?,revision,? FROM cms_posts WHERE id=? AND save_token=?').bind(uuid(),user.id,parts[2],stamp,post.id,saveToken));
    const result=await db.batch(statements);if(result[0].meta.changes!==1)fail(409,'새 버전이 있습니다. 글을 다시 열어 주세요.');return json({ok:true,url:'/blog/'+post.slug+'/',revision:resultingRevision});
   }
  }
  fail(404,'요청한 기능을 찾을 수 없습니다.');
 }catch(e){if(e instanceof Failure)return json({error:e.message},e.status);console.error('CMS operation failed',e?.name);return json({error:'처리를 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'},500);}
}
export async function getSession(request,env){try{return (await session(request,env)).user;}catch{return null;}}
