import {getSession} from '../../cms/server/api.js';
export async function onRequest({request,env,params}) {
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 if(!env.CMS_DB)return new Response(null,{status:404});
 const id=params.id;if(!/^[a-f0-9-]{36}$/.test(id))return new Response(null,{status:404});
 try {
  const image=await env.CMS_DB.prepare('SELECT m.*,p.owner_id AS post_owner FROM cms_media m JOIN cms_posts p ON p.id=m.post_id WHERE m.id=?').bind(id).first();
  if(!image)return new Response(null,{status:404});
  const published=await env.CMS_DB.prepare('SELECT 1 FROM cms_public_media WHERE media_id=?').bind(id).first();
  if(!published){const user=await getSession(request,env);if(!user||!(user.role==='admin'||user.id===image.post_owner))return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});}
  return new Response(request.method==='HEAD'?null:new Uint8Array(image.data),{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':published?'public, max-age=0, must-revalidate':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'X-Robots-Tag':published?'all':'noindex'}});
 }catch {return new Response(null,{status:404});}
}
