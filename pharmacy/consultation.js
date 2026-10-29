/* Browser-only message preparation. Nothing is submitted, tracked, or stored. */
(() => {
  'use strict';
  const form = document.getElementById('consultation-form');
  const result = document.getElementById('message-result');
  const prepared = document.getElementById('prepared-message');
  const copyButton = document.getElementById('copy-message');
  const copyStatus = document.getElementById('copy-status');
  const campaignNote = document.getElementById('campaign-note');
  const params = new URLSearchParams(window.location.search);
  const campaign = {};
  // Only bounded, non-identifying campaign tags enter the counselor's message.
  // Do not propagate the URL, tracking IDs, unknown query keys, or user text.
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = params.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) campaign[key] = value;
  }
  if (campaign.utm_source && ['studygroup', 'study_group'].includes(campaign.utm_source.toLowerCase())) {
    campaignNote.textContent = 'Study Group 콘텐츠를 보고 오셨다면, 궁금한 과정을 상담 시 알려주세요.';
    campaignNote.hidden = false;
  }

  // Without JS the page still offers the same real Kakao/telephone channels.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const name = String(values.get('student_name') || '').trim();
    const message = String(values.get('message') || '').trim();
    const lines = [
      '[영국유학센터 신촌점 · 약대 파운데이션 상담]',
      '안녕하세요. 영국 약대 진학 상담을 받고 싶습니다.',
      '',
      ...(name ? ['호칭: ' + name] : []),
      '현재 학력: ' + values.get('education'),
      '희망 입학 시기: ' + values.get('entry'),
      '영어 준비 상태: ' + (values.get('english') || '아직 미정'),
      ...(message ? ['', '궁금한 점:', message] : []),
      '',
      '안내 페이지: https://uksinchon.com/pharmacy/'
    ];
    if (Object.keys(campaign).length) {
      lines.push('유입 경로: ' + Object.entries(campaign).map(([key, value]) => key + '=' + value).join(' / '));
    }
    prepared.value = lines.join('\n');
    copyStatus.textContent = '';
    result.hidden = false;
    prepared.focus({preventScroll: true});
    result.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  });

  prepared.addEventListener('input', () => { copyStatus.textContent = ''; });
  copyButton.addEventListener('click', async () => {
    if (!prepared.value.trim()) {
      copyStatus.textContent = '보낼 내용을 입력한 뒤 복사해 주세요.';
      prepared.focus();
      return;
    }
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(prepared.value);
      copyStatus.textContent = '복사했습니다. 카카오톡 채널에 붙여넣어 전송해 주세요.';
    } catch (_) {
      prepared.focus();
      prepared.select();
      // Selection is reliable even when clipboard permission is denied.
      copyStatus.textContent = '자동 복사를 사용할 수 없습니다. 선택된 내용을 길게 눌러 복사하거나 Ctrl+C(맥은 ⌘C)를 눌러 주세요.';
    }
  });
  // Reveal only after the submission guard is installed. With JS disabled,
  // student details must never fall back to a GET request in the page URL.
  form.hidden = false;
})();
