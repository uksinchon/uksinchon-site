import {TRASH_SCHEMA} from './schema.js';

// Additive storage: preserve the existing post/status schema, URLs, media and history.
export async function ensureTrash(db){await db.prepare(TRASH_SCHEMA).run();}
export async function isPostTrashed(db,id){
 if(!id)return false;
 await ensureTrash(db);
 return !!await db.prepare('SELECT post_id FROM cms_post_trash WHERE post_id=?').bind(id).first();
}

// Caller verifies the administrator and exact revision. All writes share one D1
// transaction and token, so a stale editor or concurrent publication cannot win.
export async function movePost(db,post,snapshot,actor,restore=false){
 const stamp=new Date().toISOString(),token=crypto.randomUUID();
 const data={...snapshot};delete data.publication;
 const gate=(restore?'':'NOT ')+'EXISTS(SELECT 1 FROM cms_post_trash WHERE post_id=cms_posts.id)';
 const statements=[
  db.prepare("UPDATE cms_posts SET revision=revision+1,status='draft',published_revision=NULL,updated_at=?,save_token=? WHERE id=? AND revision=? AND save_token=? AND "+gate).bind(stamp,token,post.id,post.revision,post.save_token),
  db.prepare('INSERT INTO cms_versions(post_id,revision,snapshot,actor_id,created_at) SELECT id,revision,?,?,? FROM cms_posts WHERE id=? AND save_token=?').bind(JSON.stringify(data),actor.id,stamp,post.id,token),
  restore?
   db.prepare('DELETE FROM cms_post_trash WHERE post_id=? AND EXISTS(SELECT 1 FROM cms_posts WHERE id=? AND save_token=?)').bind(post.id,post.id,token):
   db.prepare('INSERT INTO cms_post_trash(post_id,trashed_by,trashed_at,published_revision) SELECT id,?,?,? FROM cms_posts WHERE id=? AND save_token=?').bind(actor.id,stamp,post.published_revision,post.id,token),
  db.prepare('DELETE FROM cms_public_media WHERE post_id=? AND EXISTS(SELECT 1 FROM cms_posts WHERE id=? AND save_token=?)').bind(post.id,post.id,token),
  db.prepare('INSERT INTO cms_events(id,post_id,actor_id,action,revision,created_at) SELECT ?,id,?,?,revision,? FROM cms_posts WHERE id=? AND save_token=?').bind(crypto.randomUUID(),actor.id,restore?'restore':'trash',stamp,post.id,token)
 ];
 const result=await db.batch(statements);
 return result[0].meta.changes===1?{ok:true,revision:post.revision+1}:null;
}
