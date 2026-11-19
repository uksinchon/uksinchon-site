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
