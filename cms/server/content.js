export const CATEGORIES = ['어학연수','대학·파운데이션','석사·대학원','비용·장학금','유학 준비·생활','상담 사례·소식'];
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeLink(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;} catch {return null;}
}
export function cleanSnapshot(input, authorName) {
  const title=String(input.title||'').trim().slice(0,160);
  const category=CATEGORIES.includes(input.category)?input.category:CATEGORIES[0];
  if (!input.delta || !Array.isArray(input.delta.ops) || input.delta.ops.length>4000) throw new Error('본문 형식을 확인해 주세요.');
  const ops=[];let length=0;
  for (const op of input.delta.ops) {
    if (!op || typeof op!=='object') throw new Error('본문 형식을 확인해 주세요.');
    let insert;
    if (typeof op.insert==='string') {insert=op.insert;length+=insert.length;}
    else if (op.insert && typeof op.insert.image==='string' && /^\/media\/[a-f0-9-]{36}$/.test(op.insert.image)) insert={image:op.insert.image};
    else throw new Error('사진은 ‘사진 추가’ 버튼으로 등록해 주세요.');
    const attributes={};const a=op.attributes||{};
    for(const k of ['bold','italic','underline','blockquote']) if(a[k]===true) attributes[k]=true;
    if ([2,3].includes(a.header)) attributes.header=a.header;
    if (['ordered','bullet'].includes(a.list)) attributes.list=a.list;
    if (a.link) {const url=safeLink(a.link);if(url) attributes.link=url;}
    ops.push(Object.keys(attributes).length?{insert,attributes}:{insert});
  }
  if(length>60000) throw new Error('한 글의 본문은 6만 자 이내로 작성해 주세요.');
  const plain=ops.map(op=>typeof op.insert==='string'?op.insert:' ').join('').trim();
  const summary=String(input.summary||'').trim().slice(0,240)||plain.replace(/\s+/g,' ').slice(0,150);
  const sources=String(input.sources||'').trim().split(/\n/).slice(0,15).map(line=>line.trim()).join('\n').slice(0,15000);
  const verifiedAt=String(input.verifiedAt||'');
  if(verifiedAt){const date=new Date(verifiedAt+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==verifiedAt)throw new Error('정보 확인일을 올바른 날짜로 입력해 주세요.');}
  return {title,category,summary,delta:{ops},sources,verifiedAt,authorName};
}
export function imageIds(snapshot) {return [...new Set(snapshot.delta.ops.filter(op=>typeof op.insert==='object').map(op=>op.insert.image.split('/').pop()))];}
export function renderDelta(delta) {
  let html='',line='',list=null;
  const closeList=()=>{if(list){html+=`</${list}>`;list=null;}};
  function endLine(a={}) {
    if(a.list){const kind=a.list==='ordered'?'ol':'ul';if(list!==kind){closeList();html+=`<${kind}>`;list=kind;}html+=`<li>${line||'<br>'}</li>`;}
    else {closeList();const tag=a.header?'h'+a.header:a.blockquote?'blockquote':'p';html+=`<${tag}>${line||'<br>'}</${tag}>`;}
    line='';
  }
  for(const op of delta.ops) {
    const a=op.attributes||{};
    if(typeof op.insert==='object') {line+=`<img src="${esc(op.insert.image)}" alt="본문 사진" loading="lazy" decoding="async">`;continue;}
    const parts=op.insert.split('\n');
    parts.forEach((part,i)=>{
      let text=esc(part);if(a.bold)text=`<strong>${text}</strong>`;if(a.italic)text=`<em>${text}</em>`;if(a.underline)text=`<u>${text}</u>`;
      if(a.link&&safeLink(a.link))text=`<a href="${esc(a.link)}" rel="noopener noreferrer">${text}</a>`;
      line+=text;if(i<parts.length-1)endLine(a);
    });
  }
  if(line)endLine();closeList();return html;
}
export function textOf(snapshot) {return snapshot.delta.ops.map(op=>typeof op.insert==='string'?op.insert:' ').join('').trim();}
