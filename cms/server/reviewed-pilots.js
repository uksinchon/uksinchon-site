// A finite, code-reviewed catalogue, not a general AI approval service.
// No client-supplied reviewer, packet, date or checks can create this proof.
import packets from './reviewed-pilots-data.js';
import {cleanSnapshot,todayKorea} from './content.js';
import {readSource} from './naver.js';

export const CODEX_REVIEWER='codex-ai:pilot-20261106';
export const reviewedPilots=packets;
const reject=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
export const reviewContent=s=>JSON.stringify(cleanSnapshot(s,''));
export function pilotReview(snapshot,item,post,date=todayKorea()) {
 const packet=packets.find(p=>p.sourceId===item?.id);
 if(!packet||date>packet.validUntil||!item.source_complete||item.status==='source_changed'||
  item.source_hash!==packet.sourceHash||item.approved_source_hash!==packet.sourceHash||
  item.approved_by!==CODEX_REVIEWER||item.prompt_version!==packet.id||
  item.approved_revision!==post.revision||reviewContent(snapshot)!==reviewContent(packet.snapshot))return null;
 return {kind:'ai',actor_id:CODEX_REVIEWER,name:packet.reviewerName,created_at:packet.reviewedAt,
  revision:post.revision,evidenceId:packet.id,evidenceURL:packet.reportURL};
}

export async function applyReviewedPilot(db,item,body,actor) {
 const packet=packets.find(p=>p.sourceId===item.id);
 if(!packet)reject('이 원문에는 Codex가 완료한 검토 원고가 없습니다.',404);
 if(todayKorea()>packet.validUntil)reject('이 검토 원고의 재확인 시점이 지났습니다. 새 자료 검토가 필요합니다.',409);
 if(body.onlyNew===true&&item.post_id)return {skipped:true,postId:item.post_id};
 // Refresh using the normal source reader. A changed or unreadable original fails closed.
 item=await readSource(db,item.id);
 if(item.source_hash!==packet.sourceHash)reject('검토 이후 네이버 원문이 바뀌었습니다. 완료 원고를 적용하지 않았습니다.',409);
 const stamp=new Date().toISOString(),lease=crypto.randomUUID();
 const locked=await db.prepare('UPDATE cms_naver_items SET processing_token=?,processing_until=? WHERE id=? AND source_hash=? AND source_complete=1 AND (processing_until IS NULL OR processing_until<?)').bind(lease,new Date(Date.now()+180000).toISOString(),item.id,packet.sourceHash,stamp).run();
 if(locked.meta.changes!==1)reject('원문 확인 또는 재편집이 진행 중입니다. 완료 후 다시 시도해 주세요.',409);
 try {
  item=await db.prepare('SELECT * FROM cms_naver_items WHERE id=?').bind(item.id).first();
  const previous=item.post_id?await db.prepare('SELECT * FROM cms_posts WHERE id=?').bind(item.post_id).first():null;
  if(item.post_id&&!previous)reject('연결된 글을 찾을 수 없습니다.',409);
  if(previous&&Number(body.revision)!==previous.revision)reject('기존 원고는 현재 버전을 열고 적용해 주세요. 자동으로 덮어쓰지 않았습니다.',409);
  const owner=previous?await db.prepare('SELECT * FROM cms_users WHERE id=? AND active=1').bind(previous.owner_id).first():actor;
  if(!owner)reject('초안 담당 계정을 확인해 주세요.');
  const data=JSON.stringify(cleanSnapshot(packet.snapshot,owner.name));
  const id=previous?.id||crypto.randomUUID(),revision=previous?previous.revision+1:1,save=crypto.randomUUID();
  const gate='EXISTS(SELECT 1 FROM cms_naver_items WHERE id=? AND source_hash=? AND source_complete=1 AND processing_token=?)';
  const params=[item.id,packet.sourceHash,lease];
  const statements=[previous?
   db.prepare("UPDATE cms_posts SET revision=revision+1,status='draft',updated_at=?,save_token=? WHERE id=? AND revision=? AND "+gate).bind(stamp,save,id,previous.revision,...params):
   db.prepare("INSERT INTO cms_posts(id,slug,owner_id,status,revision,created_at,updated_at,save_token) SELECT ?,?,?,'draft',1,?,?,? WHERE "+gate+' AND EXISTS(SELECT 1 FROM cms_naver_items WHERE id=? AND post_id IS NULL)').bind(id,'story-'+id,owner.id,stamp,stamp,save,...params,item.id),
   db.prepare('INSERT INTO cms_versions(post_id,revision,snapshot,actor_id,created_at) SELECT id,revision,?,?,? FROM cms_posts WHERE id=? AND save_token=?').bind(data,actor.id,stamp,id,save),
   db.prepare("UPDATE cms_naver_items SET post_id=?,mode='ai',model='Codex (AI 검토)',prompt_version=?,notes=?,evidence=?,status='draft_ready',approved_revision=?,approved_source_hash=?,approved_by=?,approved_at=?,error=NULL,updated_at=? WHERE id=? AND processing_token=? AND source_hash=? AND EXISTS(SELECT 1 FROM cms_posts WHERE id=? AND save_token=?)").bind(id,packet.id,JSON.stringify(['Codex가 공식 자료와 대조한 한정 원고입니다. 검토 보고서: '+packet.reportURL,...packet.verdicts.held]),JSON.stringify(packet.verdicts.kept),revision,packet.sourceHash,CODEX_REVIEWER,packet.reviewedAt,stamp,item.id,lease,packet.sourceHash,id,save),
   db.prepare("INSERT INTO cms_events(id,post_id,actor_id,action,revision,created_at) SELECT ?,id,?,'codex_review_applied',revision,? FROM cms_posts WHERE id=? AND save_token=?").bind(crypto.randomUUID(),actor.id,stamp,id,save)
  ];
  const result=await db.batch(statements);
  if(result[0].meta.changes!==1)reject('다른 창에서 원문 또는 원고가 변경되어 적용하지 않았습니다.',409);
  return {postId:id,revision,reviewerKind:'ai',reviewerName:packet.reviewerName};
 }finally{await db.prepare('UPDATE cms_naver_items SET processing_token=NULL,processing_until=NULL WHERE id=? AND processing_token=?').bind(item.id,lease).run();}
}
