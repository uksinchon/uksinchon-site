/* Authorization is checked on each request; public HTML stays cacheable. */
(()=>{'use strict';const link=document.getElementById('edit-post');if(!link)return;
fetch('/api/cms/edit-target?'+new URLSearchParams({slug:link.dataset.slug}),{credentials:'same-origin',cache:'no-store'}).then(async r=>{const data=await r.json();return r.ok?data:null;}).then(data=>{if(!data?.id)return;link.href='/admin/?'+new URLSearchParams({edit:data.id});link.parentElement.hidden=false;}).catch(()=>{});
})();
