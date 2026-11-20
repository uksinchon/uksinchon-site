import {imageIds} from './content.js';

// A published, non-decorative photo for the card: the chosen hero image first, else the first photo in the text.
export async function noteImage(db,p){
 try{
  const snap=JSON.parse(p.snapshot||'{}');const meta=snap.imageMeta||{};
  const ids=[snap.heroImageId,...(snap.delta?.ops?imageIds(snap):[])].filter((id,i,a)=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)&&a.indexOf(id)===i&&!meta[id]?.decorative);
  for(const id of ids){if(await db.prepare('SELECT 1 FROM cms_public_media WHERE post_id=? AND media_id=?').bind(p.id,id).first())return {id};}
 }catch{}
 return null;
}
