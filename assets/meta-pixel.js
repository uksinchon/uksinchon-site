/* Consent-gated PageView only. Never read consultation fields or send a Lead. */
(() => {
  'use strict';
  const config = window.UK_META_PIXEL_CONFIG;
  const source = document.currentScript;
  const hosts = ['uksinchon.com', 'www.uksinchon.com', 'localhost', '127.0.0.1'];
  if (!config || config.enabled !== true || typeof config.pixelId !== 'string' || !/^[1-9][0-9]{4,29}$/.test(config.pixelId) ||
      !Number.isInteger(config.consentVersion) || config.consentVersion < 1 ||
      !hosts.includes(location.hostname) || !['https:', 'http:'].includes(location.protocol) ||
      (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname))) return;

  const key = 'uk-sinchon-meta-consent';
  const expiry = 180 * 24 * 60 * 60 * 1000;
  let choice = null;
  let loading = false;
  let loaded = false;
  let initialized = false;
  let sent = false;
  let script = null;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.version === config.consentVersion && saved.pixelId === config.pixelId &&
        ['granted', 'denied'].includes(saved.choice) && Number.isFinite(saved.at) &&
        saved.at <= Date.now() && Date.now() - saved.at < expiry) choice = saved.choice;
  } catch (_) { /* Without storage, choices remain in memory for this page. */ }

  function safePage() {
    // Meta's PageView includes the URL. Suppress tracking on unexpected URLs
    // rather than forwarding unknown query parameters or private hash values.
    if (!['/', '/index.html', '/pharmacy/', '/pharmacy/index.html'].includes(location.pathname)) return false;
    if (!['', '#main', '#guide', '#consultation'].includes(location.hash)) return false;
    const url = new URL(location.href);
    for (const [name, value] of url.searchParams) {
      if (name === 'fbclid' && /^[A-Za-z0-9_.~-]{1,600}$/.test(value)) continue;
      if (/^utm_(source|medium|campaign|content|term)$/.test(name) && /^[A-Za-z0-9_-]{1,80}$/.test(value)) continue;
      return false;
    }
    return true;
  }

  function initialize() {
    if (choice !== 'granted' || !safePage() || !loaded) return;
    const fbq = window.fbq;
    fbq('consent', 'grant');
    if (!initialized) {
      // Meta documents the literal string 'false' before init to disable
      // automatic event logging. No advanced-matching user object is supplied.
      fbq('set', 'autoConfig', 'false', config.pixelId);
      fbq('init', config.pixelId);
      initialized = true;
    }
    if (!sent) {
      fbq('track', 'PageView');
      sent = true;
    }
  }

  function start() {
    if (choice !== 'granted' || !safePage()) return;
    if (loaded) { initialize(); return; }
    if (loading) return;
    loading = true;
    if (!window.fbq) {
      const fbq = window.fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
    }
    script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.referrerPolicy = 'strict-origin';
    script.onload = () => {
      loaded = true;
      loading = false;
      initialize(); // Recheck choice after download: a withdrawal wins the race.
    };
    script.onerror = () => { loading = false; };
    document.head.appendChild(script);
  }

  function removePixelCookies() {
    for (const name of ['_fbp', '_fbc']) {
      const expired = name + '=; Max-Age=0; Path=/; SameSite=Lax';
      try {
        document.cookie = expired;
        document.cookie = expired + '; Domain=' + location.hostname;
        document.cookie = expired + '; Domain=.' + location.hostname;
      } catch (_) { /* A browser that blocks cookies must still allow refusal. */ }
    }
  }

  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./meta-pixel.css', source.src).href;
  document.head.appendChild(sheet);
  const root = document.createElement('section');
  root.id = 'uk-meta-consent';
  root.setAttribute('aria-label', 'Meta 광고 쿠키 선택');
  // Fixed copy only; visitor inputs, URL values and IDs never enter the markup.
  root.innerHTML = `<div class="uk-meta-panel" id="uk-meta-panel" role="region" aria-labelledby="uk-meta-title">
    <h2 id="uk-meta-title">맞춤 광고를 위한 방문 정보 사용</h2>
    <p>영국유학센터 신촌점의 광고를 위해 Meta 픽셀로 페이지 방문 정보를 사용할 수 있습니다. 광고용 정보 사용은 선택 사항입니다.</p>
    <details><summary>어떤 정보가 사용되나요?</summary>
      <p>허용하면 페이지 방문 URL, 브라우저·기기 정보, IP 주소와 광고용 쿠키 식별자 등이 Meta에 전달될 수 있습니다. 이 사이트의 픽셀 코드는 상담 양식의 이름·학력·문의 내용을 전달하지 않습니다.</p>
      <p>선택값만 이 브라우저에 최대 180일 동안 저장합니다. ‘광고 쿠키 설정’에서 변경할 수 있으며, 철회 이후의 픽셀 전송을 중지합니다. 이미 전달된 정보는 소급해 취소되지 않습니다.</p>
      <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta 개인정보처리방침 ↗</a>
    </details>
    <div class="uk-meta-actions"><button type="button" data-choice="denied">허용 안 함</button><button type="button" data-choice="granted">허용</button></div>
  </div><button type="button" class="uk-meta-settings" aria-controls="uk-meta-panel" hidden>광고 쿠키 설정</button>
  <p class="uk-meta-announcement" role="status" aria-live="polite"></p>`;
  document.body.appendChild(root);
  const panel = root.querySelector('.uk-meta-panel');
  const settings = root.querySelector('.uk-meta-settings');
  const status = root.querySelector('[role="status"]');
  function display(open) {
    panel.hidden = !open;
    settings.hidden = open;
    settings.setAttribute('aria-expanded', String(open));
  }
  for (const button of root.querySelectorAll('[data-choice]')) {
    button.addEventListener('click', () => {
      choice = button.dataset.choice;
      try { localStorage.setItem(key, JSON.stringify({version: config.consentVersion, pixelId: config.pixelId, choice, at: Date.now()})); } catch (_) {}
      if (choice === 'granted') start();
      else {
        if (window.fbq && initialized) window.fbq('consent', 'revoke');
        removePixelCookies();
      }
      display(false);
      settings.focus({preventScroll: true});
      status.textContent = choice === 'granted' ? '광고용 방문 정보 사용을 허용했습니다.' : '광고용 방문 정보 사용을 허용하지 않았습니다.';
    });
  }
  settings.addEventListener('click', () => {
    display(true);
    root.querySelector('[data-choice="denied"]').focus({preventScroll: true});
  });
  display(choice === null);
  if (choice === 'granted') start();
  else if (choice === 'denied') removePixelCookies();
})();
