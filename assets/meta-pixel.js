/* Automatic PageView only. Never read consultation fields or send a Lead. */
(() => {
  'use strict';
  const config = window.UK_META_PIXEL_CONFIG;
  const hosts = ['uksinchon.com', 'www.uksinchon.com', 'localhost', '127.0.0.1'];
  if (!config || config.enabled !== true || typeof config.pixelId !== 'string' || !/^[1-9][0-9]{4,29}$/.test(config.pixelId) ||
      !hosts.includes(location.hostname) || !['https:', 'http:'].includes(location.protocol) ||
      (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname))) return;

  let loading = false;
  let loaded = false;
  let initialized = false;
  let sent = false;

  function safePage() {
    // Meta's PageView includes the URL. Suppress tracking on unexpected URLs
    // rather than forwarding unknown query parameters or private hash values.
    if (!['/', '/index.html', '/pharmacy/', '/pharmacy/index.html', '/seminar-2027/', '/seminar-2027/index.html'].includes(location.pathname)) return false;
    if (!['', '#main', '#guide', '#consultation', '#apply', '#seminar'].includes(location.hash)) return false;
    const url = new URL(location.href);
    for (const [name, value] of url.searchParams) {
      if (name === 'fbclid' && /^[A-Za-z0-9_.~-]{1,600}$/.test(value)) continue;
      if (/^utm_(source|medium|campaign|content|term)$/.test(name) && /^[A-Za-z0-9_-]{1,80}$/.test(value)) continue;
      return false;
    }
    return true;
  }

  function initialize() {
    if (!safePage() || !loaded) return;
    const fbq = window.fbq;
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
    if (!safePage()) return;
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
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.referrerPolicy = 'strict-origin';
    script.onload = () => {
      loaded = true;
      loading = false;
      initialize(); // Recheck the URL after the asynchronous download.
    };
    script.onerror = () => { loading = false; };
    document.head.appendChild(script);
  }

  // The site owner requested automatic loading without a consent interface.
  // Do not manufacture a visitor choice or write consent records.
  start();
})();
