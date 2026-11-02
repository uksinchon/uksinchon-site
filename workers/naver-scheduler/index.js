/* Cron only: this worker can request draft collection, never publish posts. */
export default {
 async scheduled(_controller,env,context){
  context.waitUntil((async()=>{
   if(typeof env.CMS_NAVER_CRON_TOKEN!=='string'||env.CMS_NAVER_CRON_TOKEN.length<32)throw new Error('CMS_NAVER_CRON_TOKEN is missing');
   const response=await fetch('https://uksinchon.com/api/cms/naver/cron',{method:'POST',headers:{Authorization:'Bearer '+env.CMS_NAVER_CRON_TOKEN,'Content-Type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(300000)});
   if(!response.ok)throw new Error('Naver draft sync failed with HTTP '+response.status);
   console.log('Naver draft sync request completed');
  })());
 },
 fetch(){return new Response('Scheduled draft collection worker. No public actions.',{status:404,headers:{'X-Robots-Tag':'noindex'}});}
};
