/* Show the home entry only after a public article exists. */
(()=>{'use strict';
 if(!['http:','https:'].includes(location.protocol))return;
 const entry=document.getElementById('blog-entry');if(!entry)return;
 fetch('/feed.xml',{credentials:'omit'}).then(response=>{
  if(!response.ok||!response.headers.get('Content-Type')?.includes('xml'))return '';
  return response.text();
 }).then(text=>{if(text&&new DOMParser().parseFromString(text,'application/xml').querySelector('channel > item'))entry.hidden=false;}).catch(()=>{});
})();
