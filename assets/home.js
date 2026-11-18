/* Navigation only. Published notes are rendered on the server. */
(()=>{'use strict';
 const menu=document.querySelector('.mobile-menu');if(!menu)return;
 menu.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
})();
