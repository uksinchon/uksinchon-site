import {semanticContent,needsFactCheck,factReadiness,imageReadiness,safeLink} from './content.js';

export function publicationDates(snapshot,post) {
  const publishedAt=post.published_at||null;
  const modified=snapshot.publication?.contentModifiedAt;
  const modifiedAt=publishedAt&&modified&&Date.parse(modified)>=Date.parse(publishedAt)?modified:null;
  return {publishedAt,modifiedAt};
}

export function publicationProblem(snapshot,review) {
  if(snapshot.schemaVersion!==2)return '';
  if(snapshot.sourceDetails?.some(s=>!safeLink(s.url)))return '자료 주소를 완성하거나 사용하지 않는 자료 줄을 지워 주세요.';
  const imageProblem=imageReadiness(snapshot);if(imageProblem)return imageProblem;
  if(needsFactCheck(snapshot)) {
    const problem=factReadiness(snapshot);if(problem)return problem;
    if(!review)return '현재 버전의 출처·조건을 대조한 뒤 사실 확인 기록을 남겨 주세요.';
  }
  return '';
}

// Only the server calls this after role, revision, source and fact-review guards.
// A separate immutable version captures the approval; no old snapshot is rewritten.
export function sealPublication(snapshot,post,previous,review,user,stamp) {
  const publishedAt=post.published_at||stamp;
  let modifiedAt=post.published_at?(previous?.publication?.contentModifiedAt||null):stamp;
  const changed=previous&&semanticContent(previous)!==semanticContent(snapshot);
  if(changed&&snapshot.changeKind!=='minor')modifiedAt=stamp;
  if(modifiedAt&&Date.parse(modifiedAt)<Date.parse(publishedAt))modifiedAt=null;
  const factCheck=review?{checkedAt:snapshot.verifiedAt,scope:snapshot.reviewScope,
    reviewerId:review.actor_id,reviewerName:review.name,recordedAt:review.created_at,sourceRevision:review.revision||post.revision}:null;
  return {...snapshot,publication:{version:1,publishedAt,contentModifiedAt:modifiedAt,
    authorId:post.owner_id,approvedById:user.id,approvedByName:user.name,approvedAt:stamp,
    changeKind:previous?(snapshot.changeKind||'substantive'):'initial',changeNote:snapshot.changeNote||'',factCheck}};
}
