/* Shared URL allowlist: arbitrary frame URLs and HTML are never stored. */
export const validYouTubeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{11}$/.test(value);
export function youtubeId(value){
 try{
  const u=new URL(String(value).trim());if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return null;
  const host=u.hostname.toLowerCase();let id;
  if(host==='youtu.be')id=u.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){
   if(u.pathname==='/watch')id=u.searchParams.get('v');
   else id=u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  }
  return validYouTubeId(id)?id:null;
 }catch{return null;}
}
