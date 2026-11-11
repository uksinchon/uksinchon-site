/* Image size is a bounded percentage in Delta, separate from intrinsic pixels. */
export function registerImageSize(Quill){
 const Base=Quill.import('formats/image');
 class ResizableImage extends Base{
  static formats(n){const f=super.formats(n),size=Number(n.dataset.imageWidth);if(Number.isInteger(size)&&size>=10&&size<=100)f.imageWidth=size;return f;}
  format(name,value){if(name!=='imageWidth')return super.format(name,value);for(const c of [...this.domNode.classList])if(/^image-width-\d+$/.test(c))this.domNode.classList.remove(c);const size=Number(value);if(Number.isInteger(size)&&size>=10&&size<=100){this.domNode.dataset.imageWidth=size;this.domNode.classList.add('image-width-'+size);}else delete this.domNode.dataset.imageWidth;}
 }
 Quill.register(ResizableImage,true);
}
export function installImageResize(q,Quill){
 let image=null,drag=null;
 const box=document.createElement('div');box.className='image-resize-box';box.hidden=true;box.setAttribute('aria-label','이미지 크기 조절');document.body.append(box);
 const info=document.createElement('div');info.className='image-resize-info';const label=document.createElement('span');label.setAttribute('aria-live','polite');const reset=document.createElement('button');reset.type='button';reset.textContent='원래 크기';info.append(label,reset);box.append(info);
 const contentWidth=()=>{const s=getComputedStyle(q.root);return q.root.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);};
 const percent=()=>Math.max(10,Math.min(100,Math.round(image.getBoundingClientRect().width/contentWidth()*100)));
 function update(){if(!image?.isConnected||!image.getClientRects().length){box.hidden=true;return;}const r=image.getBoundingClientRect();box.hidden=false;Object.assign(box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});label.textContent=percent()+'%';info.style.transform='translateX('+Math.min(0,innerWidth-24-r.left-info.offsetWidth)+'px)';}
 function commit(size){if(!image?.isConnected)return;image.style.removeProperty('width');q.history.cutoff();q.formatText(q.getIndex(Quill.find(image)),1,'imageWidth',size,'user');q.history.cutoff();update();}
 function finish(cancel=false){if(!drag)return;const size=percent();image.style.removeProperty('width');drag=null;if(!cancel)commit(size);else update();}
 for(const corner of ['nw','ne','sw','se']){
  const handle=document.createElement('button');handle.type='button';handle.className='image-resize-handle '+corner;handle.setAttribute('aria-label','이미지 '+({nw:'왼쪽 위',ne:'오른쪽 위',sw:'왼쪽 아래',se:'오른쪽 아래'}[corner])+' 크기 조절');handle.title='끌어서 크기 조절 · 방향키로 미세 조절';box.append(handle);
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||!image)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height,sign:corner.endsWith('w')?-1:1,vertical:corner.startsWith('n')?-1:1};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)*drag.sign,dy=(e.clientY-drag.y)*drag.vertical*drag.width/drag.height;const size=Math.round(Math.max(10,Math.min(100,(drag.width+(Math.abs(dx)>=Math.abs(dy)?dx:dy))/contentWidth()*100)));image.style.width=size+'%';update();});
  handle.addEventListener('pointerup',()=>finish());handle.addEventListener('pointercancel',()=>finish(true));handle.addEventListener('lostpointercapture',()=>finish(true));
  handle.addEventListener('keydown',e=>{if(e.key==='Escape'){finish(true);box.hidden=true;return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();commit(Math.max(10,Math.min(100,percent()+(e.shiftKey?10:1)*(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1))));});
 }
 reset.addEventListener('click',()=>commit(false));
 q.root.addEventListener('click',e=>{if(e.target.tagName==='IMG'){image=e.target;update();}else if(!drag){image=null;box.hidden=true;}});
 document.addEventListener('pointerdown',e=>{if(box.contains(e.target)||e.target===image||e.target.closest('#toolbar'))return;finish(true);image=null;box.hidden=true;});
 q.on('text-change',()=>requestAnimationFrame(update));window.addEventListener('scroll',update,true);window.addEventListener('resize',update);new ResizeObserver(update).observe(q.root);
}
