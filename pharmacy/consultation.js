/* Prepare a message locally; the visitor explicitly sends it in Kakao. */
(()=>{'use strict';
const form=document.getElementById('consultation-form');const questions=document.getElementById('question-stage');const result=document.getElementById('message-result');const prepared=document.getElementById('prepared-message');const status=document.getElementById('copy-status');
const campaign={};const params=new URLSearchParams(location.search);
for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']){const value=params.get(key);if(value&&/^[a-zA-Z0-9_-]{1,80}$/.test(value))campaign[key]=value;}
if(campaign.utm_source&&['studygroup','study_group'].includes(campaign.utm_source.toLowerCase())){const note=document.getElementById('campaign-note');note.textContent='Study Group 콘텐츠를 보고 오셨다면, 광고에서 본 과정명도 함께 알려주세요.';note.hidden=false;}
form.addEventListener('submit',event=>{event.preventDefault();const values=new FormData(form);const question=String(values.get('question')||'').trim();const lines=['[영국유학센터 신촌점 · 약대 파운데이션 상담]','안녕하세요. 영국 약대 진학 상담을 받고 싶습니다.','','현재 학력: '+values.get('education'),'희망 입학 시기: '+values.get('entry'),...(question?['','궁금한 점:',question]:[]),'','안내 페이지: https://uksinchon.com/pharmacy/'];if(Object.keys(campaign).length)lines.push('유입 경로: '+Object.entries(campaign).map(([key,value])=>key+'='+value).join(' / '));prepared.value=lines.join('\n');status.textContent='';questions.hidden=true;result.hidden=false;document.getElementById('result-title').focus({preventScroll:true});});
prepared.addEventListener('input',()=>{status.textContent='';});
document.getElementById('copy-message').addEventListener('click',async()=>{if(!prepared.value.trim()){status.textContent='보낼 내용을 입력해 주세요.';prepared.focus();return;}try{if(!navigator.clipboard||!window.isSecureContext)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(prepared.value);status.textContent='복사했습니다. 카카오톡에 붙여넣어 전송해 주세요.';}catch{prepared.focus({preventScroll:true});prepared.select();status.textContent='내용을 선택했습니다. Ctrl+C(맥은 ⌘C) 또는 기기의 복사 기능을 사용해 주세요.';}});
document.getElementById('edit-conditions').addEventListener('click',()=>{result.hidden=true;questions.hidden=false;document.getElementById('education').focus({preventScroll:true});});
// Install the submit guard before revealing fields: no-JS mode never sends GET data.
form.hidden=false;
function revealLinkedGuide(){if(location.hash==='#guide')document.getElementById('guide').open=true;}
window.addEventListener('hashchange',revealLinkedGuide);revealLinkedGuide();
})();
