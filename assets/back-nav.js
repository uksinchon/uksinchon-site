/* 휴대폰에서 어느 페이지든 직전 페이지로 돌아가는 버튼. 홈과 진단 화면(자체 버튼 있음)에는 넣지 않는다. */
(()=>{'use strict';
 const path=location.pathname;
 if(path==='/'||path==='/index.html'||/^\/(study-path|hello-uk)(\/|$)/.test(path)||document.querySelector('.uk-back'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/back-nav.css';document.head.append(css);
 const btn=document.createElement('button');btn.type='button';btn.className='uk-back';btn.setAttribute('aria-label','이전 페이지로 돌아가기');
 btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>';
 // 바로 앞 페이지가 있으면 그곳으로, 없으면(링크로 바로 들어온 경우) 상위 목록이나 홈으로
 btn.addEventListener('click',()=>{
  if(history.length>1&&document.referrer){history.back();return;}
  location.href=/^\/blog\/.+/.test(path)?'/blog/':'/';
 });
 // 로고(.brand) 바로 왼쪽에 나란히 붙인다. 로고가 없으면 머리글 맨 앞, 그것도 없으면 화면 왼쪽 위에 띄운다.
 const brand=document.querySelector('header .brand, .topbar .brand');
 if(brand){const wrap=document.createElement('div');wrap.className='uk-back-wrap';brand.replaceWith(wrap);wrap.append(btn,brand);return;}
 const header=document.querySelector('header');
 if(header&&getComputedStyle(header).display==='flex'){header.prepend(btn);return;}
 btn.classList.add('floating');document.body.append(btn);
})();
