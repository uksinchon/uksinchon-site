import {ensureNaver,syncNaver,registerURL,readSource,saveSource,createNaverDraft} from './naver.js';
import {aiConfigured,NAVER_FEED} from './naver-content.js';
function error(message,status=400){const e=new Error(message);e.status=status;throw e;}
export async function naverAdmin(path,method,body,env,user){
 const db=env.CMS_DB;await ensureNaver(db);const parts=path.split('/');
 if(path==='naver'&&method==='GET'){
  const config=await db.prepare('SELECT enabled,baseline_at,last_checked_at,last_error,last_cron_at FROM cms_naver_source WHERE id=1').first();
  const items=(await db.prepare('SELECT i.id,i.url,i.title,i.published_at,i.status,i.source_complete,i.fetched_at,i.post_id,i.mode,i.error,i.approved_revision,p.revision AS draft_revision FROM cms_naver_items i LEFT JOIN cms_posts p ON p.id=i.post_id ORDER BY i.published_at DESC,i.discovered_at DESC LIMIT 80').all()).results;
  return {config,items,feed:NAVER_FEED,ai:{configured:aiConfigured(env),model:env.CMS_REWRITE_MODEL||null},schedulerKeyConfigured:typeof env.CMS_NAVER_CRON_TOKEN==='string'&&env.CMS_NAVER_CRON_TOKEN.length>=32};
 }
 if(path==='naver/config'&&method==='POST'){await db.prepare('UPDATE cms_naver_source SET enabled=?,owner_id=? WHERE id=1').bind(body.enabled===true?1:0,user.id).run();return {ok:true};}
 if(path==='naver/check'&&method==='POST')return syncNaver(env);
 if(path==='naver/url'&&method==='POST')return {item:await registerURL(db,body.url)};
 if(parts[1]==='items'&&parts[2]){
  let item=await db.prepare('SELECT * FROM cms_naver_items WHERE id=?').bind(parts[2]).first();if(!item)error('수집한 글을 찾을 수 없습니다.',404);
  if(parts.length===3&&method==='GET')return {item};
  if(parts[3]==='fetch'&&method==='POST')return {item:await readSource(db,item.id)};
  if(parts[3]==='text'&&method==='POST'){if(body.confirmed!==true)error('전체 원문을 대조했다는 확인이 필요합니다.');await saveSource(db,item,String(body.text||''),JSON.parse(item.images||'[]'),'manual-confirmed');return {ok:true};}
  if(parts[3]==='draft'&&method==='POST')return createNaverDraft(db,item.id,body.mode,env,user);
  if(parts[3]==='review'&&method==='POST'){
   if(!body.checks||!['facts','conditions','rights'].every(k=>body.checks[k]===true))error('원문·적용 조건·개인정보와 사진 권리를 모두 확인해 주세요.');
   if(!item.post_id||!item.source_complete)error('전체 원문과 초안이 준비되어야 검수할 수 있습니다.');
   if(item.processing_until&&item.processing_until>new Date().toISOString())error('AI 재편집이 진행 중입니다. 완료 후 검수해 주세요.',409);
   if(item.source_method==='naver-public-body')item=await readSource(db,item.id);
   if(item.source_hash!==body.sourceHash)error('원문이 변경되었습니다. 원문과 초안을 다시 열어 대조해 주세요.',409);
   const result=await db.prepare("UPDATE cms_naver_items SET approved_revision=?,approved_source_hash=source_hash,approved_by=?,approved_at=?,status='draft_ready' WHERE id=? AND source_hash=? AND source_complete=1 AND EXISTS(SELECT 1 FROM cms_posts WHERE id=post_id AND revision=?)").bind(Number(body.revision),user.id,new Date().toISOString(),item.id,body.sourceHash,Number(body.revision)).run();if(result.meta.changes!==1)error('초안이 변경되었습니다. 현재 버전을 다시 검수해 주세요.',409);return {ok:true};
  }
 }
 error('네이버 연결 기능을 찾을 수 없습니다.',404);
}
