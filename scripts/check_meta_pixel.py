"""Browser checks with a mocked Meta library; sends no real events.

Requires Playwright and /usr/bin/chromium.
Run: python3 scripts/check_meta_pixel.py
"""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FAKE_ID = '123456789012345'
KEY = 'uk-sinchon-meta-consent'
checks = []


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def passed(name):
    checks.append(name)
    print('PASS', name, flush=True)


def run():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    worker = Thread(target=server.serve_forever, daemon=True)
    worker.start()
    base = 'http://127.0.0.1:' + str(server.server_port)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])

            def context(config=None, storage_blocked=False, delayed=False, failed=False, javascript=True):
                ctx = browser.new_context(viewport={'width':390,'height':950}, java_script_enabled=javascript)
                stats = {'meta_requests': 0, 'unexpected': []}
                if config is not None:
                    ctx.route('**/assets/meta-pixel-config.js', lambda route: route.fulfill(
                        status=200, content_type='application/javascript',
                        body='window.UK_META_PIXEL_CONFIG=' + json.dumps(config)))
                mock = """window.__metaCalls=window.__metaCalls||[];
window.fbq.callMethod=function(){window.__metaCalls.push(Array.from(arguments));};"""

                def network(route):
                    url = route.request.url
                    if url == 'https://connect.facebook.net/en_US/fbevents.js':
                        stats['meta_requests'] += 1
                        if failed:
                            route.abort()
                        elif delayed:
                            stats['held_route'] = route
                            stats['held_body'] = mock
                        else:
                            route.fulfill(status=200, content_type='application/javascript', body=mock)
                    elif urlsplit(url).netloc == urlsplit(base).netloc:
                        route.fallback()
                    else:
                        stats['unexpected'].append(url)
                        route.abort()
                ctx.route('**/*', network)
                if storage_blocked:
                    ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('test: storage blocked');}})")
                return ctx, stats

            def calls(page, pixel_id=FAKE_ID):
                page.wait_for_function("(window.__metaCalls||[]).some(x=>x[0]==='track')")
                actual = page.evaluate('window.__metaCalls')
                assert actual == [['set','autoConfig','false',pixel_id],['init',pixel_id],['track','PageView']], actual
                assert page.locator('#uk-meta-consent, .uk-meta-panel, .uk-meta-settings').count() == 0
                assert '맞춤 광고를 위한 방문 정보 사용' not in page.locator('body').inner_text()
                return actual

            enabled = {'enabled': True, 'pixelId': FAKE_ID}
            ctx,stats=context();page=ctx.new_page();page.goto(base+'/',wait_until='networkidle')
            actual=page.evaluate('window.UK_META_PIXEL_CONFIG')
            assert actual == {'enabled':True,'pixelId':'1634770791440664'}
            calls(page, actual['pixelId']);assert stats['meta_requests']==1
            ctx.close();passed('production ID starts automatically with no banner or fabricated consent call')

            ctx,stats=context({'enabled':False,'pixelId':FAKE_ID})
            page=ctx.new_page();page.goto(base+'/pharmacy/',wait_until='networkidle')
            assert stats['meta_requests']==0 and page.locator('#consultation-form').is_visible()
            assert page.locator('#uk-meta-consent').count()==0
            ctx.close();passed('disabled configuration leaves consultation usable without Meta requests')

            for invalid in [{}, {'enabled':True,'pixelId':''}, {'enabled':True,'pixelId':123456789012345},
                            {'enabled':True,'pixelId':'0'*15}]:
                ctx,stats=context(invalid);page=ctx.new_page();page.goto(base+'/pharmacy/',wait_until='networkidle')
                assert stats['meta_requests']==0
                ctx.close()
            passed('missing, numeric and invalid pixel IDs cannot initialize tracking')

            ctx,stats=context(enabled);page=ctx.new_page()
            for suffix in ['/', '/index.html', '/pharmacy/', '/pharmacy/index.html', '/seminar-2027/', '/seminar-2027/index.html#apply']:
                page.goto(base+suffix,wait_until='networkidle');calls(page)
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert stats['meta_requests']==6
            assert page.locator('[data-registration-link]').get_attribute('href').endswith('#seminar')
            ctx.close();passed('home, pharmacy and seminar routes initialize one PageView each without mobile overlays')

            ctx,stats=context(enabled);page=ctx.new_page();page.goto(base+'/pharmacy/',wait_until='networkidle')
            expected=calls(page)
            page.locator('#student-name').fill('가상 개인정보')
            page.locator('#education').select_option(label='아직 미정')
            page.locator('#entry').select_option(label='아직 미정')
            page.locator('#message').fill('가상 상담 자유 입력')
            page.get_by_role('button',name='상담 내용 만들기').click()
            assert page.evaluate('window.__metaCalls')==expected
            assert page.locator('#message-result').is_visible() and stats['unexpected']==[]
            assert page.evaluate('localStorage.length')==0
            ctx.close();passed('consultation still works and sends no fields, Lead or extra event; no consent record is written')

            for suffix in ['/pharmacy/?email=private%40example.test','/pharmacy/#private-student-data',
                           '/pharmacy/styles.css', '/pharmacy/?utm_source=private%40example.test']:
                ctx,stats=context(enabled);page=ctx.new_page();page.goto(base+suffix,wait_until='networkidle')
                assert stats['meta_requests']==0
                ctx.close()
            passed('unexpected URL queries, hashes and paths suppress Meta requests')

            ctx,stats=context(enabled);page=ctx.new_page()
            page.goto(base+'/pharmacy/?utm_source=studygroup&utm_medium=paid_social&fbclid=test_click_id',wait_until='networkidle')
            calls(page);assert stats['meta_requests']==1
            ctx.close();passed('valid campaign tags and click identifiers support automatic PageView')

            ctx,stats=context(enabled,storage_blocked=True);page=ctx.new_page()
            page.goto(base+'/pharmacy/',wait_until='networkidle');calls(page)
            assert page.locator('#consultation-form').is_visible()
            ctx.close();passed('automatic initialization works with browser storage blocked')

            ctx,stats=context(enabled);page=ctx.new_page();page.goto(base+'/',wait_until='networkidle');calls(page)
            for choice in ['denied','granted']:
                saved={'version':1,'pixelId':FAKE_ID,'choice':choice,'at':1}
                page.evaluate('(x)=>localStorage.setItem(x.key,JSON.stringify(x.data))', {'key':KEY,'data':saved})
                page.reload(wait_until='networkidle');calls(page)
                assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)==saved
            ctx.close();passed('legacy choice records are not read or rewritten as a visitor permission')

            ctx,stats=context(enabled,delayed=True);page=ctx.new_page()
            page.goto(base+'/pharmacy/',wait_until='domcontentloaded')
            page.wait_for_function("document.querySelector('script[src*=fbevents]') !== null")
            page.wait_for_timeout(100)
            assert stats.get('held_route') is not None
            page.evaluate("history.replaceState(null,'','?email=private%40example.test')")
            stats['held_route'].fulfill(status=200,content_type='application/javascript',body=stats['held_body'])
            page.wait_for_function('window.__metaCalls !== undefined')
            assert page.evaluate('window.__metaCalls')==[]
            ctx.close();passed('URL is rechecked after a delayed library download before initializing')

            ctx,stats=context(enabled,failed=True);page=ctx.new_page();errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(base+'/pharmacy/',wait_until='networkidle')
            assert page.locator('#consultation-form').is_visible() and not errors
            ctx.close();passed('a blocked Meta library does not break the consultation page')

            ctx,stats=context(enabled,javascript=False);page=ctx.new_page()
            page.goto(base+'/seminar-2027/',wait_until='networkidle')
            assert stats['meta_requests']==0
            assert page.locator('[data-registration-link]').is_visible()
            assert page.locator('#uk-meta-consent').count()==0
            ctx.close();passed('JavaScript-disabled seminar retains official application link without a tracking image')
            browser.close()
    finally:
        server.shutdown();server.server_close();worker.join(timeout=5)
    print(json.dumps({'passed':len(checks),'checks':checks,'real_meta_events_sent':False},ensure_ascii=False,indent=2))


if __name__=='__main__':
    run()
