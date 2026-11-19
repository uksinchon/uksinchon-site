(()=>{
const $=id=>document.getElementById(id);
const notice=(t,e=false)=>{$('notice').textContent=t;$('notice').classList.toggle('error',e);};
const NAMES=['첫째 카드 (맨체스터 대학 사진)','둘째 카드 (UCL 사진)','셋째 카드 (학생들 사진)'];
async function api(path,options={}){
 const r=await fetch('/api/cms/'+path,{credentials:'same-origin',...options,headers:options.body?{'Content-Type':'application/json'}:{}});
 let d={};try{d=await r.json();}catch{}
 if(!r.ok)throw Object.assign(new Error(d.error||'처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),{status:r.status});
 return d;
}
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
function field(label,input){const id='f'+Math.random().toString(36).slice(2);input.id=id;return [el('label',{htmlFor:id,textContent:label}),input];}
function render(data){
 const box=$('slots');box.replaceChildren();
 for(const slot of [1,2,3]){
  const cur=data.slots.find(s=>s.slot===slot)||{};
  const sel=el('select');sel.append(el('option',{value:'',textContent:'— 기본 카드 사용 (홈페이지에 넣어 둔 카드) —'}));
  for(const p of data.posts)sel.append(el('option',{value:p.id,textContent:`[${p.category||'노트'}] ${p.title}`}));
  sel.value=cur.post_id&&data.posts.some(p=>p.id===cur.post_id)?cur.post_id:'';
  const tag=el('input',{maxLength:30,value:cur.tag||''}),headline=el('input',{maxLength:80,value:cur.headline||''}),body=el('textarea',{maxLength:160,rows:2,value:cur.body||''});
  const hint=()=>{const p=data.posts.find(x=>x.id===sel.value);tag.placeholder=p?.category||'예: 수능 이후';headline.placeholder=p?.title||'카드 큰 제목';body.placeholder=p?.summary||'카드 설명 한두 줄';};
  sel.addEventListener('change',hint);hint();
  const state=el('p',{className:'state',textContent:cur.post_id?(data.posts.some(p=>p.id===cur.post_id)?'노트 연결됨'+(cur.updated_at?' · '+new Date(cur.updated_at).toLocaleString('ko-KR'):''):'연결한 노트가 비공개 상태라 기본 카드가 보이는 중'):'기본 카드 사용 중'});
  const save=el('button',{type:'button',className:'button',textContent:'저장'}),reset=el('button',{type:'button',textContent:'기본 카드로 되돌리기'});
  const send=async(payload,btn)=>{btn.disabled=true;try{await api('season/'+slot,{method:'PUT',body:JSON.stringify(payload)});notice('저장했습니다. 메인에 바로 반영됩니다.');await load();}catch(e){notice(e.message,true);btn.disabled=false;}};
  save.addEventListener('click',()=>{if(!sel.value){notice('연결할 노트를 고르거나, 기본 카드로 되돌리기를 눌러 주세요.',true);return;}send({postId:sel.value,tag:tag.value,headline:headline.value,body:body.value},save);});
  reset.addEventListener('click',()=>send({postId:null},reset));
  box.append(el('section',{className:'card slot'},el('h2',{textContent:NAMES[slot-1]}),state,...field('연결할 노트',sel),el('div',{className:'row2'},el('div',{},...field('작은 꼬리표',tag)),el('div',{},...field('큰 제목',headline))),...field('설명',body),el('div',{className:'actions'},reset,save)));
 }
}
async function load(){
 try{const data=await api('season');$('board').hidden=false;if(!$('notice').classList.contains('error')&&$('notice').textContent==='불러오는 중입니다.')notice('');render(data);
  if(!data.posts.length)notice('아직 공개된 노트가 없습니다. 노트를 먼저 공개해 주세요.');}
 catch(e){$('board').hidden=true;notice(e.status===401?'로그인이 필요합니다. 글쓰기 관리 화면에서 로그인한 뒤 다시 들어와 주세요.':e.status===403?e.message+' 관리자 계정으로만 사용할 수 있습니다.':e.message,true);}
}
api('me').then(d=>{$('account-name').textContent=d.user.name;}).catch(()=>{});
load();
})();
