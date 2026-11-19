/* Navigation, and click-to-play for server-rendered YouTube Shorts. Notes and clips are rendered on the server. */
(()=>{'use strict';
 const menu=document.querySelector('.mobile-menu');
 if(menu){
  menu.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
 }
 // Sharp Shorts thumbnails: if YouTube has no large image (it returns a 120px placeholder), use the standard one.
 const fixThumb=img=>{if(img.dataset.fallback&&img.complete&&img.naturalWidth>0&&img.naturalWidth<=120){img.src=img.dataset.fallback;delete img.dataset.fallback;}};
 document.querySelectorAll('.clip img[data-fallback]').forEach(img=>{fixThumb(img);img.addEventListener('load',()=>fixThumb(img));img.addEventListener('error',()=>{if(img.dataset.fallback){img.src=img.dataset.fallback;delete img.dataset.fallback;}});});
 // Hero: the first photo loads with the page; the others load afterwards and cross-fade slowly with their captions.
 const fig=document.querySelector('.hero-visual[data-slides]');
 if(fig){
  let extra=[];try{extra=JSON.parse(fig.dataset.slides)||[];}catch{}
  const first=fig.querySelector('.hero-photo'),cap=fig.querySelector('figcaption');
  const slides=[{el:null,small:cap.querySelector('span').textContent,big:cap.querySelector('strong').textContent,alt:first.alt}];
  const sizes='(max-width:900px) calc(100vw - 32px), 560px';
  const start=()=>{
   for(const s of extra){if(!/^[a-z0-9-]+$/.test(s.img))continue;
    const img=new Image();img.className='hero-slide';img.alt='';img.decoding='async';img.sizes=sizes;
    img.srcset=`/assets/home/${s.img}-768.webp 768w, /assets/home/${s.img}-1440.webp 1440w`;img.src=`/assets/home/${s.img}-1440.webp`;
    img.setAttribute('aria-hidden','true');fig.insertBefore(img,cap);slides.push({el:img,small:s.small,big:s.big,alt:s.alt});}
   if(slides.length<2)return;
   const dots=document.createElement('div');dots.className='hero-dots';dots.setAttribute('aria-label','메인 사진 선택');
   slides.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(i+1)+'번째 사진');b.addEventListener('click',()=>{show(i);restart();});dots.append(b);});
   fig.append(dots);
   let cur=0,timer=null;
   function show(i){
    if(i===cur)return;cur=i;
    slides.forEach((s,k)=>s.el&&s.el.classList.toggle('on',k===i&&k!==0));
    first.alt=slides[i].alt;
    cap.classList.add('swap');
    setTimeout(()=>{cap.querySelector('span').textContent=slides[i].small;cap.querySelector('strong').textContent=slides[i].big;cap.classList.remove('swap');},500);
    [...dots.children].forEach((d,k)=>d.setAttribute('aria-current',String(k===i)));
   }
   [...dots.children][0].setAttribute('aria-current','true');
   const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
   function restart(){clearInterval(timer);if(!still)timer=setInterval(()=>{if(!document.hidden)show((cur+1)%slides.length);},6500);}
   restart();
  };
  if(document.readyState==='complete')setTimeout(start,800);else addEventListener('load',()=>setTimeout(start,800),{once:true});
 }
 // Load the YouTube player only when a visitor chooses a clip; without JavaScript the link opens YouTube.
 document.addEventListener('click',event=>{
  const clip=event.target.closest('a.clip[data-video]');if(!clip||event.metaKey||event.ctrlKey||event.shiftKey)return;
  const id=clip.dataset.video;if(!/^[A-Za-z0-9_-]{11}$/.test(id))return;
  event.preventDefault();
  const frame=document.createElement('iframe');
  frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&playsinline=1&rel=0';
  frame.title=clip.querySelector('.clip-title')?.textContent||'신촌점 유튜브 영상';
  frame.allow='autoplay; encrypted-media; picture-in-picture';frame.allowFullscreen=true;
  const box=document.createElement('div');box.className='clip playing';box.append(frame);clip.replaceWith(box);
 });
})();
