(()=>{
const $=id=>document.getElementById(id);
const LABEL={new:'신규',contacting:'상담중',done:'완료',spam:'스팸'};
const state={status:'',q:'',page:1,current:null};
const notice=(text,error=false)=>{$('notice').textContent=text;$('notice').classList.toggle('error',error);};
async function api(path,options={}){
 const r=await fetch('/api/cms/'+path,{credentials:'same-origin',...options,headers:options.body?{'Content-Type':'application/json'}:{}});
 let data={};try{data=await r.json();}catch{}
 if(!r.ok)throw Object.assign(new Error(data.error||'처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),{status:r.status});
 return data;
}
const when=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
const short=iso=>{const d=new Date(iso);if(isNaN(d))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.month}/${p.day} ${p.hour}:${p.minute}`;};
function cell(tr,text){const td=document.createElement('td');td.textContent=text||'';tr.append(td);return td;}
async function load(){
 const params=new URLSearchParams({page:state.page});if(state.status)params.set('status',state.status);if(state.q)params.set('q',state.q);
 try{
  const data=await api('counsel?'+params);
  notice('');$('board').hidden=false;
  const rows=$('rows');rows.replaceChildren();
  for(const item of data.items){
   const tr=document.createElement('tr');tr.tabIndex=0;if(item.status==='new')tr.className='is-new';
   cell(tr,short(item.created_at));
   const badge=document.createElement('span');badge.className='c-badge '+item.status;badge.textContent=LABEL[item.status];cell(tr,'').append(badge);
   const name=cell(tr,item.name);if(item.has_memo){const m=document.createElement('span');m.className='c-memo';m.textContent='메모';name.append(m);}
   cell(tr,item.interest);cell(tr,item.phone);cell(tr,item.email);
   tr.addEventListener('click',()=>open(item.id));tr.addEventListener('keydown',e=>{if(e.key==='Enter')open(item.id);});
   rows.append(tr);
  }
  $('empty').hidden=data.items.length>0;
  const c=data.counts||{};const all=(c.new||0)+(c.contacting||0)+(c.done||0);
  document.querySelector('[data-count=all]').textContent=all;for(const k of Object.keys(LABEL))document.querySelector(`[data-count=${k}]`).textContent=c[k]||0;
  $('prev').disabled=state.page<=1;$('next').disabled=!data.hasMore;$('page-label').textContent=state.page+'쪽';
 }catch(e){
  $('board').hidden=true;
  if(e.status===401)notice('로그인이 필요합니다. 글쓰기 관리 화면에서 로그인한 뒤 다시 들어와 주세요.',true);
  else if(e.status===403)notice(e.message+' 상담신청 게시판은 관리자 계정으로만 볼 수 있습니다.',true);
  else notice(e.message,true);
 }
}
async function open(id){
 try{
  const {item}=await api('counsel/'+id);state.current=item;
  $('detail-title').textContent=item.name+' 님의 상담신청';
  $('detail-meta').textContent='접수 '+when(item.created_at)+(item.updated_at?` · 마지막 수정 ${when(item.updated_at)} ${item.updated_by_name||''}`:'');
  const dl=$('detail-fields');dl.replaceChildren();
  const f=Object.fromEntries(item.fields);const TIME=['상담일','상담_AMPM','상담_시','상담_분'];
  const shown=[];
  for(const [k,v] of item.fields){
   if(TIME.includes(k)){if(k==='상담일'||!shown.some(x=>x[0]==='희망 상담일시'))shown.push(['희망 상담일시',[f['상담일'],f['상담_AMPM'],f['상담_시']&&f['상담_시']+'시',f['상담_분']&&f['상담_분']+'분'].filter(Boolean).join(' ')]);continue;}
   shown.push([k==='개인정보동의'?'개인정보 수집 동의':k,k==='개인정보동의'&&v==='on'?'동의함':v]);
  }
  for(const [k,v] of shown){const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;dl.append(dt,dd);}
  $('detail-status').value=item.status;$('detail-memo').value=item.memo||'';$('detail-saved').textContent='';
  $('detail').showModal();
 }catch(e){notice(e.message,true);}
}
$('save').addEventListener('click',async()=>{
 const item=state.current;if(!item)return;$('save').disabled=true;
 try{const r=await api('counsel/'+item.id,{method:'PUT',body:JSON.stringify({status:$('detail-status').value,memo:$('detail-memo').value})});
  $('detail-saved').textContent='저장했습니다 · '+when(r.updated_at)+' '+r.updated_by_name;load();}
 catch(e){$('detail-saved').textContent=e.message;}finally{$('save').disabled=false;}
});
$('delete').addEventListener('click',async()=>{
 const item=state.current;if(!item)return;
 if(!confirm(item.name+' 님의 신청서를 삭제할까요? 삭제하면 되돌릴 수 없습니다. (메일로 받은 사본은 남아 있습니다.)'))return;
 try{await api('counsel/'+item.id,{method:'POST',body:JSON.stringify({action:'delete'})});$('detail').close();load();}
 catch(e){$('detail-saved').textContent=e.message;}
});
$('close').addEventListener('click',()=>$('detail').close());
for(const b of document.querySelectorAll('[data-status]'))b.addEventListener('click',()=>{
 state.status=b.dataset.status;state.page=1;for(const x of document.querySelectorAll('[data-status]'))x.setAttribute('aria-pressed',String(x===b));load();
});
$('search-form').addEventListener('submit',e=>{e.preventDefault();state.q=$('search').value.trim();state.page=1;load();});
$('prev').addEventListener('click',()=>{state.page--;load();});$('next').addEventListener('click',()=>{state.page++;load();});
api('me').then(d=>{$('account-name').textContent=d.user.name;}).catch(()=>{});
load();
})();
