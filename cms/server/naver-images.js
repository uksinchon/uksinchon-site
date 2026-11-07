import {digest} from './naver.js';
import {webpDimensions} from './content.js';

export const MAX_NAVER_IMAGE_BYTES=8*1024*1024;
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
export function naverImageURL(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname.endsWith('.pstatic.net')&&!u.port&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
function sourceImages(item,expected){
 if(!item.source_complete||!expected||expected!==item.source_hash)fail('원문이 변경되었거나 전체 본문 확인이 필요합니다. 글을 다시 열어 주세요.',409);
 let images;try{images=JSON.parse(item.images);}catch{images=[];}
 return Array.isArray(images)?images.slice(0,200):[];
}
export async function naverImageList(item,body){
 const images=sourceImages(item,body.sourceHash);
 return {sourceHash:item.source_hash,images:await Promise.all(images.map(async(url,index)=>({index,url:naverImageURL(url)||String(url),key:await digest(String(url)),available:!!naverImageURL(url)})))};
}
export function rasterInfo(buffer){
 const b=new Uint8Array(buffer),word=(i,n)=>String.fromCharCode(...b.slice(i,i+n)),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length>=24&&word(0,8)==='\x89PNG\r\n\x1a\n'&&word(12,4)==='IHDR'){
  for(let at=8,steps=0;at+12<=b.length;){if(++steps>2048)return null;const size=view.getUint32(at);if(at+12+size>b.length)return null;if(word(at+4,4)==='acTL')return null;at+=12+size;}
  return {type:'image/png',extension:'png',width:view.getUint32(16),height:view.getUint32(20)};
 }
 if(b.length>=12&&word(0,4)==='RIFF'&&word(8,4)==='WEBP'){
  if(word(12,4)==='VP8X'&&(b[20]&2))return null;
  const size=webpDimensions(buffer);return size?{type:'image/webp',extension:'webp',...size}:null;
 }
 if(b.length>=4&&b[0]===255&&b[1]===216){
  for(let at=2,steps=0;at+3<b.length;){if(++steps>2048)return null;
   if(b[at]!==255)return null;while(b[at]===255)at++;const marker=b[at++];
   if(marker===217||marker===218)return null;if(marker===1||(marker>=208&&marker<=215))continue;
   const size=b[at]*256+b[at+1];if(size<2||at+size>b.length)return null;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7)return {type:'image/jpeg',extension:'jpg',height:b[at+3]*256+b[at+4],width:b[at+5]*256+b[at+6]};
   at+=size;
  }
 }
 return null;
}

// The index and URL key must match this authenticated source's stored list.
// Never fetch a caller-supplied URL, redirect, Cookie or Authorization header.
export async function downloadNaverImage(item,index,body,fetcher=fetch){
 const images=sourceImages(item,body.sourceHash);
 if(!/^(0|[1-9]\d{0,2})$/.test(String(index))||!images[Number(index)])fail('사진 번호를 확인해 주세요.',404);
 const source=images[Number(index)];if(body.key!==await digest(String(source)))fail('원문 사진 목록이 바뀌었습니다. 사진 선택 화면을 다시 열어 주세요.',409);
 const url=naverImageURL(source);if(!url)fail('네이버에 저장된 사진만 가져올 수 있습니다. 외부 사이트 사진은 직접 추가해 주세요.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetcher(url,{redirect:'manual',credentials:'omit',headers:{Accept:'image/jpeg, image/png, image/webp'},signal:controller.signal});
  if(response.status!==200){await response.body?.cancel();fail('네이버 사진을 내려받지 못했습니다. HTTP '+response.status,502);}
  const type=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type)){await response.body?.cancel();fail('JPG·PNG·WebP 정지 사진만 지원합니다.',415);}
  if(Number(response.headers.get('Content-Length'))>MAX_NAVER_IMAGE_BYTES){await response.body?.cancel();fail('원본 사진이 8MB를 넘습니다. 크기를 줄인 파일을 직접 추가해 주세요.',413);}
  const reader=response.body?.getReader();if(!reader)fail('사진 파일을 읽을 수 없습니다.',502);
  const chunks=[];let total=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_NAVER_IMAGE_BYTES){await reader.cancel();fail('원본 사진이 8MB를 넘습니다.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const info=rasterInfo(bytes);
  if(!info||info.type!==type)fail('올바른 JPG·PNG·WebP 정지 사진인지 확인할 수 없습니다.',415);
  if(!info.width||!info.height||Math.max(info.width,info.height)>24000||info.width*info.height>40000000)fail('사진 해상도가 너무 큽니다. 크기를 줄인 파일을 직접 추가해 주세요.',413);
  return new Response(bytes,{headers:{'Content-Type':info.type,'Content-Length':String(total),'Content-Disposition':'inline; filename="naver-photo-'+(Number(index)+1)+'.'+info.extension+'"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){if(e.status)throw e;fail('사진을 내려받는 중 연결이 끊겼습니다. 잠시 뒤 다시 시도해 주세요.',502);}
 finally{clearTimeout(timer);}
}
