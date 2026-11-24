(()=>{
const $=id=>document.getElementById(id);
const el=(tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='text')e.textContent=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v);}for(const c of kids)if(c!=null)e.append(c);return e;};
const notice=(t,e=false)=>{$('notice').textContent=t;$('notice').hidden=!t;$('notice').classList.toggle('error',e);};
async function api(path,options={}){
 const headers=options.body&&!(options.body instanceof Blob)?{'Content-Type':'application/json'}:options.type?{'Content-Type':options.type}:{};
 const r=await fetch('/api/cms/'+path,{credentials:'same-origin',...options,headers});
 let d={};try{d=await r.json();}catch{}
 if(!r.ok)throw Object.assign(new Error(d.error||'처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),{status:r.status});
 return d;
}
const day=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
const TYPE={hook_photo:'첫 장면 · 사진',photo_statement:'사진 + 문장',question:'질문',compare:'비교 막대',ranking:'순위표',table:'표',big_number:'큰 숫자',steps:'단계',checklist:'체크리스트',cta:'마지막 · 상담 안내'};
const PHOTO_TYPES=['hook_photo','photo_statement','big_number'];
const GROUP={youtube:'유튜브',instagram:'인스타그램',tiktok:'틱톡',threads:'스레드',clip:'네이버 클립',kakao:'카카오톡 소식'};
let S={reel:null,dirty:false,me:null};

function fail(e){if(e.status===401)notice('로그인이 필요합니다. 글쓰기 관리 화면에서 로그인한 뒤 다시 들어와 주세요.',true);else notice(e.message,true);}

// ---------- 목록 ----------
async function list(){
 $('detail-view').hidden=true;
 try{
  const d=await api('reels');notice('');$('list-view').hidden=false;
  const c=d.configured;const miss=[!c.ai&&'AI 기획(ANTHROPIC_API_KEY)',!c.github&&'렌더 서버(REEL_GITHUB_TOKEN)',!c.agent&&'렌더 인증키(REEL_AGENT_TOKEN)'].filter(Boolean);
  $('setup-warn').hidden=!miss.length;$('setup-warn').textContent=miss.length?'아직 연결되지 않은 설정: '+miss.join(', ')+'. 연결 전에는 해당 단계를 진행할 수 없습니다.':'';
  const f=$('fresh');f.replaceChildren();
  for(const it of d.fresh)f.append(el('div',{class:'it'},el('small',{text:day(it.published_at||it.discovered_at)}),el('span',{text:it.title}),el('button',{type:'button',text:'쇼릴 만들기',onclick:()=>create({naverId:it.id})})));
  if(!d.fresh.length)f.append(el('p',{class:'muted',text:'쇼릴로 만들지 않은 새 글이 없습니다. (네이버 가져오기에서 새 글 확인 후 표시됩니다)'}));
  const rows=$('rows');rows.replaceChildren();
  for(const r of d.reels){const tr=el('tr',{tabindex:0,onclick:()=>go(r.id),onkeydown:e=>e.key==='Enter'&&go(r.id)},el('td',{text:day(r.createdAt)}),el('td',{},el('span',{class:'c-badge '+(r.status==='published'?'done':['failed'].includes(r.status)?'new':'contacting'),text:r.statusLabel})),el('td',{text:r.title}));rows.append(tr);}
  $('empty').hidden=d.reels.length>0;
 }catch(e){$('list-view').hidden=true;fail(e);}
}
async function create(body){try{notice('쇼릴을 준비하는 중입니다.');const d=await api('reels',{method:'POST',body:JSON.stringify(body)});go(d.id);}catch(e){fail(e);}}
const go=id=>{location.hash=id;};

// ---------- 상세 ----------
async function open(id){
 $('list-view').hidden=true;
 try{const d=await api('reels/'+id);S={...S,...d,dirty:false};notice('');render();}catch(e){$('detail-view').hidden=true;fail(e);}
}
function render(){
 const {reel,source,music,events,configured,copyKeys}=S;$('detail-view').hidden=false;
 $('d-title').textContent=reel.title;$('d-status').textContent=reel.statusLabel;$('d-blog').href=reel.url;
 $('d-error').hidden=!reel.error;$('d-error').textContent=reel.error?'오류: '+reel.error:'';
 const stage={new:0,planning:0,editing:1,failed:1,rendering:3,review:3,approved:4,scheduled:5,published:5,skipped:0}[reel.status]??0;
 [...$('steps').children].forEach((li,i)=>{li.className=i<stage?'done':i===stage?'now':'';});
 const locked=['rendering','approved','scheduled','published','planning'].includes(reel.status);
 const hasPlan=!!reel.plan?.scenes?.length;
 $('plan-btn').textContent=hasPlan?'AI 기획안 다시 만들기':'AI 기획안 만들기';$('plan-btn').disabled=locked||!configured.ai;
 if(!configured.ai)$('plan-help').textContent='AI 기획 연결(ANTHROPIC_API_KEY)이 필요합니다. 관리자에게 설정을 요청해 주세요.';
 if(reel.status==='planning')$('plan-help').textContent='기획안을 만드는 중입니다. 1~2분 뒤 새로고침해 주세요.';
 $('plan-area').hidden=!hasPlan;['narr-card','copy-card','music-card','save-bar','render-card'].forEach(x=>$(x).hidden=!hasPlan);
 if(hasPlan){
  $('theme').value=reel.plan.theme||'navy';
  const facts=reel.plan.facts||[];$('facts').hidden=!facts.length;$('facts').replaceChildren(el('b',{text:'확인이 필요한 내용'}),el('ul',{},...facts.map(f=>el('li',{text:f}))));
  const box=$('scenes');box.replaceChildren(...reel.plan.scenes.map((sc,i)=>sceneEditor(sc,i,source.images)));
  $('narration').value=(reel.plan.narration||[]).join('\n');countNarr();
  $('narr-file').textContent=reel.narration?.path?'올림 ('+day(reel.narration.uploadedAt)+')':'없음 (음악만으로도 만들 수 있어요)';
  const cp=$('copy');cp.replaceChildren();let group='';let sec;
  for(const [k,g,label,limit] of copyKeys){if(g!==group){group=g;sec=el('div',{class:'copy-group'},el('h3',{text:GROUP[g]||g}));cp.append(sec);}
   const ta=el('textarea',{'data-key':k,rows:k.endsWith('desc')||k.endsWith('caption')||k.endsWith('body')?6:2});ta.value=reel.copy?.[k]||'';
   const cnt=el('span');const upd=()=>{cnt.textContent=ta.value.length+(limit?' / '+limit:'')+'자';cnt.className=limit&&ta.value.length>limit?'over':'';};upd();ta.addEventListener('input',()=>{upd();dirty();});
   sec.append(el('div',{class:'copy-item'},el('label',{},el('span',{text:label}),cnt),ta));}
  const mu=$('music');mu.replaceChildren();
  if(!music.length)mu.append(el('p',{class:'muted',text:'등록된 곡이 없습니다. 아래 “곡 추가하기”로 먼저 추가해 주세요.'}));
  for(const m of music){const r=el('input',{type:'radio',name:'music',value:m.id});r.checked=reel.musicId===m.id;r.addEventListener('change',dirty);
   mu.append(el('label',{class:'music-item'},r,el('span',{},document.createTextNode(m.title+(m.artist?' · '+m.artist:'')),m.mood?el('small',{text:'  '+m.mood}):null),m.page_url?el('a',{href:m.page_url,target:'_blank',rel:'noopener',text:'Pixabay에서 듣기 ↗'}):null));}
 }
 [...document.querySelectorAll('#detail-view input,#detail-view textarea,#detail-view select')].forEach(x=>{if(!x.closest('#music-form')&&!x.closest('#approve-area'))x.disabled=locked;});
 $('save').disabled=locked;
 // 영상
 const rd=reel.render||{};
 $('render-btn').disabled=locked||!configured.github||!configured.agent;$('render-btn').textContent=rd.video?'저장하고 영상 다시 만들기':'저장하고 영상 만들기';
 $('render-help').textContent=reel.status==='rendering'?'영상을 만드는 중입니다('+day(rd.requestedAt)+' 요청). 5~10분 뒤 새로고침해 주세요.':'GitHub 렌더 서버가 5~10분 동안 영상과 썸네일을 만듭니다. 이 화면은 닫아도 됩니다.';
 $('preview').hidden=!rd.video;if(rd.video){$('video').src=rd.video;$('thumb').src=rd.thumb||'';}
 $('approve-area').hidden=reel.status!=='review';
 const sc=reel.schedule||{};$('schedule').hidden=!['approved','scheduled','published'].includes(reel.status);
 $('schedule').replaceChildren(el('h3',{text:reel.status==='approved'?'예약 대기 중':'예약 결과'}),el('p',{class:'muted',text:reel.status==='approved'?`승인 ${day(sc.approvedAt)} · ${sc.when==='now'?'바로':sc.when==='best'?'최적 시간':sc.when}. Claude가 1시간 안에 Metricool에 예약합니다.`:''}),
  el('ul',{},...(sc.posts||[]).map(p=>el('li',{text:`${p.network} · ${p.time||''} ${p.status||''}`})),...(sc.links||[]).map(l=>el('li',{},el('a',{href:l.url,target:'_blank',rel:'noopener',text:l.network+' 게시물 ↗'})))));
 $('reopen-btn').hidden=!(S.me?.role==='admin'&&['approved','failed','review','skipped'].includes(reel.status));
 $('skip-btn').hidden=['approved','scheduled','published','skipped'].includes(reel.status);
 $('events').replaceChildren(...events.map(e=>el('li',{text:`${day(e.created_at)} · ${e.name||'렌더 서버'} · ${e.action}${e.note?' · '+e.note:''}`})));
 $('save-state').textContent='';
}
function field(label,value,key,multi=false){const i=el(multi?'textarea':'input',{'data-f':key});i.value=value??'';i.addEventListener('input',dirty);return el('div',{},el('label',{text:label}),i);}
function rowsText(sc){
 if(sc.type==='ranking')return (sc.rows||[]).map(r=>[r.rank,r.name,r.tag,r.accent?'*':''].join('|')).join('\n');
 if(sc.type==='table')return (sc.rows||[]).map(r=>[r.name,r.value,r.accent?'*':''].join('|')).join('\n');
 if(sc.type==='compare')return (sc.rows||[]).map(r=>[r.label,r.value,(r.parts||[]).map(p=>p.label+':'+p.w).join(','),r.total,r.accent?'*':''].join('|')).join('\n');
 return '';
}
function sceneEditor(sc,i,imageCount){
 const box=el('div',{class:'scene','data-i':i,'data-type':sc.type},el('header',{},el('span',{text:`장면 ${i+1} · ${TYPE[sc.type]||sc.type}`}),el('small',{text:S.reel.plan.drop_scene===i?'★ 음악 드롭에 맞춤':''})));
 const add=(...x)=>x.forEach(y=>box.append(y));
 if(PHOTO_TYPES.includes(sc.type)){
  const photos=S.reel.plan.photos||[];const cur=Number.isInteger(sc.photo)?photos[sc.photo]?.index:null;
  const strip=el('div',{class:'r-photos'});
  const pick=idx=>{strip.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.idx===String(idx))));box.dataset.photo=idx===null?'':idx;dirty();};
  strip.append(el('button',{type:'button','data-idx':'null','aria-pressed':String(cur==null),onclick:()=>pick(null)},el('span',{class:'none',text:'사진 없음'})));
  for(let k=0;k<Math.min(imageCount,30);k++)strip.append(el('button',{type:'button','data-idx':k,'aria-pressed':String(cur===k),onclick:()=>pick(k)},el('img',{src:`/api/cms/reels/${S.reel.id}/photo/${k}`,loading:'lazy',alt:'블로그 사진 '+(k+1)})));
  box.dataset.photo=cur==null?'':cur;add(el('label',{text:'사진 (블로그에서 선택)'}),strip);
 }
 if(['hook_photo','photo_statement','question','big_number','cta'].includes(sc.type))add(field('윗줄',sc.kicker,'kicker'));
 if(['ranking','table','checklist','steps'].includes(sc.type)||sc.headline)add(field('큰 글씨 (*강조*, 줄바꿈 가능)',sc.headline,'headline',true));
 else add(field('큰 글씨 (*강조*, 줄바꿈 가능)',sc.headline,'headline',true));
 if(['ranking','compare','checklist'].includes(sc.type))add(field('표 제목',sc.title,'title'));
 if(sc.type==='big_number')add(field('숫자',sc.number,'number'),field('단위',sc.unit,'unit'),field('설명',sc.caption,'caption'));
 if(sc.type==='ranking')add(field('아래 문구',sc.caption,'caption'));
 if(['question','checklist'].includes(sc.type))add(field('항목 (한 줄에 하나)',(sc.items||[]).join('\n'),'items',true));
 if(sc.type==='steps')add(field('단계 (한 줄에 하나)',(sc.steps||[]).join('\n'),'steps',true));
 if(sc.type==='table')add(field('표 머리 (왼쪽|오른쪽)',(sc.head||[]).join('|'),'head'),field('도장 문구',sc.stamp,'stamp'));
 if(['ranking','table','compare'].includes(sc.type))add(field({ranking:'행: 순위|이름|태그|* (강조)',table:'행: 이름|값|* (강조)',compare:'행: 이름|숫자|부분:비율,부분:비율|합계|* (강조)'}[sc.type],rowsText(sc),'rows',true));
 if(sc.type==='cta')add(field('아랫줄',sc.sub,'sub'));
 else add(field('작은 글씨 (기준일·변경 가능 등)',sc.note,'note',true));
 return box;
}
function readPlan(){
 const p=structuredClone(S.reel.plan);p.theme=$('theme').value;const photos=[];
 p.scenes=[...document.querySelectorAll('#scenes .scene')].map(box=>{
  const old=p.scenes[Number(box.dataset.i)];const sc={type:old.type};const v=k=>box.querySelector(`[data-f="${k}"]`)?.value;
  for(const k of ['kicker','headline','title','number','unit','caption','sub','note','stamp']){const x=v(k);if(x!=null&&x.trim())sc[k]=x.trim();}
  const lines=k=>(v(k)||'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(v('items')!=null)sc.items=lines('items');if(v('steps')!=null)sc.steps=lines('steps');if(v('head')!=null)sc.head=v('head').split('|').map(x=>x.trim());
  if(v('rows')!=null)sc.rows=lines('rows').map(l=>{const a=l.split('|').map(x=>x.trim());const accent=a[a.length-1]==='*';
   if(old.type==='ranking')return {rank:a[0],name:a[1],tag:a[2],accent};
   if(old.type==='table')return {name:a[0],value:a[1],accent};
   return {label:a[0],value:Number(a[1])||1,parts:(a[2]||'').split(',').filter(Boolean).map(x=>{const [label,w]=x.split(':');return {label:label.trim(),w:Number(w)||1};}),total:a[3]||'',accent};});
  if(box.dataset.photo!==undefined&&box.dataset.photo!==''){const idx=Number(box.dataset.photo);const prev=(S.reel.plan.photos||[]).find(x=>x.index===idx);let k=photos.findIndex(x=>x.index===idx);if(k<0){photos.push({index:idx,pos:prev?.pos||'50% 50%',caption:prev?.caption||''});k=photos.length-1;}sc.photo=k;}
  return sc;});
 const thumbIdx=(S.reel.plan.photos||[])[S.reel.plan.thumbnail?.photo]?.index;
 p.photos=photos;if(thumbIdx!=null){let k=photos.findIndex(x=>x.index===thumbIdx);if(k<0){photos.push({index:thumbIdx,pos:'50% 50%',caption:''});k=photos.length-1;}p.thumbnail={...p.thumbnail,photo:k};}
 p.narration=$('narration').value.split('\n').map(x=>x.trim());
 return p;
}
function readCopy(){const c={};document.querySelectorAll('#copy textarea').forEach(t=>c[t.dataset.key]=t.value);return c;}
function dirty(){S.dirty=true;$('save-state').textContent='저장하지 않은 수정이 있습니다';}
function countNarr(){const lines=$('narration').value.split('\n');const n=S.reel?.plan?.scenes?.length||0;const chars=lines.join('').length;
 $('narr-count').textContent=`${lines.filter(x=>x.trim()).length}줄 / 장면 ${n}개 · ${chars}자 (약 ${Math.round(chars/8)}초)`+(lines.filter(x=>x.trim()).length!==n?' — 줄 수를 장면 수에 맞춰 주세요':'');}
async function save(){
 const musicId=document.querySelector('input[name=music]:checked')?.value||null;
 const d=await api('reels/'+S.reel.id,{method:'PUT',body:JSON.stringify({revision:S.reel.revision,plan:readPlan(),copy:readCopy(),musicId})});
 S.reel.revision=d.revision;S.dirty=false;$('save-state').textContent='저장했습니다';return d;
}
async function act(fn,msg){try{notice(msg||'처리 중입니다.');await fn();await open(S.reel.id);notice('');}catch(e){fail(e);}}

// ---------- 이벤트 ----------
$('url-form').addEventListener('submit',e=>{e.preventDefault();create({url:$('url-input').value});});
$('plan-btn').addEventListener('click',()=>{if(S.reel.plan?.scenes?.length&&!confirm('지금 기획안과 문구를 새로 만든 것으로 바꿉니다. 계속할까요?'))return;act(()=>api('reels/'+S.reel.id+'/plan',{method:'POST',body:'{}'}),'AI가 기획안을 만드는 중입니다. 1~2분 걸립니다.');});
$('theme').addEventListener('change',dirty);
$('narration').addEventListener('input',()=>{countNarr();dirty();});
$('save').addEventListener('click',()=>act(save,'저장하는 중입니다.'));
$('narr-upload').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;act(()=>api('reels/'+S.reel.id+'/narration',{method:'POST',body:f,type:'audio/mpeg'}),'내레이션 파일을 올리는 중입니다.');});
$('render-btn').addEventListener('click',()=>act(async()=>{await save();await api('reels/'+S.reel.id+'/render',{method:'POST',body:'{}'});},'영상 만들기를 요청하는 중입니다.'));
$('when').addEventListener('change',()=>{$('when-at').hidden=$('when').value!=='at';});
$('approve-btn').addEventListener('click',()=>{const w=$('when').value==='at'?$('when-at').value:$('when').value;if(!w){notice('예약 시간을 입력해 주세요.',true);return;}
 if(!confirm('이 영상과 문구로 4개 채널 예약을 진행합니다. 승인할까요?'))return;act(()=>api('reels/'+S.reel.id+'/approve',{method:'POST',body:JSON.stringify({when:w})}),'승인하는 중입니다.');});
$('reopen-btn').addEventListener('click',()=>act(()=>api('reels/'+S.reel.id+'/reopen',{method:'POST',body:'{}'})));
$('skip-btn').addEventListener('click',()=>{if(confirm('이 글은 쇼릴로 만들지 않고 건너뜁니다.'))act(()=>api('reels/'+S.reel.id+'/skip',{method:'POST',body:'{}'}));});
$('music-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const q=new URLSearchParams({title:f.get('title'),artist:f.get('artist'),page:f.get('page'),mood:f.get('mood'),noShield:f.get('noShield')?'1':'0'});
 act(async()=>{if(S.dirty)await save();await api('reels/music/upload?'+q,{method:'POST',body:f.get('file'),type:'audio/mpeg'});e.target.reset();},'곡을 올리는 중입니다.');});
window.addEventListener('beforeunload',e=>{if(S.dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',route);
function route(){const id=location.hash.slice(1);if(id)open(id);else list();}
api('me').then(d=>{S.me=d.user;$('account-name').textContent=d.user.name;}).catch(()=>{});
route();
})();
