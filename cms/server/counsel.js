// 상담신청서(/counsel/) 접수 저장과 관리자 게시판.
// 기존 글쓰기 DB(CMS_DB)에 테이블만 추가한다. 메일 알림(Formspree)은 신청서에서 그대로 유지한다.
export const COUNSEL_SCHEMA=[
`CREATE TABLE IF NOT EXISTS cms_counsel (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacting','done','spam')), name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', interest TEXT NOT NULL DEFAULT '', fields TEXT NOT NULL, memo TEXT NOT NULL DEFAULT '', updated_at TEXT, updated_by TEXT)`,
`CREATE INDEX IF NOT EXISTS cms_counsel_created ON cms_counsel(created_at)`
];
// 신청서에 있는 항목만 받는다. 순서는 상세 화면 표시 순서.
export const COUNSEL_FIELDS=['성명','휴대폰','이메일','성별','카카오톡 아이디','알게 된 경로','관심분야','출국 예정일','희망지역','어학연수 기간','전체예산','어학연수 비용견적','희망전공','입학년도','최종 졸업학교와 전공','어학 점수','정규유학 기타 문의사항','상담 방식','희망 상담일시','상담일','상담_AMPM','상담_시','상담_분','기타 문의사항','개인정보동의'];
const STATUSES=['new','contacting','done','spam'];
const LONG=new Set(['기타 문의사항','정규유학 기타 문의사항','최종 졸업학교와 전공']);
const err=(status,message)=>Object.assign(new Error(message),{status});
export async function ensureCounsel(db){await db.batch(COUNSEL_SCHEMA.map(sql=>db.prepare(sql)));}

export function cleanSubmission(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw err(400,'신청 내용을 읽을 수 없습니다.');
 if(String(body._gotcha||'').trim())return null; // 자동 등록 프로그램이 채우는 숨은 칸
 const fields={};
 for(const key of COUNSEL_FIELDS){
  const raw=body[key];if(raw===undefined||raw===null)continue;
  const value=String(Array.isArray(raw)?raw.join(', '):raw).replace(/\r\n?/g,'\n').trim().slice(0,LONG.has(key)?3000:200);
  if(value)fields[key]=value;
 }
 if(!fields['성명'])throw err(400,'성명을 입력해 주세요.');
 if(!fields['휴대폰']&&!fields['이메일'])throw err(400,'연락처를 입력해 주세요.');
 return fields;
}

export async function submitCounsel(db,body){
 const fields=cleanSubmission(body);
 if(!fields)return {ok:true};
 await ensureCounsel(db);
 const id=crypto.randomUUID();
 await db.prepare('INSERT INTO cms_counsel(id,created_at,name,phone,email,interest,fields) VALUES(?,?,?,?,?,?,?)').bind(id,new Date().toISOString(),fields['성명'].slice(0,60),(fields['휴대폰']||'').slice(0,40),(fields['이메일']||'').slice(0,200),(fields['관심분야']||'').slice(0,60),JSON.stringify(fields)).run();
 return {ok:true};
}

// 관리자 전용: 목록·상세·상태/메모 변경·삭제
export async function counselAdmin(db,parts,method,url,body,user){
 await ensureCounsel(db);
 const id=parts[1];
 if(!id&&method==='GET'){
  const page=Math.max(1,Number(url.searchParams.get('page'))||1);const status=url.searchParams.get('status')||'';const term=String(url.searchParams.get('q')||'').trim().slice(0,60);
  let where='1=1';const args=[];
  if(STATUSES.includes(status)){where+=' AND status=?';args.push(status);}else where+=" AND status<>'spam'";
  if(term){where+=" AND (name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')";const like='%'+term.replace(/[\\%_]/g,'\\$&')+'%';args.push(like,like,like);}
  const rows=await db.prepare(`SELECT id,created_at,status,name,phone,email,interest,CASE WHEN memo<>'' THEN 1 ELSE 0 END AS has_memo FROM cms_counsel WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET ?`).bind(...args,(page-1)*30).all();
  const counts=await db.prepare('SELECT status,COUNT(*) AS n FROM cms_counsel GROUP BY status').all();
  return {items:rows.results.slice(0,30),hasMore:rows.results.length>30,page,counts:Object.fromEntries(counts.results.map(r=>[r.status,r.n]))};
 }
 if(!id||parts.length!==2)throw err(404,'요청한 기능을 찾을 수 없습니다.');
 const row=await db.prepare('SELECT c.*,u.name AS updated_by_name FROM cms_counsel c LEFT JOIN cms_users u ON u.id=c.updated_by WHERE c.id=?').bind(id).first();
 if(!row)throw err(404,'신청서를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
 if(method==='GET'){
  let fields={};try{fields=JSON.parse(row.fields);}catch{}
  return {item:{...row,fields:COUNSEL_FIELDS.filter(k=>fields[k]).map(k=>[k,fields[k]])}};
 }
 if(method==='PUT'){
  const status=STATUSES.includes(body?.status)?body.status:row.status;
  const memo=typeof body?.memo==='string'?body.memo.replace(/\r\n?/g,'\n').slice(0,5000):row.memo;
  const stamp=new Date().toISOString();
  await db.prepare('UPDATE cms_counsel SET status=?,memo=?,updated_at=?,updated_by=? WHERE id=?').bind(status,memo,stamp,user.id,id).run();
  return {ok:true,status,memo,updated_at:stamp,updated_by_name:user.name};
 }
 if(method==='POST'&&body?.action==='delete'){
  await db.prepare('DELETE FROM cms_counsel WHERE id=?').bind(id).run();
  return {ok:true};
 }
 throw err(405,'지원하지 않는 요청입니다.');
}
