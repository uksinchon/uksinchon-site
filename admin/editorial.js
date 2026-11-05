/* Versioned editorial fields and safe table embeds. Loaded before editor.js. */
(()=>{'use strict';
const $=id=>document.getElementById(id),node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
let quill,changed,notify,imageMeta={},hero='',tableIndex=null,newIndex=0,installed=false,lastDirty=false;
const idOf=url=>url.match(/^\/media\/([a-f0-9-]{36})$/)?.[1];
const imageIds=()=>[...new Set((quill?.getContents().ops||[]).map(op=>typeof op.insert?.image==='string'?idOf(op.insert.image):null).filter(Boolean))];
class ComparisonTable extends Quill.import('blots/block/embed') {
 static blotName='comparisonTable';static tagName='figure';static className='comparison-table-blot';
 static create(value){
  const n=super.create();n.dataset.table=JSON.stringify(value);n.setAttribute('contenteditable','false');n.setAttribute('role','group');n.setAttribute('aria-label','비교 표');
  n.append(node('strong',value.caption));const table=node('table'),thead=node('thead'),head=node('tr');
  for(const column of value.columns)head.append(node('th',column));thead.append(head);table.append(thead);const body=node('tbody');
  for(const row of value.rows.slice(0,3)){const tr=node('tr');for(const cell of row)tr.append(node('td',cell));body.append(tr);}table.append(body);n.append(table);
  if(value.rows.length>3)n.append(node('p','외 '+(value.rows.length-3)+'개 행'));
  const button=node('button','표 수정');button.type='button';button.setAttribute('aria-label',value.caption+' 표 수정');n.append(button);return n;
 }
 static value(n){return JSON.parse(n.dataset.table);}
}
Quill.register(ComparisonTable,true);
function field(label,value,options={}) {
 const wrap=node('label',label),input=node(options.multiline?'textarea':'input');input.value=value||'';input.maxLength=options.max||500;
 if(options.multiline)input.rows=2;else input.type=options.type||'text';
 input.addEventListener('input',()=>options.onInput(input.value));wrap.append(input);return wrap;
}
function addSource(item={}) {
 if($('source-details').children.length>=15){notify('자료는 최대 15개까지 추가할 수 있습니다.',true);return;}
 const row=node('div');row.className='source-detail';
 const title=node('input');title.placeholder='자료 제목';title.setAttribute('aria-label','자료 제목');title.value=item.title||'';title.maxLength=200;title.dataset.field='title';
 const url=node('input');url.type='url';url.placeholder='https://학교·기관의 자료 주소';url.setAttribute('aria-label','자료 주소');url.value=item.url||'';url.maxLength=2000;url.dataset.field='url';
 const publisher=node('input');publisher.placeholder='발행 학교·기관';publisher.setAttribute('aria-label','자료 발행 기관');publisher.value=item.publisher||'';publisher.maxLength=100;publisher.dataset.field='publisher';
 const kind=node('select');kind.setAttribute('aria-label','자료 구분');kind.dataset.field='kind';for(const [value,label] of [['official','학교·기관 공식 자료'],['reference','원문·참고 자료']]){const option=node('option',label);option.value=value;kind.append(option);}kind.value=item.kind||'official';
 const remove=node('button','이 자료 삭제');remove.type='button';remove.addEventListener('click',()=>{row.remove();changed();});
 for(const input of [title,url,publisher,kind])input.addEventListener('input',()=>changed());row.append(title,url,publisher,kind,remove);$('source-details').append(row);
}
function typeHelp() {
 const type=$('content-type').value,mandatory=['guide','comparison'].includes(type);
 $('requires-fact-check').disabled=mandatory;if(mandatory)$('requires-fact-check').checked=true;
 $('content-type-help').textContent=type==='comparison'?'비교 기준과 단위·기간을 표로 정리하고 공식 조건을 확인합니다.':type==='guide'?'지원 대상과 적용 학년도·예외를 공식 자료로 확인합니다.':type==='case'?'실제 경험과 일반 조건을 구분하고 사례·사진 공개 범위를 확인합니다.':'새 소식과 독자에게 필요한 다음 행동을 적어 주세요.';
 if(mandatory)$('evidence-details').open=true;
}
function syncImages() {
 if(!quill)return;const ids=imageIds(),key=ids.join(',');
 $('image-metadata-panel').hidden=!ids.length;
 if($('image-metadata-list').dataset.ids!==key){
  $('image-metadata-list').dataset.ids=key;$('image-metadata-list').replaceChildren();
  ids.forEach((id,i)=>{
   const m=imageMeta[id]||(imageMeta[id]={}),box=node('div');box.className='image-detail';box.append(node('h3','사진 '+(i+1)));
   const picture=node('img');picture.src='/media/'+id;picture.alt='등록 사진 '+(i+1)+' 확인';picture.loading='lazy';box.append(picture);
   box.append(field('독자에게 전달할 사진 설명',m.alt,{max:300,onInput:value=>{m.alt=value;changed();}}));
   box.append(field('사진 아래에 보일 설명 · 선택',m.caption,{multiline:true,max:600,onInput:value=>{m.caption=value;changed();}}));
   box.append(field('사용 근거 · 예: 직접 촬영, 학교의 사용 허락',m.rights,{max:300,onInput:value=>{m.rights=value;changed();}}));
   box.append(field('사진 출처 주소 · 선택',m.source,{type:'url',max:2000,onInput:value=>{m.source=value;changed();}}));
   const label=node('label','정보 전달이 없는 장식용 사진입니다 ');label.className='check-label';const check=node('input');check.type='checkbox';check.checked=!!m.decorative;check.addEventListener('change',()=>{m.decorative=check.checked;if(m.decorative&&hero===id)hero='';fillHero();changed();});label.prepend(check);box.append(label);$('image-metadata-list').append(box);
  });
 }
 fillHero();
}
function fillHero(){
 const ids=imageIds(),select=$('hero-image');select.replaceChildren();const blank=node('option','선택하지 않음');blank.value='';select.append(blank);
 ids.forEach((id,i)=>{if(imageMeta[id]?.decorative)return;const option=node('option','사진 '+(i+1));option.value=id;select.append(option);});if(!ids.includes(hero))hero='';select.value=hero;
}
function openTable(value=null,index=null){
 tableIndex=index;newIndex=quill.getSelection()?.index??quill.getLength()-1;
 $('table-caption').value=value?.caption||'';$('table-columns').value=value?.columns.join('\n')||'';$('table-rows').value=value?.rows.map(row=>row.join('\t')).join('\n')||'';$('table-source').value=value?.source||'';$('table-notes').value=value?.notes||'';$('table-error').textContent='';$('table-remove').hidden=index===null;$('table-dialog').showModal();$('table-caption').focus();
}
function tableValue(){
 const caption=$('table-caption').value.trim(),columns=$('table-columns').value.split('\n').map(x=>x.trim()).filter(Boolean),rows=$('table-rows').value.trimEnd().split('\n').map(line=>line.split('\t').map(x=>x.trim())),source=$('table-source').value.trim();
 if(!caption||columns.length<2||columns.length>8||rows.length<1||rows.length>50||rows.some(row=>row.length!==columns.length))throw new Error('표 제목, 2~8개 열, 1~50개 행을 확인해 주세요. 행의 칸은 탭으로 구분합니다.');
 if(columns.some(x=>x.length>100)||rows.some(row=>row.some(x=>x.length>800)))throw new Error('열 제목은 100자, 한 칸은 800자 이내로 줄여 주세요.');
 if(source){const u=new URL(source);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('표 출처의 웹 주소를 확인해 주세요.');}
 return {caption,columns,rows,source,notes:$('table-notes').value.trim()};
}
function relatedIds(){
 const lines=$('related-links').value.split('\n').map(x=>x.trim()).filter(Boolean),ids=[];
 for(const line of lines){let u;try{u=new URL(line,'https://uksinchon.com');}catch{throw new Error('함께 읽을 글의 주소를 완성해 주세요.');}
  const id=u.pathname.match(/^\/blog\/story-([a-f0-9-]{36})\/?$/)?.[1];if(!['uksinchon.com','www.uksinchon.com'].includes(u.hostname)||!id||u.username||u.password)throw new Error('함께 읽을 글에는 신촌점 블로그의 공개 글 주소를 넣어 주세요.');ids.push(id);
 }
 return [...new Set(ids)];
}
window.UK_EDITORIAL={
 install(q,onChanged,onNotice){
  quill=q;changed=onChanged;notify=onNotice;if(installed)return;installed=true;
  for(const id of ['applies-to','requires-fact-check','review-scope','review-due','related-links','change-kind','change-note'])$(id).addEventListener('input',()=>changed());
  $('content-type').addEventListener('change',()=>{typeHelp();changed();});$('hero-image').addEventListener('change',()=>{hero=$('hero-image').value;changed();});
  $('add-source').addEventListener('click',()=>{addSource();changed();});$('add-table').addEventListener('click',()=>openTable());
  $('rich-editor').addEventListener('click',event=>{const figure=event.target.closest('.comparison-table-blot');if(!figure||!event.target.closest('button'))return;const blot=Quill.find(figure);openTable(ComparisonTable.value(figure),quill.getIndex(blot));});
  $('table-cancel').addEventListener('click',()=>$('table-dialog').close());
  $('table-remove').addEventListener('click',()=>{if(tableIndex!==null)quill.deleteText(tableIndex,1,'user');$('table-dialog').close();});
  $('table-form').addEventListener('submit',event=>{event.preventDefault();try{const value=tableValue(),index=tableIndex??newIndex;if(tableIndex!==null)quill.deleteText(index,1,'user');quill.insertEmbed(index,'comparisonTable',value,'user');if(tableIndex===null)quill.insertText(index+1,'\n','user');$('table-dialog').close();quill.setSelection(index+1,0,'silent');}catch(e){$('table-error').textContent=e.message;}});
 },
 fill(s){
  imageMeta=structuredClone(s.imageMeta||{});hero=s.heroImageId||'';$('content-type').value=s.contentType||'news';$('applies-to').value=s.appliesTo||'';$('requires-fact-check').checked=!!s.requiresFactCheck;$('review-scope').value=s.reviewScope||'';$('review-due').value=s.reviewDueAt||'';$('related-links').value=(s.relatedIds||[]).map(id=>'https://uksinchon.com/blog/story-'+id+'/').join('\n');$('change-kind').value=s.changeKind||'substantive';$('change-note').value=s.changeNote||'';
  $('source-details').replaceChildren();for(const item of s.sourceDetails||[])addSource(item);
  const structured=new Set((s.sourceDetails||[]).map(item=>item.url));$('sources').value=(s.sources||'').split('\n').filter(url=>!structured.has(url)).join('\n');
  $('image-metadata-list').dataset.ids='';$('image-metadata-list').replaceChildren();$('evidence-details').open=false;typeHelp();syncImages();lastDirty=false;for(const key of ['facts','conditions','rights'])$('fact-check-'+key).checked=false;
 },
 snapshot(){
  const sourceDetails=[...$('source-details').children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value])));
  const visible={};for(const id of imageIds())visible[id]={...imageMeta[id]};
  return {schemaVersion:2,contentType:$('content-type').value,appliesTo:$('applies-to').value,requiresFactCheck:$('requires-fact-check').checked,sourceDetails,reviewScope:$('review-scope').value,reviewDueAt:$('review-due').value,changeKind:$('change-kind').value,changeNote:$('change-note').value,relatedIds:relatedIds(),heroImageId:hero,imageMeta:visible};
 },
 imageUploaded(data){imageMeta[data.id]={...imageMeta[data.id],width:data.width,height:data.height};},
 status({user,post,dirty,revision,review,snapshot}){
  $('fact-review-panel').hidden=user.role!=='admin';
  if(dirty&&!lastDirty)for(const key of ['facts','conditions','rights'])$('fact-check-'+key).checked=false;
  lastDirty=dirty;
  const sealed=post.published_revision===revision?snapshot?.publication?.factCheck:null;
  $('fact-review-state').textContent=dirty?'변경한 내용을 저장한 뒤 사실 확인을 기록해 주세요.':review?.revision===revision?'현재 버전 확인 기록: '+review.name:sealed?'공개 승인본 확인 기록: '+sealed.reviewerName:'현재 버전의 사실 확인 기록이 없습니다. 필요한 글은 확인 후 공개해 주세요.';
 },
 checks(){return Object.fromEntries(['facts','conditions','rights'].map(key=>[key,$('fact-check-'+key).checked]));},
 syncImages
};
})();
