(()=>{
const $=id=>document.getElementById(id);
const notice=(t,e=false)=>{$('notice').textContent=t;$('notice').classList.toggle('error',e);};
async function api(path,options={}){
 const r=await fetch('/api/cms/'+path,{credentials:'same-origin',...options,headers:options.body?{'Content-Type':'application/json'}:{}});
 let d={};try{d=await r.json();}catch{}
 if(!r.ok)throw Object.assign(new Error(d.error||'처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),{status:r.status});
 return d;
}
const day=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'});};
async function load(){
 try{
  const data=await api('clips');notice('');$('board').hidden=false;$('channel').href=data.channel;
  const rows=$('rows');rows.replaceChildren();let shown=0;
  for(const v of data.videos){
   const tr=document.createElement('tr');tr.style.cursor='default';
   const onHome=!v.hidden&&shown<4;if(!v.hidden)shown++;
   const c1=document.createElement('td');c1.textContent=day(v.published);
   const c2=document.createElement('td');const a=document.createElement('a');a.href='https://www.youtube.com/shorts/'+v.id;a.target='_blank';a.rel='noopener noreferrer';a.textContent=v.title||v.id;c2.append(a);c2.style.whiteSpace='normal';
   const c3=document.createElement('td');const b=document.createElement('span');b.className='c-badge '+(v.hidden?'spam':onHome?'done':'contacting');b.textContent=v.hidden?'숨김':onHome?'메인에 표시 중':'대기 (최신 4개 밖)';c3.append(b);
   const c4=document.createElement('td');const btn=document.createElement('button');btn.type='button';btn.textContent=v.hidden?'다시 보이기':'숨기기';
   btn.addEventListener('click',async()=>{btn.disabled=true;try{await api('clips/'+v.id,{method:'POST',body:JSON.stringify({hidden:!v.hidden})});await load();}catch(e){notice(e.message,true);btn.disabled=false;}});
   c4.append(btn);tr.append(c1,c2,c3,c4);rows.append(tr);
  }
  $('empty').hidden=data.videos.length>0;
 }catch(e){
  $('board').hidden=true;
  notice(e.status===401?'로그인이 필요합니다. 글쓰기 관리 화면에서 로그인한 뒤 다시 들어와 주세요.':e.status===403?e.message+' 관리자 계정으로만 사용할 수 있습니다.':e.message,true);
 }
}
api('me').then(d=>{$('account-name').textContent=d.user.name;}).catch(()=>{});
load();
})();
