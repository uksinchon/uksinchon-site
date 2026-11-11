import {validYouTubeId} from '../../assets/youtube.js';
export const CATEGORY_DEFINITIONS = [
  ['english','어학연수'], ['undergraduate','대학·파운데이션'], ['postgraduate','석사·대학원'],
  ['costs','비용·장학금'], ['preparation','유학 준비·생활'], ['stories','상담 사례·소식']
].map(([code,label])=>({code,label}));
export const CATEGORIES = CATEGORY_DEFINITIONS.map(c=>c.label);
export const CONTENT_TYPES = ['news','guide','comparison','case'];
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const todayKorea = () => new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const text = (value,max) => String(value??'').trim().slice(0,max);
export function safeLink(value) {
  if(typeof value!=='string'||value.length>2000)return null;
  try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
function dateOnly(value,label,{past=false}={}) {
  value=String(value||'');if(!value)return '';
  const date=new Date(value+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||(past&&value>todayKorea()))throw new Error(label+'을 올바른 날짜로 입력해 주세요.'+(past?' 미래 날짜는 사용할 수 없습니다.':''));
  return value;
}
export function cleanTable(value) {
  if(!value||typeof value!=='object'||!Array.isArray(value.columns)||!Array.isArray(value.rows))throw new Error('표의 열과 행을 확인해 주세요.');
  const caption=text(value.caption,200),columns=value.columns.map(x=>text(x,100));
  if(!caption||columns.length<2||columns.length>8||columns.some(x=>!x)||value.rows.length<1||value.rows.length>50)throw new Error('표 제목, 2~8개 열 제목, 1~50개 행을 입력해 주세요.');
  const rows=value.rows.map(row=>{if(!Array.isArray(row)||row.length!==columns.length)throw new Error('표의 열 개수를 맞춰 주세요.');return row.map(x=>text(x,800));});
  const source=text(value.source,2000);if(source&&!safeLink(source))throw new Error('표의 출처 주소를 확인해 주세요.');
  return {caption,columns,rows,source:source?safeLink(source):'',notes:text(value.notes,1500)};
}
function opText(op) {
  if(typeof op.insert==='string')return op.insert;
  const t=op.insert?.comparisonTable;
  return t?[t.caption,...t.columns,...t.rows.flat(),t.notes].join(' '):' ';
}
export function cleanSnapshot(input,authorName) {
  if(input.schemaVersion!==undefined&&![1,2].includes(Number(input.schemaVersion)))throw new Error('지원하지 않는 원고 버전입니다. 최신 편집기에서 확인해 주세요.');
  const v2=Number(input.schemaVersion)===2,title=text(input.title,160);
  const definition=CATEGORY_DEFINITIONS.find(c=>c.label===input.category)||CATEGORY_DEFINITIONS.find(c=>c.code===input.categoryCode)||CATEGORY_DEFINITIONS[0];
  if(!input.delta||!Array.isArray(input.delta.ops)||input.delta.ops.length>4000)throw new Error('본문 형식을 확인해 주세요.');
  const ops=[];
  for(const op of input.delta.ops) {
    if(!op||typeof op!=='object')throw new Error('본문 형식을 확인해 주세요.');
    let insert;
    if(typeof op.insert==='string')insert=op.insert;
    else if(typeof op.insert?.image==='string'&&/^\/media\/[a-f0-9-]{36}$/.test(op.insert.image)&&UUID.test(op.insert.image.slice(7)))insert={image:op.insert.image};
    else if(validYouTubeId(op.insert?.youtube))insert={youtube:op.insert.youtube};
    else if(v2&&op.insert?.comparisonTable)insert={comparisonTable:cleanTable(op.insert.comparisonTable)};
    else throw new Error('사진·표는 편집기의 추가 버튼으로 등록해 주세요.');
    const attributes={},a=op.attributes||{};
    for(const k of ['bold','italic','underline','strike','blockquote'])if(a[k]===true)attributes[k]=true;
    if(['small','large','huge'].includes(a.size))attributes.size=a.size;
    if(['center','right'].includes(a.align))attributes.align=a.align;
    for(const key of ['color','background'])if(['#000000','#e60000','#ff9900','#ffff00','#008a00','#0066cc','#9933ff','#ffffff'].includes(a[key]))attributes[key]=a[key];
    if([2,3].includes(a.header))attributes.header=a.header;
    if(['ordered','bullet'].includes(a.list))attributes.list=a.list;
    if(a.link){const url=safeLink(a.link);if(url)attributes.link=url;}
    ops.push(typeof insert==='string'&&Object.keys(attributes).length?{insert,attributes}:{insert});
  }
  const plain=ops.map(opText).join('').trim();
  if(plain.length>60000)throw new Error('한 글의 본문은 표를 포함해 6만 자 이내로 작성해 주세요.');
  const paragraphText=ops.filter(op=>typeof op.insert==='string').map(op=>op.insert).join('').trim();
  const summary=text(input.summary,240)||(paragraphText||plain).replace(/\s+/g,' ').slice(0,150);
  let sources=String(input.sources||'').trim().split('\n').slice(0,15).map(line=>line.trim()).filter(Boolean);
  const verifiedAt=dateOnly(input.verifiedAt,'정보 확인일',{past:v2});
  const base={title,category:definition.label,summary,delta:{ops},sources:sources.join('\n').slice(0,15000),verifiedAt,authorName};
  if(!v2)return base;
  const sourceDetails=[];
  if(input.sourceDetails!==undefined&&!Array.isArray(input.sourceDetails))throw new Error('공식 자료 목록을 확인해 주세요.');
  for(const item of (input.sourceDetails||[]).slice(0,15)) {
    const raw=text(item?.url,2000);if(!raw&&!item?.title&&!item?.publisher)continue;
    const url=safeLink(raw)||raw;
    if(safeLink(url)&&sourceDetails.some(s=>s.url===url))continue;
    sourceDetails.push({url,title:text(item.title,200),publisher:text(item.publisher,100),kind:item.kind==='official'?'official':'reference'});
    if(safeLink(url)&&!sources.includes(url))sources.push(url);
  }
  if(sources.length>15)throw new Error('출처는 공식 자료를 포함해 15개 이내로 입력해 주세요.');
  const imageMeta={};
  for(const id of imageIds(base)) {
    const m=input.imageMeta?.[id]||{},source=text(m.source,2000);
    imageMeta[id]={alt:text(m.alt,300),caption:text(m.caption,600),rights:text(m.rights,300),source:source?(safeLink(source)||source):'',decorative:m.decorative===true};
    // API replaces dimensions with values derived from owned WebP bytes.
    if(Number.isInteger(m.width)&&m.width>0&&m.width<=16000&&Number.isInteger(m.height)&&m.height>0&&m.height<=16000)Object.assign(imageMeta[id],{width:m.width,height:m.height});
  }
  const heroImageId=text(input.heroImageId,36);if(heroImageId&&!imageMeta[heroImageId])throw new Error('대표 사진은 본문에 등록한 사진 중에서 선택해 주세요.');
  const relatedIds=[...new Set(Array.isArray(input.relatedIds)?input.relatedIds:[])];
  if(relatedIds.length>8||relatedIds.some(id=>typeof id!=='string'||!UUID.test(id)))throw new Error('함께 읽을 글은 신촌점 글 주소 8개 이내로 입력해 주세요.');
  const reviewDueAt=dateOnly(input.reviewDueAt,'다음 확인일');
  if(reviewDueAt&&verifiedAt&&reviewDueAt<verifiedAt)throw new Error('다음 확인일은 마지막 자료 확인일 이후로 정해 주세요.');
  return {...base,schemaVersion:2,categoryCode:definition.code,contentType:CONTENT_TYPES.includes(input.contentType)?input.contentType:'news',
    appliesTo:text(input.appliesTo,500),requiresFactCheck:input.requiresFactCheck===true,sourceDetails,sources:sources.join('\n'),
    reviewScope:text(input.reviewScope,1000),reviewDueAt,
    changeKind:input.changeKind==='minor'?'minor':'substantive',changeNote:text(input.changeNote,500),imageMeta,heroImageId,relatedIds};
}
export function imageIds(snapshot) {return [...new Set(snapshot.delta.ops.filter(op=>typeof op.insert?.image==='string').map(op=>op.insert.image.slice(7)))];}
export function textOf(snapshot) {return snapshot.delta.ops.map(opText).join('').trim();}
export function needsFactCheck(s) {return s.schemaVersion===2&&(s.requiresFactCheck||['guide','comparison'].includes(s.contentType));}
export function factReadiness(s) {
  if(!s.verifiedAt)return '실제로 자료를 확인한 날짜를 입력해 주세요.';
  if(!s.reviewScope)return '이번에 대조한 조건과 자료의 범위를 적어 주세요.';
  if(s.sourceDetails?.some(x=>!safeLink(x.url)))return '자료 주소를 완성하거나 사용하지 않는 자료 줄을 지워 주세요.';
  if(needsFactCheck(s)&&!s.appliesTo)return '적용 학년도·기간·대상을 입력해 주세요.';
  if(needsFactCheck(s)&&!s.sourceDetails?.some(x=>x.kind==='official'&&safeLink(x.url)))return '학교·기관의 공식 자료를 한 개 이상 등록해 주세요.';
  if(!s.sources)return '대조한 출처 주소를 등록해 주세요.';
  return '';
}
export function imageReadiness(s) {
  if(s.schemaVersion!==2)return '';
  for(const id of imageIds(s)) {
    const m=s.imageMeta?.[id];
    if(m?.source&&!safeLink(m.source))return '사진 출처의 웹 주소를 완성하거나 지워 주세요.';
  }
  if(s.heroImageId&&s.imageMeta[s.heroImageId]?.decorative)return '장식용 사진은 대표 사진으로 선택할 수 없습니다.';
  return '';
}
export function semanticContent(s) {
  const images=Object.fromEntries(Object.entries(s.imageMeta||{}).map(([id,m])=>[id,{alt:m.alt||'',caption:m.caption||'',source:m.source||'',decorative:!!m.decorative}]));
  return JSON.stringify([s.title,s.summary,s.category,s.delta,s.contentType||'news',s.appliesTo||'',s.sources,images,s.heroImageId||'']);
}
export function webpDimensions(buffer) {
  const b=new Uint8Array(buffer),word=(i,n)=>String.fromCharCode(...b.slice(i,i+n));
  if(b.length<20||word(0,4)!=='RIFF'||word(8,4)!=='WEBP')return null;
  const u16=i=>b[i]|b[i+1]<<8,u24=i=>b[i]|b[i+1]<<8|b[i+2]<<16;
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  for(let at=12;at+8<=b.length;) {
    const kind=word(at,4),size=view.getUint32(at+4,true),p=at+8;if(p+size>b.length)return null;
    let width,height;
    if(kind==='VP8X'&&size>=10){width=u24(p+4)+1;height=u24(p+7)+1;}
    if(kind==='VP8L'&&size>=5&&b[p]===47){width=1+((b[p+1]|b[p+2]<<8)&16383);height=1+((b[p+2]>>6|b[p+3]<<2|b[p+4]<<10)&16383);}
    if(kind==='VP8 '&&size>=10&&word(p+3,3)==='\x9d\x01\x2a'){width=u16(p+6)&16383;height=u16(p+8)&16383;}
    if(width&&height)return {width,height};
    at=p+size+(size%2);
  }
  return null;
}
export function renderTable(t) {
  return `<figure class="comparison-figure"><p class="table-hint">표가 넓으면 좌우로 밀어 확인해 주세요.</p><div class="table-scroll" role="region" aria-label="${esc(t.caption)}" tabindex="0"><table><caption>${esc(t.caption)}</caption><thead><tr>${t.columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')}</tr></thead><tbody>${t.rows.map(row=>'<tr>'+row.map((v,i)=>i?'<td>'+esc(v)+'</td>':'<th scope="row">'+esc(v)+'</th>').join('')+'</tr>').join('')}</tbody></table></div>${t.notes?'<figcaption>'+esc(t.notes)+'</figcaption>':''}${t.source?'<p class="table-source">표 출처: <a href="'+esc(t.source)+'">'+esc(t.source)+'</a></p>':''}</figure>`;
}
export function renderDelta(delta,imageMeta={},heroImageId='') {
  let html='',line='',list=null,pendingImage='';
  const closeList=()=>{if(list){html+=`</${list}>`;list=null;}};
  function endLine(a={}) {
    if(pendingImage){closeList();html+=pendingImage.replace('article-image','article-image'+(['center','right'].includes(a.align)?' ql-align-'+a.align:''));pendingImage='';}
    if(!line&&!a.list){closeList();return;}
    if(a.list){const kind=a.list==='ordered'?'ol':'ul';if(list!==kind){closeList();html+=`<${kind}>`;list=kind;}html+=`<li${['center','right'].includes(a.align)?' class="ql-align-'+a.align+'"':''}>${line||'<br>'}</li>`;}
    else{closeList();const tag=a.header?'h'+a.header:a.blockquote?'blockquote':'p';html+=`<${tag}${['center','right'].includes(a.align)?' class="ql-align-'+a.align+'"':''}>${line||'<br>'}</${tag}>`;}
    line='';
  }
  for(const op of delta.ops) {
    const a=op.attributes||{};
    if(typeof op.insert?.image==='string') {
      if(line||pendingImage)endLine();closeList();const id=op.insert.image.slice(7),m=imageMeta[id]||{},hero=id===heroImageId;
      const dimensions=m.width&&m.height?` width="${Number(m.width)}" height="${Number(m.height)}"`:'';
      pendingImage=`<figure class="article-image"><img src="${esc(op.insert.image)}" alt="${esc(m.decorative?'':m.alt||'')}"${dimensions}${hero?' fetchpriority="high"':' loading="lazy"'} decoding="async">${m.caption?'<figcaption>'+esc(m.caption)+'</figcaption>':''}${safeLink(m.source)?'<p class="image-source"><a href="'+esc(m.source)+'" rel="noopener noreferrer">사진 출처</a></p>':''}</figure>`;continue;
    }
    if(validYouTubeId(op.insert?.youtube)){if(line||pendingImage)endLine();closeList();html+=`<figure class="youtube-video"><iframe src="https://www.youtube-nocookie.com/embed/${op.insert.youtube}" title="YouTube 영상" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></figure>`;continue;}
    if(op.insert?.comparisonTable){if(line||pendingImage)endLine();closeList();html+=renderTable(op.insert.comparisonTable);continue;}
    if(typeof op.insert!=='string')continue;
    const parts=op.insert.split('\n');
    parts.forEach((part,i)=>{
      let value=esc(part);if(a.bold)value=`<strong>${value}</strong>`;if(a.italic)value=`<em>${value}</em>`;if(a.underline)value=`<u>${value}</u>`;
      if(a.strike)value=`<s>${value}</s>`;
      const classes=[];if(['small','large','huge'].includes(a.size))classes.push('ql-size-'+a.size);
      for(const key of ['color','background'])if(['#000000','#e60000','#ff9900','#ffff00','#008a00','#0066cc','#9933ff','#ffffff'].includes(a[key]))classes.push('ql-'+(key==='background'?'bg':key)+'-'+a[key]);
      if(classes.length)value=`<span class="${classes.join(' ')}">${value}</span>`;
      if(a.link&&safeLink(a.link))value=`<a href="${esc(a.link)}" rel="noopener noreferrer">${value}</a>`;
      line+=value;if(i<parts.length-1)endLine(a);
    });
  }
  if(line||pendingImage)endLine();closeList();return html;
}
