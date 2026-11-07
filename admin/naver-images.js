/* Authenticated source images -> bounded local WebP -> private post media. */
(()=>{'use strict';
const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
let hooks,context,images=[],page=0,selected=new Set(),cache=new Map(),busy=false,generation=0,controller;
const dialog=()=> $('naver-images-dialog');
const samePost=()=>hooks.context().postId===context.postId&&hooks.context().item?.id===context.item.id;
function stop(){generation++;controller?.abort();controller=null;}
function clear(){for(const entry of cache.values())URL.revokeObjectURL(entry.preview);cache.clear();}
function imagePath(item){return 'naver/items/'+context.item.id+'/images/'+item.index+'?'+new URLSearchParams({sourceHash:context.item.source_hash,key:item.key});}
async function load(item,signal){
 if(cache.has(item.index))return cache.get(item.index);
 const r=await fetch('/api/cms/'+imagePath(item),{credentials:'same-origin',cache:'no-store',signal});
 if(!r.ok){let data;try{data=await r.json();}catch{}throw new Error(data?.error||'사진을 내려받지 못했습니다.');}
 const blob=await hooks.convert(await r.blob());if(signal.aborted)throw new DOMException('취소됨','AbortError');
 const entry={blob,preview:URL.createObjectURL(blob)};cache.set(item.index,entry);return entry;
}
function controls(){
 $('naver-images-count').textContent=selected.size+'개 선택 · 한 번에 최대 12개';
 $('naver-images-insert').disabled=busy||!selected.size;
 $('naver-images-close').disabled=busy;$('naver-images-prev').disabled=busy||page===0;$('naver-images-next').disabled=busy||(page+1)*12>=images.length;$('naver-images-all').disabled=busy;
 $('naver-images-rights').disabled=busy;
 for(const input of $('naver-images-grid').querySelectorAll('input'))input.disabled=busy||input.dataset.locked==='true';
}
async function previews(rows,version,signal){
 for(const {item,picture,status} of rows){
  if(version!==generation||signal.aborted)return;
  try{const entry=await load(item,signal);if(version!==generation)return;picture.src=entry.preview;picture.hidden=false;status.textContent='';}
  catch(e){if(signal.aborted||version!==generation)return;status.textContent=e.message;}
 }
}
function render(){
 stop();const version=generation;controller=new AbortController();const root=$('naver-images-grid');root.replaceChildren();const rows=[],existing=hooks.context().existing;
 const visible=images.slice(page*12,page*12+12),keep=new Set([...visible.map(x=>x.index),...selected]);
 for(const [index,entry] of cache){if(!keep.has(index)){URL.revokeObjectURL(entry.preview);cache.delete(index);}}
 for(const item of visible){
  const box=node('div');box.className='naver-image-choice';const label=node('label'),check=node('input');check.type='checkbox';check.dataset.index=item.index;check.setAttribute('aria-label','원문 사진 '+(item.index+1)+' 선택');
  const present=existing.has(item.url);if(present)selected.delete(item.index);check.disabled=!item.available||present;check.dataset.locked=String(check.disabled);check.checked=selected.has(item.index);label.append(check,node('span','사진 '+(item.index+1)+(present?' · 이미 추가됨':'')));
  check.addEventListener('change',()=>{if(check.checked&&selected.size>=12){check.checked=false;$('naver-images-result').textContent='한 번에 12개까지 골라 주세요.';return;}if(check.checked)selected.add(item.index);else selected.delete(item.index);controls();});
  const picture=node('img');picture.alt='원문 사진 '+(item.index+1)+' 미리보기';picture.hidden=true;const status=node('p',item.available?'사진을 읽고 있습니다.':'외부 사이트 사진 · 직접 추가해 주세요.');status.className='muted';box.append(label,picture,status);root.append(box);
  if(item.available)rows.push({item,picture,status});
 }
 $('naver-images-page').textContent=(page+1)+' / '+Math.max(1,Math.ceil(images.length/12))+'쪽';controls();previews(rows,version,controller.signal);
}
async function open(){
 try{
  await hooks.save();context=hooks.context();if(!context.postId||!context.item)throw new Error('네이버에서 가져온 초안에서 사진을 추가해 주세요.');context.position=hooks.position();
  stop();clear();selected=new Set();images=[];page=0;busy=false;$('naver-images-rights').value='';$('naver-images-grid').replaceChildren();$('naver-images-result').textContent='원문의 사진 목록을 읽고 있습니다.';controls();dialog().showModal();const version=generation;
  const data=await hooks.api('naver/items/'+context.item.id+'/images?'+new URLSearchParams({sourceHash:context.item.source_hash}));
  if(version!==generation||!dialog().open)return;if(!samePost())throw new Error('글이 바뀌었습니다. 사진 선택 화면을 다시 열어 주세요.');images=data.images;$('naver-images-result').textContent=images.length?'사용할 사진을 골라 주세요.':'원문에서 가져올 사진을 찾지 못했습니다.';render();
 }catch(e){hooks.notify(e.message,true);$('naver-images-result').textContent=e.message;}
}
async function insert(){
 if(busy||!selected.size)return;busy=true;stop();controller=new AbortController();controls();let inserted=0,skipped=0;const failures=[];
 try{
  if(!samePost())throw new Error('원래 글에서 다시 사진을 가져와 주세요.');await hooks.save();
  let position=context.position;const rights=$('naver-images-rights').value.trim();
  for(const index of [...selected].sort((a,b)=>a-b)){
   const item=images.find(x=>x.index===index);if(!item)continue;
   if(hooks.context().existing.has(item.url)){selected.delete(index);skipped++;continue;}
   $('naver-images-result').textContent='사진 '+(index+1)+' 가져오는 중…';
   let entry;try{entry=await load(item,controller.signal);}catch(e){failures.push('사진 '+(index+1)+': '+e.message);continue;}
   try{position=await hooks.insert({blob:entry.blob,source:item.url,rights,postId:context.postId,position});context.position=position;selected.delete(index);inserted++;}
   catch(e){if(Number.isInteger(e.imagePosition))context.position=e.imagePosition;failures.push('사진 '+(index+1)+': '+e.message);break;}
  }
  const result='추가 '+inserted+'개 · 이미 추가됨 '+skipped+'개'+(failures.length?' / '+failures.join(' / '):'. 사진 설명과 사용 근거를 확인해 주세요.');$('naver-images-result').textContent=result;hooks.notify(result,!!failures.length);
 }catch(e){$('naver-images-result').textContent=e.message;hooks.notify(e.message,true);}
 finally{busy=false;if(dialog().open)render();controls();}
}
window.UK_NAVER_IMAGES={install(options){
 hooks=options;$('naver-import-images').addEventListener('click',open);$('naver-images-insert').addEventListener('click',insert);
 $('naver-images-close').addEventListener('click',()=>dialog().close());dialog().addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog().addEventListener('close',()=>{stop();clear();$('naver-images-grid').replaceChildren();});
 $('naver-images-prev').addEventListener('click',()=>{if(page>0){page--;render();}});$('naver-images-next').addEventListener('click',()=>{if((page+1)*12<images.length){page++;render();}});
 $('naver-images-all').addEventListener('click',()=>{const existing=hooks.context().existing;for(const item of images.slice(page*12,page*12+12)){if(selected.size>=12)break;if(item.available&&!existing.has(item.url))selected.add(item.index);}render();});
}};
})();
