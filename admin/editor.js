/* Staff editor: shared server storage only; no localStorage or fake publication. */
(async()=>{'use strict';
const {youtubeId,validYouTubeId}=await import('/assets/youtube.js');
const {registerImageSize,installImageResize}=await import('/admin/image-resize.js');
const $=id=>document.getElementById(id);
const views=['connection','auth','password-view','workspace','editor-view'];
const state={user:null,setup:false,post:null,snapshot:null,factReview:null,revision:0,dirty:false,changes:0,loading:false,saving:null,autoTimer:null,autoStopped:false,page:1,hasMore:false,naver:null,naverItem:null};
const extra=window.UK_EDITORIAL;
let naverTextDirty=false;
let editor,imagePosition=null;
function notice(message='',error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').setAttribute('role',error?'alert':'status');}
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
function signedIn(user){state.user=user;$('account-name').textContent=user.name+' · '+(user.role==='admin'?'관리자':'직원');$('account-nav').hidden=false;$('users-tab').hidden=user.role!=='admin';$('naver-tab').hidden=user.role!=='admin';$('counsel-tab').hidden=user.role!=='admin';$('trash-view').hidden=user.role!=='admin';$('trash-filter').hidden=user.role!=='admin';if(user.role!=='admin'&&$('status-filter').value==='trash')$('status-filter').value='';$('list-title').textContent=user.role==='admin'?'전체 직원의 글':'내가 작성한 글';}
async function enterWorkspace(){const id=new URLSearchParams(location.search).get('edit');if(id){await openPost(id);history.replaceState(null,'',location.pathname);}else await loadList();}
async function boot(){
 try{const status=await api('status');
  if(!status.storageConfigured||(!status.initialized&&!status.setupKeyConfigured)){
   show('connection');$('account-nav').hidden=true;$('connection-state').textContent='DB 연결: '+(status.storageConfigured?'연결됨':'필요')+' / 초기 설정키: '+(status.setupKeyConfigured?'연결됨':'필요');notice('아직 공동 저장 기능이 활성화되지 않았습니다. 연결 완료 후 사용할 수 있습니다.');return;
  }
  state.setup=!status.initialized;
  if(state.setup){authView();notice('첫 관리자 계정을 만들면 직원 계정을 추가할 수 있습니다.');return;}
  try{const data=await api('me');signedIn(data.user);notice();if(data.user.mustChange)show('password-view');else await enterWorkspace();}
  catch(e){if(e.status===401){authView();notice();}else throw e;}
 }catch(e){notice(e.message,true);}
}
function authView(){show('auth');$('account-nav').hidden=true;$('first-admin').hidden=!state.setup;$('setup-token').required=state.setup;$('setup-name').required=state.setup;$('auth-kicker').textContent=state.setup?'첫 관리자 만들기':'직원 로그인';$('auth-title').textContent=state.setup?'첫 관리자 계정을 만들어 주세요.':'오늘의 이야기를 기록해 주세요.';$('auth-submit').textContent=state.setup?'관리자 만들고 시작하기':'로그인';$('auth-help').textContent=state.setup?'한 번만 설정합니다. 직원은 로그인한 뒤 ‘직원 계정’에서 추가합니다.':'계정이 없거나 비밀번호를 잊으셨다면 관리자에게 요청해 주세요.';}
$('auth-form').addEventListener('submit',async event=>{event.preventDefault();$('auth-submit').disabled=true;try{const data=await api(state.setup?'setup':'login',{method:'POST',body:{email:$('email').value,password:$('password').value,name:$('setup-name').value,setupToken:$('setup-token').value}});$('password').value='';$('setup-token').value='';$('replacement-key').value='';$('replacement-key-area').hidden=true;state.setup=false;signedIn(data.user);notice();if(data.user.mustChange)show('password-view');else await enterWorkspace();}catch(e){notice(e.message,true);}finally{$('auth-submit').disabled=false;}});
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
bind('logout',async()=>{if(!discardNaverText())return;if(state.dirty)await save(true);await api('logout',{method:'POST',body:{}});state.post=null;state.user=null;state.dirty=false;state.naver=null;state.naverItem=null;$('naver-cron-key').value='';clearTimeout(state.autoTimer);authView();notice('로그아웃했습니다.');});
bind('password-button',async()=>{if(state.dirty)await save(true);show('password-view');notice();});
bind('password-cancel',async()=>{if(state.user.mustChange)throw new Error('임시 비밀번호를 먼저 변경해 주세요.');await loadList();});
$('password-form').addEventListener('submit',async event=>{event.preventDefault();try{if($('new-password').value!==$('new-password-again').value)throw new Error('새 비밀번호가 서로 다릅니다.');await api('password',{method:'POST',body:{currentPassword:$('old-password').value,password:$('new-password').value}});$('password-form').reset();state.user.mustChange=false;notice('비밀번호를 변경했습니다.');await enterWorkspace();}catch(e){notice(e.message,true);}});
function statusText(post){if(post.is_trashed)return '휴지통';if(post.published_revision){if(post.published_revision===post.revision)return '공개 중';return post.status==='review'?'공개 중 · 수정 검토 요청':'공개 중 · 수정 초안';}return {draft:'초안',review:'검토 요청',published:'공개 승인됨'}[post.status]||'초안';}
async function moveListPost(post,restore,button){
 const title=post.title||'제목 없는 글';
 const message=restore?'‘'+title+'’ 글을 비공개 초안으로 복구할까요? 공개하려면 다시 승인해야 합니다.':'‘'+title+'’ 글을 삭제할까요?'+(post.published_revision?' 공개 글과 사진도 사이트에서 내려갑니다.':'')+' 휴지통에서 복구할 수 있습니다.';
 if(!confirm(message))return;button.disabled=true;
 try{await api('posts/'+post.id+'/'+(restore?'restore':'trash'),{method:'POST',body:{revision:post.revision}});await loadList();notice(restore?'비공개 초안으로 복구했습니다. 공개하려면 다시 승인해 주세요.':'글을 삭제했습니다. 휴지통에서 복구할 수 있습니다.');}
 catch(e){notice(e.message,true);}finally{button.disabled=false;}
}
async function loadList(){
 if(!discardNaverText())return;clearTimeout(state.autoTimer);show('workspace');$('naver-view').hidden=true;$('naver-tab').setAttribute('aria-pressed','false');$('posts-view').hidden=false;$('users-view').hidden=true;$('posts-tab').setAttribute('aria-pressed','true');$('users-tab').setAttribute('aria-pressed','false');
 const query=new URLSearchParams({page:state.page,q:$('search').value,status:$('status-filter').value});const data=await api('posts?'+query);state.hasMore=data.hasMore;
 if(!data.posts.length&&state.page>1){state.page--;return loadList();}
 const trash=$('status-filter').value==='trash';$('list-title').textContent=trash?'휴지통':state.user.role==='admin'?'전체 직원의 글':'내가 작성한 글';$('trash-view').textContent=trash?'전체 글 목록':'휴지통';
 const root=$('post-list');root.replaceChildren();
 for(const post of data.posts){const row=node('article',undefined,'post-row');const text=node('div',undefined,'post-copy');const title=node(post.is_trashed?'h2':'button',post.title||'제목 없는 글',post.is_trashed?'':'row-title');if(!post.is_trashed){title.type='button';title.addEventListener('click',()=>openPost(post.id).catch(e=>notice(e.message,true)));}text.append(title,node('p',post.category+' · '+post.owner_name+' · '+(post.is_trashed?'삭제 ':'')+new Date(post.trashed_at||post.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));const actions=node('div',undefined,'post-actions');actions.append(node('span',statusText(post),'badge'));if(state.user.role==='admin'){const restore=!!post.is_trashed;const button=node('button',restore?'복구':'삭제',restore?'':'danger');button.type='button';button.dataset.action=restore?'restore':'trash';button.setAttribute('aria-label',(post.title||'제목 없는 글')+' '+(restore?'복구':'삭제'));button.addEventListener('click',()=>moveListPost(post,restore,button));actions.append(button);}row.append(text,actions);root.append(row);}
 if(!data.posts.length)root.append(node('p',trash?'휴지통이 비어 있습니다.':'아직 작성한 글이 없습니다. ‘새 글 쓰기’로 시작해 주세요.','empty'));
 $('page-label').textContent=state.page+'쪽';$('prev-page').disabled=state.page<=1;$('next-page').disabled=!state.hasMore;
}
$('search-form').addEventListener('submit',event=>{event.preventDefault();state.page=1;loadList().catch(e=>notice(e.message,true));});
bind('prev-page',async()=>{state.page=Math.max(1,state.page-1);await loadList();});
bind('next-page',async()=>{if(state.hasMore)state.page++;await loadList();});
bind('posts-tab',loadList);bind('users-tab',loadUsers);
bind('trash-view',async()=>{$('status-filter').value=$('status-filter').value==='trash'?'':'trash';state.page=1;await loadList();});
bind('new-post',async()=>{if(state.dirty)await save(true);$('new-post').disabled=true;try{const data=await api('posts',{method:'POST',body:{}});await openPost(data.id);}finally{$('new-post').disabled=false;}});
function ensureEditor(){
 if(editor)return;
 class YouTube extends Quill.import('blots/block/embed'){
  static blotName='youtube';static tagName='figure';static className='youtube-video';
  static create(id){const n=super.create();if(!validYouTubeId(id))return n;n.dataset.video=id;n.setAttribute('contenteditable','false');const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id;frame.title='YouTube 영상';frame.setAttribute('allowfullscreen','');frame.setAttribute('allow','accelerometer; encrypted-media; gyroscope; picture-in-picture');frame.referrerPolicy='strict-origin-when-cross-origin';n.append(frame);return n;}
  static value(n){return n.dataset.video;}
 }
 Quill.register(YouTube,true);registerImageSize(Quill);
 const palette=['#000000','#e60000','#ff9900','#ffff00','#008a00','#0066cc','#9933ff','#ffffff'];
 ['color','background'].forEach(name=>{const attr=Quill.import('attributors/class/'+name);attr.whitelist=palette;Quill.register(attr,true);});
 editor=new Quill('#rich-editor',{theme:'snow',placeholder:'학생이 궁금해한 질문과 안내할 내용을 적어 주세요. 사진도 넣을 수 있습니다.',formats:['header','bold','italic','underline','strike','size','color','background','align','list','blockquote','link','image','youtube','comparisonTable'],modules:{toolbar:{container:'#toolbar',handlers:{link(){const range=this.quill.getSelection();if(!range||!range.length){notice('링크를 넣을 글자를 먼저 선택해 주세요.',true);return;}const value=prompt('연결할 http 또는 https 주소를 입력해 주세요.');if(value===null)return;const video=youtubeId(value);if(video){insertYouTube(video,range);return;}try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw new Error();this.quill.format('link',u.href);}catch{notice('올바른 웹 주소를 입력해 주세요.',true);}}}}}});
 extra.install(editor,changed,notice);installImageResize(editor,Quill);
 const toolbar=editor.getModule('toolbar');toolbar.addHandler('image',chooseImage);toolbar.addHandler('youtube',()=>{const value=prompt('YouTube 영상 주소를 입력해 주세요.');if(value===null)return;const id=youtubeId(value);if(!id){notice('올바른 YouTube 영상 링크를 입력해 주세요.',true);return;}insertYouTube(id);});
 editor.on('selection-change',range=>{if(range)imagePosition=range.index;});
 editor.root.addEventListener('click',event=>{if(event.target.tagName!=='IMG')return;const blot=Quill.find(event.target);if(blot){editor.setSelection(editor.getIndex(blot),0,'silent');editor.focus({preventScroll:true});}});
 function insertYouTube(id,range=editor.getSelection(true)){const at=range?.index??editor.getLength()-1;editor.history.cutoff();if(range?.length)editor.deleteText(at,range.length,'user');editor.insertEmbed(at,'youtube',id,'user');editor.setSelection(at+1,0,'silent');editor.history.cutoff();}
 editor.root.addEventListener('paste',event=>{const id=youtubeId(event.clipboardData?.getData('text/plain')||'');if(!id)return;event.preventDefault();event.stopImmediatePropagation();insertYouTube(id);},true);
 editor.root.addEventListener('keydown',event=>{if(event.isComposing||!['Enter',' '].includes(event.key))return;const range=editor.getSelection();if(!range||range.length)return;const [line]=editor.getLine(range.index);if(!line)return;const start=editor.getIndex(line),id=youtubeId(editor.getText(start,range.index-start));if(!id)return;event.preventDefault();event.stopImmediatePropagation();insertYouTube(id,{index:start,length:range.index-start});},true);
 $('undo').addEventListener('click',()=>editor.history.undo());$('redo').addEventListener('click',()=>editor.history.redo());
 editor.getModule('toolbar').addHandler('align',value=>{editor.formatLine(editor.getSelection(true), 'align',value, 'user');});
 editor.clipboard.addMatcher('IMG',()=>new (Quill.import('delta'))());
 editor.on('text-change',(_d,_old,source)=>{if(source==='user'){extra.syncImages();changed();}});
 $('rich-editor').addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();event.stopImmediatePropagation();uploadImages(event.dataTransfer.files).catch(e=>notice(e.message,true));}},true);
 $('rich-editor').addEventListener('paste',event=>{const files=[...(event.clipboardData?.files||[])];if(files.length){event.preventDefault();event.stopImmediatePropagation();uploadImages(files).catch(e=>notice(e.message,true));}},true);
}
function fillSnapshot(snapshot){state.loading=true;ensureEditor();state.snapshot=snapshot;$('title').value=snapshot.title||'';$('category').value=snapshot.category;$('summary').value=snapshot.summary||'';$('sources').value=snapshot.sources||'';$('verified-at').value=snapshot.verifiedAt||'';$('post-author').textContent=snapshot.authorName;editor.setContents(snapshot.delta,'silent');editor.history.clear();extra.fill(snapshot);state.loading=false;}
async function openPost(id,{preservePosition=false}={}){
 if(state.dirty)await save(true);const data=await api('posts/'+id);state.post=data.post;state.naver=data.naver||null;state.factReview=data.factReview||null;state.revision=data.post.revision;state.dirty=false;state.changes=0;imagePosition=null;state.autoStopped=false;fillSnapshot(data.snapshot);$('version-list').replaceChildren();show('editor-view');fillNaverReview();updateState();notice();$('title').focus({preventScroll:preservePosition});
}
function updateState(){if(!state.post)return;updateNaverReviewState();extra.status({user:state.user,post:state.post,dirty:state.dirty,revision:state.revision,review:state.factReview,snapshot:state.snapshot});$('editor-state').textContent=statusText({...state.post,revision:state.revision});$('save-state').textContent=state.dirty?'저장할 변경 사항이 있습니다.':'저장 완료 · 버전 '+state.revision;$('publish').hidden=state.user.role!=='admin';$('unpublish').hidden=state.user.role!=='admin'||!state.post.published_revision;$('public-link').hidden=!state.post.published_revision;$('public-link').href='/blog/'+state.post.slug+'/';$('publication-note').textContent=state.post.published_revision?'현재 공개본은 별도로 유지됩니다. 관리자 승인 전에는 수정 내용이 공개되지 않습니다.':'초안은 로그인한 작성자와 관리자만 볼 수 있습니다.';}
function changed(){if(state.loading||!state.post)return;state.dirty=true;state.changes++;updateState();clearTimeout(state.autoTimer);if(!state.autoStopped)state.autoTimer=setTimeout(()=>save(false).catch(e=>notice(e.message,true)),1800);}
['title','category','summary','sources','verified-at'].forEach(id=>$(id).addEventListener('input',changed));
function currentSnapshot(){return {title:$('title').value,category:$('category').value,summary:$('summary').value,sources:$('sources').value,verifiedAt:$('verified-at').value,delta:editor.getContents(),revision:state.revision,...extra.snapshot()};}
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
async function action(kind){await save(true);if(kind==='publish'&&!confirm('저장된 이 버전을 공개하시겠습니까? 누구나 읽을 수 있습니다.'))return;if(kind==='unpublish'&&!confirm('현재 공개본을 내릴까요? 원고와 수정 이력은 보관됩니다.'))return;const data=await api('posts/'+state.post.id+'/'+kind,{method:'POST',body:{revision:state.revision}});await openPost(state.post.id,{preservePosition:true});notice(kind==='publish'?'공개했습니다. ‘현재 공개본 보기’에서 확인해 주세요.':kind==='review'?'관리자에게 검토를 요청했습니다. 별도 메일·메신저 알림은 발송하지 않습니다.':'공개를 내렸습니다. 원고와 이력은 유지됩니다.');return data;}
bind('review',()=>action('review'));bind('publish',()=>action('publish'));bind('unpublish',()=>action('unpublish'));
bind('record-facts',async()=>{await save(true);await api('posts/'+state.post.id+'/factcheck',{method:'POST',body:{revision:state.revision,checks:extra.checks()}});await openPost(state.post.id);notice('현재 버전의 사실 확인을 기록했습니다. 별도로 공개 승인해 주세요.');});
async function webpImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG·PNG·WebP 사진을 선택해 주세요.');if(file.size>20*1024*1024)throw new Error('사진 한 장은 20MB 이하로 선택해 주세요.');
 const bitmap=await createImageBitmap(file);let canvas;
 try{if(bitmap.width*bitmap.height>60000000)throw new Error('사진 크기가 너무 큽니다. 해상도를 줄여 주세요.');const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);}finally{bitmap.close();}
 let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(blob&&blob.size>900000)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.55));if(!blob||blob.type!=='image/webp'||blob.size>900000)throw new Error('사진을 충분히 줄이지 못했습니다. 작은 사진으로 다시 시도해 주세요.');
 return blob;
}
async function insertImage({blob,postId,source='',rights='',position}){
 if(state.post?.id!==postId)throw new Error('다른 글로 이동했습니다. 원래 글에서 다시 추가해 주세요.');
 const data=await api('posts/'+postId+'/images',{method:'POST',headers:{'Content-Type':'image/webp'},body:blob});
 if(state.post?.id!==postId)throw new Error('사진을 읽는 중 글이 바뀌어 본문에 넣지 않았습니다. 원래 글에서 다시 추가해 주세요.');
 extra.imageUploaded({...data,source,rights});const range=position===undefined?editor.getSelection(true):null;let index=Math.max(0,Math.min(position??range?.index??editor.getLength()-1,editor.getLength()-1));if(index>0&&editor.getText(index-1,1)!=='\n'){editor.insertText(index,'\n','user');index++;}editor.insertEmbed(index,'image',data.url,'user');editor.insertText(index+1,'\n','user');editor.setSelection(index+2,0,'silent');try{await save(true);}catch(e){e.imagePosition=index+2;throw e;}return index+2;
}
function chooseImage(){imagePosition=editor.getSelection()?.index??imagePosition??editor.getLength()-1;$('image-file').click();}
async function uploadImages(files){if(!state.post)return;const postId=state.post.id;let position=imagePosition??editor.getSelection()?.index??editor.getLength()-1;await save(true);for(const file of [...files].slice(0,12)){notice('사진 크기를 줄여 공동 DB에 등록하고 있습니다.');position=await insertImage({blob:await webpImage(file),postId,position});}notice('사진과 글을 공동 DB에 저장했습니다.');}
window.UK_NAVER_IMAGES.install({api,save:()=>save(true),convert:webpImage,insert:insertImage,notify:notice,position:()=>editor.getSelection(true)?.index??editor.getLength()-1,context:()=>({postId:state.post?.id,item:state.naver,existing:new Set(Object.values(extra.snapshot().imageMeta).map(m=>m.source).filter(Boolean)),position:editor.getSelection()?.index??editor.getLength()-1})});
bind('add-image',chooseImage);$('image-file').addEventListener('change',async()=>{try{await uploadImages($('image-file').files);}catch(e){notice(e.message,true);}finally{$('image-file').value='';}});
bind('versions',async()=>{await save(true);const data=await api('posts/'+state.post.id+'/versions');const root=$('version-list');root.replaceChildren();for(const v of data.versions){const row=node('div',undefined,'version-row');row.append(node('p','버전 '+v.revision+' · '+v.editor+' · '+new Date(v.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));const button=node('button','이 내용을 편집기에 불러오기');button.type='button';button.addEventListener('click',async()=>{try{if(!confirm('선택한 이전 내용을 편집기로 불러올까요? 공개본은 바뀌지 않습니다.'))return;const data=await api('posts/'+state.post.id+'/versions/'+v.revision);fillSnapshot(data.snapshot);changed();await save(true);notice('이전 내용을 새 버전으로 저장했습니다.');}catch(e){notice(e.message,true);}});row.append(button);root.append(row);}});
bind('download-draft',()=>{const file=new Blob([JSON.stringify({...currentSnapshot(),postId:state.post.id,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='신촌점_원고_'+state.post.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);notice('현재 원고 보관 파일을 내려받았습니다. 사진 원본·DB 전체 백업은 포함하지 않습니다.');});
bind('import-draft',()=>{$('draft-file').click();});
$('draft-file').addEventListener('change',async()=>{try{
 const file=$('draft-file').files[0];if(!file)return;if(file.size>1000000)throw new Error('원고 파일은 1MB 이내로 선택해 주세요.');
 const data=JSON.parse(await file.text());if(data.postId!==state.post.id)throw new Error('이 파일을 보관했던 원래 글을 열고 다시 불러와 주세요.');
 if(!confirm('보관한 내용을 이 글의 새 버전으로 저장할까요? 공개본은 바뀌지 않습니다.'))return;
 await save(true);fillSnapshot(data);changed();await save(true);await openPost(state.post.id);notice('보관한 원고를 새 버전으로 저장했습니다.');
 }catch(e){notice(e.message,true);}finally{$('draft-file').value='';}});
async function loadUsers(){if(!discardNaverText())return;$('naver-view').hidden=true;$('naver-tab').setAttribute('aria-pressed','false');if(state.dirty)await save(true);const data=await api('users');show('workspace');$('posts-view').hidden=true;$('users-view').hidden=false;$('posts-tab').setAttribute('aria-pressed','false');$('users-tab').setAttribute('aria-pressed','true');const root=$('user-list');root.replaceChildren();for(const user of data.users){const row=node('article',undefined,'user-row');row.append(node('strong',user.name+' · '+(user.role==='admin'?'관리자':'직원')),node('p',user.email+' · '+(user.active?'사용 중':'사용 중지')));if(user.role==='author'){const reset=node('button','임시 비밀번호 재설정');reset.type='button';reset.addEventListener('click',async()=>{const pass=prompt(user.name+' 직원의 새 임시 비밀번호를 입력해 주세요. (12자 이상)');if(pass===null)return;try{await api('users/'+user.id+'/reset',{method:'POST',body:{password:pass}});notice('임시 비밀번호를 재설정했습니다. 직원에게 별도로 전달해 주세요.');await loadUsers();}catch(e){notice(e.message,true);}});const active=node('button',user.active?'계정 사용 중지':'계정 다시 사용');active.type='button';active.addEventListener('click',async()=>{if(!confirm(user.name+' 계정의 사용 상태를 변경할까요? 기존 로그인도 해제됩니다.'))return;try{await api('users/'+user.id+'/active',{method:'POST',body:{active:!user.active}});await loadUsers();notice('계정 상태를 변경했습니다.');}catch(e){notice(e.message,true);}});row.append(reset,active);}root.append(row);}}
$('user-form').addEventListener('submit',async event=>{event.preventDefault();try{await api('users',{method:'POST',body:{name:$('user-name').value,email:$('user-email').value,password:$('user-password').value}});$('user-form').reset();await loadUsers();notice('직원 계정을 만들었습니다. 로그인 주소와 임시 비밀번호를 별도로 전달해 주세요.');}catch(e){notice(e.message,true);}});

function discardNaverText(){if(!naverTextDirty)return true;if(!confirm('원문 입력이 아직 저장되지 않았습니다. 입력을 버리고 이동할까요?'))return false;naverTextDirty=false;return true;}
const naverStatus={seen:'연결 전 기존 글',new:'새 글 발견',source_ready:'원문 확인',awaiting_ai:'AI 연결 대기',needs_input:'원문 보완 필요',source_changed:'원문 변경 · 재검수 필요',draft_ready:'초안 준비',editing_error:'재편집 보류·직접 확인 필요'};
async function loadNaver(){
 if(!discardNaverText())return;if(state.dirty)await save(true);
 const data=await api('naver');show('workspace');$('posts-view').hidden=true;$('users-view').hidden=true;$('naver-view').hidden=false;$('posts-tab').setAttribute('aria-pressed','false');$('users-tab').setAttribute('aria-pressed','false');$('naver-tab').setAttribute('aria-pressed','true');
 $('naver-enabled').checked=!!data.config.enabled;
 $('naver-health').textContent='AI: '+(data.ai.configured?'설정값 있음 · 호출 결과로 확인':'미연결 · AI 없이 초안 정리 가능')+(data.ai.model?' / 모델 '+data.ai.model:'')+' · 예약 감지 키: '+(data.schedulerKeyConfigured?'설정값 있음':'미설정');
 $('naver-run-state').textContent='최근 확인: '+(data.config.last_checked_at?new Date(data.config.last_checked_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 없음')+' / 예약 호출: '+(data.config.last_cron_at?new Date(data.config.last_cron_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 확인 안 됨')+(data.config.last_error?' / 오류: '+data.config.last_error:'');
 const root=$('naver-items');root.replaceChildren();
 for(const item of data.items){const row=node('article',undefined,'naver-item-row');row.append(node('h2',item.title),node('p',(item.post_trashed?'휴지통에 있는 글 · 전체 글 목록에서 복구':naverStatus[item.status]||item.status)+' · '+(item.source_complete?'본문 텍스트 확인·이미지 별도':'RSS 요약만 확인')+(item.mode?' · '+(item.mode==='ai'?'AI 재편집':'원문 정리'):'')+(item.error?' · '+item.error:''),'naver-status'));const actions=node('div',undefined,'naver-row-actions');const open=node('button','원문 보기·보완');open.type='button';open.addEventListener('click',()=>openNaverItem(item.id).catch(e=>notice(e.message,true)));actions.append(open);if(item.post_id&&!item.post_trashed){const draft=node('button','초안 열기');draft.type='button';draft.addEventListener('click',()=>{if(discardNaverText())openPost(item.post_id).catch(e=>notice(e.message,true));});actions.append(draft);}row.append(actions);root.append(row);}
 if(!data.items.length)root.append(node('p','아직 확인한 글이 없습니다. 감지를 허용하고 ‘지금 새 글 확인’을 누르거나 개별 글 주소를 넣어 주세요.','empty'));
 $('naver-detail').hidden=true;
}
async function openNaverItem(id){if(!discardNaverText())return;const data=await api('naver/items/'+id);state.naverItem=data.item;const i=data.item;$('naver-detail-title').textContent=i.title;$('naver-detail-link').href=i.url;$('naver-detail-info').textContent=(i.source_complete?'본문 텍스트 확인·이미지 제외 · '+i.source_method:'현재 RSS 요약만 확보했습니다. 전체 원문을 다시 읽거나 직접 넣어 주세요.')+(i.error?' · '+i.error:'');$('naver-source-text').value=i.source_text||i.excerpt;$('naver-source-confirmed').checked=false;$('naver-open-draft').hidden=!i.post_id||!!i.post_trashed;$('naver-ai-draft').disabled=!!i.post_trashed;$('naver-manual-draft').disabled=!!i.post_trashed;if(i.post_trashed)$('naver-detail-info').textContent='연결된 글이 휴지통에 있습니다. 전체 글 목록에서 복구한 뒤 재편집해 주세요.';$('naver-detail').hidden=false;naverTextDirty=false;$('naver-detail').scrollIntoView({block:'start',behavior:'smooth'});}
function fillNaverReview(){const i=state.naver;$('naver-review-panel').hidden=!i;if(!i)return;$('naver-review-link').href=i.url;$('naver-review-source').value=i.source_text||i.excerpt;$('naver-review-meta').textContent=(i.status==='source_changed'?'원문 변경 감지 · 재대조 필요 / ':'')+(i.mode==='ai'?'AI 재편집 · '+i.model:'AI를 사용하지 않은 원문 정리')+' / 원문 읽은 시각: '+(i.fetched_at?new Date(i.fetched_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'확인 필요');let images=[];try{images=JSON.parse(i.images);}catch{}$('naver-image-note').textContent='원문 사진 참조 '+images.length+'개 · 아래 버튼으로 사용할 사진을 골라 가져올 수 있습니다. 이미지 안의 가격·조건·표와 사진 설명·사용 근거를 확인해 주세요.';for(const [id,values] of [['naver-review-notes',JSON.parse(i.notes||'[]')],['naver-evidence',JSON.parse(i.evidence||'[]')]]){$(id).replaceChildren();for(const value of values)$(id).append(node('li',value));}for(const key of ['facts','conditions','rights'])$('naver-check-'+key).checked=false;}
function updateNaverReviewState(){if(!state.naver)return;const done=state.naver.approved_revision===state.revision&&state.naver.approved_source_hash===state.naver.source_hash&&!state.dirty;$('naver-review-state').textContent=done?(state.factReview?.kind==='ai'?'Codex의 AI 검토가 완료된 원고입니다. 사람의 검토로 기록하지 않습니다.':String(state.naver.approved_by||'').startsWith('codex-ai:')?'Codex 검토의 재확인이 필요합니다. 현재 내용·원문·검토 기한을 확인해 주세요.':'현재 저장 버전의 검수 완료가 기록되어 있습니다.'):'현재 저장 버전은 검수가 필요합니다.';$('apply-codex-post').hidden=!pilotPosts.some(p=>p.id===state.naver.id);}
const pilotPosts=[
 {id:'224442365768',category:'대학·파운데이션',contentType:'guide',requiresFactCheck:true,appliesTo:'2027년 입학 · 리버풀대학교 약대 파운데이션'},
 {id:'224408275837',category:'어학연수',contentType:'comparison',requiresFactCheck:true,appliesTo:'공무원 어학연수 · 학교별 과정과 동일 수업·숙소 조건 확인'},
 {id:'224466258454',category:'어학연수',contentType:'news',requiresFactCheck:true,appliesTo:'2026년 11월 자료 · 학교·캠퍼스·집계 범위 확인'},
 {id:'224465727870',category:'상담 사례·소식',contentType:'case',requiresFactCheck:false,appliesTo:''},
 {id:'224440279774',category:'비용·장학금',contentType:'news',requiresFactCheck:true,appliesTo:'2027년 석사 입학 · 엑시터대학교 장학금 적용 대상과 조건 확인'}
];
bind('apply-codex-pilots',async()=>{
 if(!discardNaverText())return;const button=$('apply-codex-pilots');button.disabled=true;let applied=0,existing=0;const errors=[];
 try{
  const known=await api('naver');const linked=new Set(known.items.filter(item=>item.post_id).map(item=>item.id));
  for(const [index,seed] of pilotPosts.entries()){
   $('pilot-state').textContent=(index+1)+'/5 Codex 검토 원고를 적용하고 있습니다.';
   try{
    if(linked.has(seed.id)){existing++;continue;}
    await api('naver/url',{method:'POST',body:{url:'https://blog.naver.com/pedu2/'+seed.id}});
    const result=await api('naver/items/'+seed.id+'/codex-reviewed',{method:'POST',body:{onlyNew:true}});
    if(result.skipped)existing++;else applied++;
   }catch(e){errors.push(seed.id+': '+e.message);}
  }
  await loadNaver();const result='Codex 검토 원고 적용 '+applied+'개 · 기존 원고 보존 '+existing+'개';
  $('pilot-state').textContent=result+(errors.length?' / '+errors.join(' / '):'. 기존 글은 열어서 ‘이 글에 Codex 검토 원고 적용’을 사용할 수 있습니다. 내용 검토는 완료되었으며 공개 승인은 별도입니다.');notice(result,!!errors.length);
 }finally{button.disabled=false;}
});
bind('apply-codex-post',async()=>{
 if(!state.naver||!pilotPosts.some(p=>p.id===state.naver.id))return;
 await save(true);
 if(!confirm('Codex가 검토한 원고를 새 저장 버전으로 적용할까요? 현재 초안은 수정 이력에 남고 공개본은 유지됩니다.'))return;
 const result=await api('naver/items/'+state.naver.id+'/codex-reviewed',{method:'POST',body:{revision:state.revision}});
 await openPost(result.postId);notice('Codex의 AI 검토 원고를 적용했습니다. 사람의 재검토 체크 없이 공개 승인할 수 있습니다.');
});
bind('prepare-pilot',async()=>{
 if(!discardNaverText())return;const button=$('prepare-pilot');button.disabled=true;let created=0,existing=0;const errors=[];
 try{
  for(const [index,seed] of pilotPosts.entries()){
   $('pilot-state').textContent=(index+1)+'/5 원문을 확인하고 있습니다.';
   try{
    const source=await api('naver/url',{method:'POST',body:{url:'https://blog.naver.com/pedu2/'+seed.id}});
    if(source.item.post_id){existing++;continue;}
    const draft=await api('naver/items/'+seed.id+'/draft',{method:'POST',body:{mode:'manual'}});
    const data=await api('posts/'+draft.postId);
    await api('posts/'+draft.postId,{method:'PUT',body:{...data.snapshot,...seed,schemaVersion:2,revision:data.post.revision}});created++;
   }catch(e){errors.push(seed.id+': '+e.message);}
  }
  await loadNaver();const result='준비 결과: 새 초안 '+created+'개 · 기존 초안 '+existing+'개'+(errors.length?' · 확인 필요 '+errors.length+'개':' · 5개 확인 완료');
  $('pilot-state').textContent=result+(errors.length?' / '+errors.join(' / '):'. 아래 목록의 ‘초안 열기’로 재편집·검토해 주세요.');notice(result,!!errors.length);
 }finally{button.disabled=false;}
});
bind('naver-tab',loadNaver);
bind('naver-config-save',async()=>{await api('naver/config',{method:'POST',body:{enabled:$('naver-enabled').checked}});await loadNaver();notice('감지 설정을 저장했습니다. 정기 실행은 별도 Worker 연결 후 동작합니다.');});
bind('naver-check',async()=>{const button=$('naver-check');button.disabled=true;notice('네이버 목록과 새 글을 확인하고 있습니다.');try{const result=await api('naver/check',{method:'POST',body:{}});await loadNaver();notice(result.disabled?'감지 허용을 켜고 설정을 저장해 주세요.':result.busy?'이미 확인 중입니다. 잠시 뒤 새로 확인해 주세요.':result.baseline?'기존 '+result.count+'개 글을 기준 목록으로 등록했습니다. 기존 글은 자동으로 초안을 만들지 않았습니다.':'새 항목 '+result.added+'개 · 변경 '+result.changed+'개 · AI 초안 '+result.drafts+'개 · AI 대기 '+result.waiting+'개');}finally{button.disabled=false;}});
$('naver-url-form').addEventListener('submit',async event=>{event.preventDefault();try{notice('해당 네이버 글을 읽고 있습니다.');const data=await api('naver/url',{method:'POST',body:{url:$('naver-url').value}});await loadNaver();await openNaverItem(data.item.id);notice('원문을 읽었습니다. 초안 생성 방식을 선택해 주세요.');}catch(e){notice(e.message,true);await loadNaver().catch(()=>{});}});
$('naver-source-text').addEventListener('input',()=>{naverTextDirty=true;});
bind('naver-fetch-source',async()=>{if(!discardNaverText())return;const id=state.naverItem.id;try{await api('naver/items/'+id+'/fetch',{method:'POST',body:{}});await openNaverItem(id);notice('본문을 다시 읽었습니다. 원문을 대조해 주세요.');}catch(e){await openNaverItem(id);throw e;}});
bind('naver-save-source',async()=>{const id=state.naverItem.id;await api('naver/items/'+id+'/text',{method:'POST',body:{text:$('naver-source-text').value,confirmed:$('naver-source-confirmed').checked}});naverTextDirty=false;await openNaverItem(id);notice('직접 확인한 전체 원문을 저장했습니다.');});
async function makeNaverDraft(mode){if(naverTextDirty)throw new Error('입력한 원문을 먼저 저장해 주세요.');if(state.naverItem.post_id&&!confirm('재편집 결과를 현재 초안의 새 버전으로 만들까요? 기존 공개본은 유지됩니다.'))return;const button=$(mode==='ai'?'naver-ai-draft':'naver-manual-draft');button.disabled=true;notice(mode==='ai'?'AI가 원문을 바탕으로 재편집 중입니다. 공개하지 않습니다.':'원문 정리 초안을 만들고 있습니다.');try{const result=await api('naver/items/'+state.naverItem.id+'/draft',{method:'POST',body:{mode}});await openPost(result.postId);notice(mode==='ai'?'AI 초안을 만들었습니다. 원문과 대조하고 검수한 뒤 공개 승인해 주세요.':'AI 없이 원문 정리 초안을 만들었습니다. 직접 재편집·검수한 뒤 공개해 주세요.');}finally{button.disabled=false;}}
bind('naver-ai-draft',()=>makeNaverDraft('ai'));bind('naver-manual-draft',()=>makeNaverDraft('manual'));bind('naver-open-draft',()=>{if(discardNaverText())return openPost(state.naverItem.post_id);});
bind('naver-approve',async()=>{await save(true);const checks=Object.fromEntries(['facts','conditions','rights'].map(k=>[k,$('naver-check-'+k).checked]));await api('naver/items/'+state.naver.id+'/review',{method:'POST',body:{revision:state.revision,sourceHash:state.naver.source_hash,checks}});const draft=currentSnapshot();try{if(draft.requiresFactCheck||['guide','comparison'].includes(draft.contentType)||(draft.verifiedAt&&draft.reviewScope))await api('posts/'+state.post.id+'/factcheck',{method:'POST',body:{revision:state.revision,checks}});}finally{await openPost(state.post.id);}notice('현재 버전의 검수를 기록했습니다. 별도로 공개 승인하면 게시됩니다.');});
bind('naver-make-cron-key',()=>{$('naver-cron-key').value=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');notice('예약용 키를 현재 기기에서 만들었습니다. Pages와 Worker 양쪽의 CMS_NAVER_CRON_TOKEN Secret에 같은 값을 저장해야 합니다.');});
bind('naver-copy-cron-key',async()=>{const field=$('naver-cron-key');if(!field.value)throw new Error('현재 기기에서 키를 먼저 만들어 주세요.');try{await navigator.clipboard.writeText(field.value);notice('예약용 키를 복사했습니다.');}catch{field.focus();field.select();notice('키를 선택했습니다. 기기의 복사 기능을 사용해 주세요.');}});

window.addEventListener('beforeunload',event=>{if(state.dirty||naverTextDirty){event.preventDefault();event.returnValue='';}});
boot();
})();
