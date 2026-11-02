/* Staff editor: shared server storage only; no localStorage or fake publication. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const views=['connection','auth','password-view','workspace','editor-view'];
const state={user:null,setup:false,post:null,revision:0,dirty:false,changes:0,loading:false,saving:null,autoTimer:null,autoStopped:false,page:1,hasMore:false};
let editor;
function notice(message='',error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function show(id){views.forEach(v=>$(v).hidden=v!==id);}
async function api(path,options={}) {
 const settings={credentials:'same-origin',...options,headers:{...options.headers}};
 if(options.body!==undefined&&!(options.body instanceof Blob)){settings.headers['Content-Type']='application/json';settings.body=JSON.stringify(options.body);}
 const response=await fetch('/api/cms/'+path,settings);let data;
 try{data=await response.json();}catch{throw new Error('서버 응답을 읽을 수 없습니다. 인터넷 연결과 저장소 설정을 확인해 주세요.');}
 if(!response.ok){const e=new Error(data.error||'요청을 처리하지 못했습니다.');e.status=response.status;throw e;}return data;
}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function bind(id,fn){$(id).addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>notice(e.message,true)));}
function signedIn(user){state.user=user;$('account-name').textContent=user.name+' · '+(user.role==='admin'?'관리자':'직원');$('account-nav').hidden=false;$('users-tab').hidden=user.role!=='admin';$('list-title').textContent=user.role==='admin'?'전체 직원의 글':'내가 작성한 글';}
async function boot(){
 try{const status=await api('status');
  if(!status.storageConfigured||(!status.initialized&&!status.setupKeyConfigured)){
   show('connection');$('account-nav').hidden=true;$('connection-state').textContent='DB 연결: '+(status.storageConfigured?'연결됨':'필요')+' / 초기 설정키: '+(status.setupKeyConfigured?'연결됨':'필요');notice('아직 공동 저장 기능이 활성화되지 않았습니다. 연결 완료 후 사용할 수 있습니다.');return;
  }
  state.setup=!status.initialized;
  if(state.setup){authView();notice('첫 관리자 계정을 만들면 직원 계정을 추가할 수 있습니다.');return;}
  try{const data=await api('me');signedIn(data.user);notice();if(data.user.mustChange)show('password-view');else await loadList();}
  catch(e){if(e.status===401){authView();notice();}else throw e;}
 }catch(e){notice(e.message,true);}
}
function authView(){show('auth');$('account-nav').hidden=true;$('first-admin').hidden=!state.setup;$('setup-token').required=state.setup;$('setup-name').required=state.setup;$('auth-kicker').textContent=state.setup?'첫 관리자 만들기':'직원 로그인';$('auth-title').textContent=state.setup?'첫 관리자 계정을 만들어 주세요.':'오늘의 이야기를 기록해 주세요.';$('auth-submit').textContent=state.setup?'관리자 만들고 시작하기':'로그인';$('auth-help').textContent=state.setup?'한 번만 설정합니다. 직원은 로그인한 뒤 ‘직원 계정’에서 추가합니다.':'계정이 없거나 비밀번호를 잊으셨다면 관리자에게 요청해 주세요.';}
$('auth-form').addEventListener('submit',async event=>{event.preventDefault();$('auth-submit').disabled=true;try{const data=await api(state.setup?'setup':'login',{method:'POST',body:{email:$('email').value,password:$('password').value,name:$('setup-name').value,setupToken:$('setup-token').value}});$('password').value='';$('setup-token').value='';$('replacement-key').value='';$('replacement-key-area').hidden=true;state.setup=false;signedIn(data.user);notice();if(data.user.mustChange)show('password-view');else await loadList();}catch(e){notice(e.message,true);}finally{$('auth-submit').disabled=false;}});
bind('generate-key',()=>{$('generated-key').value=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');$('generated-key').focus();$('generated-key').select();notice('설정키를 선택했습니다. Cloudflare의 암호화된 CMS_SETUP_TOKEN 값에 붙여넣어 주세요. 이 화면에는 따로 저장되지 않습니다.');});
bind('replace-setup-key',()=>{
 if(!state.setup)throw new Error('첫 관리자 등록 단계에서만 사용할 수 있습니다.');
 if($('setup-token').value&&!confirm('새 키를 만들면 입력한 키가 바뀝니다. Cloudflare의 Secret 값도 교체해야 합니다. 계속할까요?'))return;
 const key=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
 $('replacement-key').value=key;$('setup-token').value=key;$('replacement-key-area').hidden=false;
 notice('새 키를 만들었습니다. Cloudflare의 CMS_SETUP_TOKEN 값을 교체하고 재배포한 뒤 등록하세요. 이 탭은 닫거나 새로고침하지 마세요.');
});
bind('copy-setup-key',async()=>{
 const field=$('replacement-key');if(!field.value)throw new Error('새 설정키를 먼저 만들어 주세요.');
 try{await navigator.clipboard.writeText(field.value);notice('새 키를 복사했습니다. Cloudflare의 CMS_SETUP_TOKEN Secret 값에 붙여넣어 주세요.');}
 catch{field.focus();field.select();notice('새 키를 선택했습니다. Ctrl+C 또는 기기의 복사 기능을 사용해 주세요.');}
});
bind('save-setup-key',()=>{
 const key=$('replacement-key').value;if(!key)throw new Error('새 설정키를 먼저 만들어 주세요.');
 const url=URL.createObjectURL(new Blob([key],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='신촌점_초기설정키.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 notice('키 보관 파일을 내려받았습니다. Cloudflare 값 교체와 재배포를 완료한 뒤 이 화면에서 등록하세요.');
});
bind('recheck',boot);
bind('logout',async()=>{if(state.dirty)await save(true);await api('logout',{method:'POST',body:{}});state.post=null;state.user=null;state.dirty=false;clearTimeout(state.autoTimer);authView();notice('로그아웃했습니다.');});
bind('password-button',async()=>{if(state.dirty)await save(true);show('password-view');notice();});
bind('password-cancel',async()=>{if(state.user.mustChange)throw new Error('임시 비밀번호를 먼저 변경해 주세요.');await loadList();});
$('password-form').addEventListener('submit',async event=>{event.preventDefault();try{if($('new-password').value!==$('new-password-again').value)throw new Error('새 비밀번호가 서로 다릅니다.');await api('password',{method:'POST',body:{currentPassword:$('old-password').value,password:$('new-password').value}});$('password-form').reset();state.user.mustChange=false;notice('비밀번호를 변경했습니다.');await loadList();}catch(e){notice(e.message,true);}});
function statusText(post){if(post.published_revision){if(post.published_revision===post.revision)return '공개 중';return post.status==='review'?'공개 중 · 수정 검토 요청':'공개 중 · 수정 초안';}return {draft:'초안',review:'검토 요청',published:'공개 승인됨'}[post.status]||'초안';}
async function loadList(){
 clearTimeout(state.autoTimer);show('workspace');$('posts-view').hidden=false;$('users-view').hidden=true;$('posts-tab').setAttribute('aria-pressed','true');$('users-tab').setAttribute('aria-pressed','false');
 const query=new URLSearchParams({page:state.page,q:$('search').value,status:$('status-filter').value});const data=await api('posts?'+query);state.hasMore=data.hasMore;
 const root=$('post-list');root.replaceChildren();
 for(const post of data.posts){const row=node('article',undefined,'post-row');const text=node('div');const title=node('button',post.title||'제목 없는 글','row-title');title.type='button';title.addEventListener('click',()=>openPost(post.id).catch(e=>notice(e.message,true)));text.append(title,node('p',post.category+' · '+post.owner_name+' · '+new Date(post.updated_at).toLocaleString('ko-KR')));row.append(text,node('span',statusText(post),'badge'));root.append(row);}
 if(!data.posts.length)root.append(node('p','아직 작성한 글이 없습니다. ‘새 글 쓰기’로 시작해 주세요.','empty'));
 $('page-label').textContent=state.page+'쪽';$('prev-page').disabled=state.page<=1;$('next-page').disabled=!state.hasMore;
}
$('search-form').addEventListener('submit',event=>{event.preventDefault();state.page=1;loadList().catch(e=>notice(e.message,true));});
bind('prev-page',async()=>{state.page=Math.max(1,state.page-1);await loadList();});
bind('next-page',async()=>{if(state.hasMore)state.page++;await loadList();});
bind('posts-tab',loadList);bind('users-tab',loadUsers);
bind('new-post',async()=>{if(state.dirty)await save(true);$('new-post').disabled=true;try{const data=await api('posts',{method:'POST',body:{}});await openPost(data.id);}finally{$('new-post').disabled=false;}});
function ensureEditor(){
 if(editor)return;
 editor=new Quill('#rich-editor',{theme:'snow',placeholder:'학생이 궁금해한 질문과 안내할 내용을 적어 주세요. 사진도 넣을 수 있습니다.',formats:['header','bold','italic','underline','list','blockquote','link','image'],modules:{toolbar:{container:'#toolbar',handlers:{link(){const range=this.quill.getSelection();if(!range||!range.length){notice('링크를 넣을 글자를 먼저 선택해 주세요.',true);return;}const value=prompt('연결할 http 또는 https 주소를 입력해 주세요.');if(value===null)return;try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw new Error();this.quill.format('link',u.href);}catch{notice('올바른 웹 주소를 입력해 주세요.',true);}}}}}});
 editor.clipboard.addMatcher('IMG',()=>new (Quill.import('delta'))());
 editor.on('text-change',(_d,_old,source)=>{if(source==='user')changed();});
 $('rich-editor').addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();event.stopImmediatePropagation();uploadImages(event.dataTransfer.files).catch(e=>notice(e.message,true));}},true);
 $('rich-editor').addEventListener('paste',event=>{const files=[...(event.clipboardData?.files||[])];if(files.length){event.preventDefault();event.stopImmediatePropagation();uploadImages(files).catch(e=>notice(e.message,true));}},true);
}
function fillSnapshot(snapshot){state.loading=true;ensureEditor();$('title').value=snapshot.title||'';$('category').value=snapshot.category;$('summary').value=snapshot.summary||'';$('sources').value=snapshot.sources||'';$('verified-at').value=snapshot.verifiedAt||'';$('post-author').textContent=snapshot.authorName;editor.setContents(snapshot.delta,'silent');state.loading=false;}
async function openPost(id){
 if(state.dirty)await save(true);const data=await api('posts/'+id);state.post=data.post;state.revision=data.post.revision;state.dirty=false;state.changes=0;state.autoStopped=false;fillSnapshot(data.snapshot);$('version-list').replaceChildren();show('editor-view');updateState();notice();$('title').focus();
}
function updateState(){if(!state.post)return;$('editor-state').textContent=statusText({...state.post,revision:state.revision});$('save-state').textContent=state.dirty?'저장할 변경 사항이 있습니다.':'저장 완료 · 버전 '+state.revision;$('publish').hidden=state.user.role!=='admin';$('unpublish').hidden=state.user.role!=='admin'||!state.post.published_revision;$('public-link').hidden=!state.post.published_revision;$('public-link').href='/blog/'+state.post.slug+'/';$('publication-note').textContent=state.post.published_revision?'현재 공개본은 별도로 유지됩니다. 관리자 승인 전에는 수정 내용이 공개되지 않습니다.':'초안은 로그인한 작성자와 관리자만 볼 수 있습니다.';}
function changed(){if(state.loading||!state.post)return;state.dirty=true;state.changes++;updateState();clearTimeout(state.autoTimer);if(!state.autoStopped)state.autoTimer=setTimeout(()=>save(false).catch(e=>notice(e.message,true)),1800);}
['title','category','summary','sources','verified-at'].forEach(id=>$(id).addEventListener('input',changed));
function currentSnapshot(){return {title:$('title').value,category:$('category').value,summary:$('summary').value,sources:$('sources').value,verifiedAt:$('verified-at').value,delta:editor.getContents(),revision:state.revision};}
async function save(flush=false){
 clearTimeout(state.autoTimer);
 if(state.saving){await state.saving;if(flush&&state.dirty)return save(true);return;}
 if(!state.post||!state.dirty)return;
 const change=state.changes,postId=state.post.id;const body=currentSnapshot();$('save-state').textContent='공동 DB에 저장 중…';
 state.saving=(async()=>{try{const data=await api('posts/'+postId,{method:'PUT',body});state.revision=data.revision;state.post.revision=data.revision;state.post.status='draft';state.dirty=state.changes!==change;state.autoStopped=false;updateState();}catch(e){state.autoStopped=true;$('save-state').textContent='저장 실패 · 현재 원고를 파일로 보관할 수 있습니다.';throw e;}})();
 try{await state.saving;}finally{state.saving=null;}
 if(flush&&state.dirty)return save(true);
 if(state.dirty&&!state.autoStopped)state.autoTimer=setTimeout(()=>save(false).catch(e=>notice(e.message,true)),1800);
}
bind('save',async()=>{state.autoStopped=false;await save(true);notice('공동 DB에 저장했습니다.');});
bind('back-list',async()=>{await save(true);await loadList();notice();});
bind('preview',async()=>{const popup=window.open('about:blank','_blank');if(!popup)throw new Error('미리보기를 위해 팝업을 허용해 주세요.');try{await save(true);popup.location.href='/api/cms/posts/'+state.post.id+'/preview';}catch(e){popup.close();throw e;}});
async function action(kind){await save(true);if(kind==='publish'&&!confirm('저장된 이 버전을 공개하시겠습니까? 누구나 읽을 수 있습니다.'))return;if(kind==='unpublish'&&!confirm('현재 공개본을 내릴까요? 원고와 수정 이력은 보관됩니다.'))return;const data=await api('posts/'+state.post.id+'/'+kind,{method:'POST',body:{revision:state.revision}});await openPost(state.post.id);notice(kind==='publish'?'공개했습니다. ‘현재 공개본 보기’에서 확인해 주세요.':kind==='review'?'관리자에게 검토를 요청했습니다. 별도 메일·메신저 알림은 발송하지 않습니다.':'공개를 내렸습니다. 원고와 이력은 유지됩니다.');return data;}
bind('review',()=>action('review'));bind('publish',()=>action('publish'));bind('unpublish',()=>action('unpublish'));
async function uploadImages(files){if(!state.post)return;for(const file of [...files].slice(0,12)){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG·PNG·WebP 사진을 선택해 주세요.');if(file.size>20*1024*1024)throw new Error('사진 한 장은 20MB 이하로 선택해 주세요.');
 notice('사진 크기를 줄여 공동 DB에 등록하고 있습니다.');const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>60000000){bitmap.close();throw new Error('사진 크기가 너무 큽니다. 해상도를 줄여 주세요.');}const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(blob&&blob.size>900000)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.55));if(!blob||blob.type!=='image/webp'||blob.size>900000)throw new Error('사진을 충분히 줄이지 못했습니다. 작은 사진으로 다시 시도해 주세요.');
 const data=await api('posts/'+state.post.id+'/images',{method:'POST',headers:{'Content-Type':'image/webp'},body:blob});const range=editor.getSelection(true);const index=range?range.index:editor.getLength()-1;editor.insertEmbed(index,'image',data.url,'user');editor.insertText(index+1,'\n','user');editor.setSelection(index+2,0,'silent');
 }await save(true);notice('사진과 글을 공동 DB에 저장했습니다.');}
bind('add-image',()=>{$('image-file').click();});$('image-file').addEventListener('change',async()=>{try{await uploadImages($('image-file').files);}catch(e){notice(e.message,true);}finally{$('image-file').value='';}});
bind('versions',async()=>{await save(true);const data=await api('posts/'+state.post.id+'/versions');const root=$('version-list');root.replaceChildren();for(const v of data.versions){const row=node('div',undefined,'version-row');row.append(node('p','버전 '+v.revision+' · '+v.editor+' · '+new Date(v.created_at).toLocaleString('ko-KR')));const button=node('button','이 내용을 편집기에 불러오기');button.type='button';button.addEventListener('click',async()=>{try{if(!confirm('선택한 이전 내용을 편집기로 불러올까요? 공개본은 바뀌지 않습니다.'))return;const data=await api('posts/'+state.post.id+'/versions/'+v.revision);fillSnapshot(data.snapshot);changed();await save(true);notice('이전 내용을 새 버전으로 저장했습니다.');}catch(e){notice(e.message,true);}});row.append(button);root.append(row);}});
bind('download-draft',()=>{const file=new Blob([JSON.stringify({...currentSnapshot(),postId:state.post.id,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='신촌점_원고_'+state.post.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);notice('현재 원고 보관 파일을 내려받았습니다. 사진 원본·DB 전체 백업은 포함하지 않습니다.');});
bind('import-draft',()=>{$('draft-file').click();});
$('draft-file').addEventListener('change',async()=>{try{
 const file=$('draft-file').files[0];if(!file)return;if(file.size>1000000)throw new Error('원고 파일은 1MB 이내로 선택해 주세요.');
 const data=JSON.parse(await file.text());if(data.postId!==state.post.id)throw new Error('이 파일을 보관했던 원래 글을 열고 다시 불러와 주세요.');
 if(!confirm('보관한 내용을 이 글의 새 버전으로 저장할까요? 공개본은 바뀌지 않습니다.'))return;
 await save(true);await api('posts/'+state.post.id,{method:'PUT',body:{...data,revision:state.revision}});state.dirty=false;await openPost(state.post.id);notice('보관한 원고를 새 버전으로 저장했습니다.');
 }catch(e){notice(e.message,true);}finally{$('draft-file').value='';}});
async function loadUsers(){if(state.dirty)await save(true);const data=await api('users');show('workspace');$('posts-view').hidden=true;$('users-view').hidden=false;$('posts-tab').setAttribute('aria-pressed','false');$('users-tab').setAttribute('aria-pressed','true');const root=$('user-list');root.replaceChildren();for(const user of data.users){const row=node('article',undefined,'user-row');row.append(node('strong',user.name+' · '+(user.role==='admin'?'관리자':'직원')),node('p',user.email+' · '+(user.active?'사용 중':'사용 중지')));if(user.role==='author'){const reset=node('button','임시 비밀번호 재설정');reset.type='button';reset.addEventListener('click',async()=>{const pass=prompt(user.name+' 직원의 새 임시 비밀번호를 입력해 주세요. (12자 이상)');if(pass===null)return;try{await api('users/'+user.id+'/reset',{method:'POST',body:{password:pass}});notice('임시 비밀번호를 재설정했습니다. 직원에게 별도로 전달해 주세요.');await loadUsers();}catch(e){notice(e.message,true);}});const active=node('button',user.active?'계정 사용 중지':'계정 다시 사용');active.type='button';active.addEventListener('click',async()=>{if(!confirm(user.name+' 계정의 사용 상태를 변경할까요? 기존 로그인도 해제됩니다.'))return;try{await api('users/'+user.id+'/active',{method:'POST',body:{active:!user.active}});await loadUsers();notice('계정 상태를 변경했습니다.');}catch(e){notice(e.message,true);}});row.append(reset,active);}root.append(row);}}
$('user-form').addEventListener('submit',async event=>{event.preventDefault();try{await api('users',{method:'POST',body:{name:$('user-name').value,email:$('user-email').value,password:$('user-password').value}});$('user-form').reset();await loadUsers();notice('직원 계정을 만들었습니다. 로그인 주소와 임시 비밀번호를 별도로 전달해 주세요.');}catch(e){notice(e.message,true);}});
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
boot();
})();
