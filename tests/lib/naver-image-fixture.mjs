/** Generated colour rectangles; never school or student images. */
import {deflateSync} from 'node:zlib';
export function fictionalPNG(width=16,height=12){
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (c^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const pixels=Buffer.alloc((width*3+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=y*(width*3+1)+1+x*3;pixels[at]=90;pixels[at+1]=150;pixels[at+2]=120;}
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export const FICTIONAL_WEBP=Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoQAAwAAUAmJZACdLoAA5gA/t+APtTYqp53f4tpHQpPAAAA','base64');
export function imageFixture(){
 const id='666666666666',urls=Array.from({length:14},(_,i)=>'https://postfiles.pstatic.net/fictional/photo-'+i+'.png');urls[3]='https://external.example.test/never-fetch.png';
 const imageResponses=Object.fromEntries(urls.filter(u=>u.includes('pstatic.net')).map(u=>[u,{bytes:fictionalPNG(),type:'image/png'}]));
 imageResponses[urls[0]]={bytes:fictionalPNG(2000,1200),type:'image/png'};imageResponses[urls[1]]={bytes:FICTIONAL_WEBP,type:'image/webp'};imageResponses[urls[2]]={bytes:Buffer.from('<html>not a photo</html>'),type:'image/jpeg'};imageResponses[urls[4]]={bytes:Buffer.from('GIF89a'),type:'image/gif'};
 const text='이 자료는 원문 사진 가져오기를 검증하는 가상 본문입니다. 실제 학교의 조건이나 학생 사례가 아니며 오직 격리된 화면과 이미지 저장 동작을 확인합니다. 이미지 파일도 직접 만든 단색 사각형입니다.';
 const naverHTML={[id]:'<meta property="og:title" content="가상 사진 가져오기 원문"><div class="se-main-container"><p>'+text+'</p>'+urls.map(url=>'<img src="'+url+'">').join('')+'</div>'};
 return {id,urls,naverHTML,imageResponses};
}
