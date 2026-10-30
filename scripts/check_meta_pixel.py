"""Browser checks with a fake ID and mocked Meta library; sends no real events.

Requires the development environment's Playwright and /usr/bin/chromium.
Run: python3 scripts/check_meta_pixel.py
"""
import json
import time
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

            def context(config=None, storage_blocked=False, delayed=False):
                ctx = browser.new_context(viewport={'width':390,'height':950}, reduced_motion='reduce')
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
                        if delayed:
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

            enabled = {'enabled': True, 'pixelId': FAKE_ID, 'consentVersion': 1}
            ctx, stats = context()
            page = ctx.new_page(); page.goto(base+'/pharmacy/', wait_until='networkidle')
            assert page.locator('#uk-meta-consent').count() == 0 and stats['meta_requests'] == 0
            assert page.locator('#consultation-form').is_visible()
            ctx.close(); passed('production configuration is disabled: no Meta, no consent popup, consultation intact')

            for invalid in [{'enabled':True,'pixelId':'','consentVersion':1},
                            {'enabled':True,'pixelId':123456789012345,'consentVersion':1},
                            {'enabled':True,'pixelId':'0'*15,'consentVersion':1}]:
                ctx, stats = context(invalid)
                page=ctx.new_page();page.goto(base+'/pharmacy/',wait_until='networkidle')
                assert stats['meta_requests']==0 and page.locator('#uk-meta-consent').count()==0
                ctx.close()
            passed('missing, numeric and invalid pixel IDs cannot initialize tracking')

            ctx, stats = context(enabled)
            page=ctx.new_page(); page.goto(base+'/pharmacy/', wait_until='networkidle')
            assert page.locator('.uk-meta-panel').is_visible() and stats['meta_requests']==0
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert page.locator('.uk-meta-panel').bounding_box()['y']>=0
            page.get_by_role('button', name='허용 안 함', exact=True).click()
            assert stats['meta_requests']==0 and page.evaluate('typeof window.fbq')=='undefined'
            page.reload(wait_until='networkidle')
            assert not page.locator('.uk-meta-panel').is_visible() and stats['meta_requests']==0
            assert page.locator('.uk-meta-settings').is_visible()
            passed('before consent and after persisted refusal: no Meta script; mobile preference access works')

            page.get_by_role('button',name='광고 쿠키 설정').click()
            page.get_by_role('button',name='허용',exact=True).click()
            page.wait_for_function("(window.__metaCalls||[]).some(x=>x[0]==='track')")
            calls=page.evaluate('window.__metaCalls')
            assert calls==[['consent','grant'],['set','autoConfig','false',FAKE_ID],['init',FAKE_ID],['track','PageView']],calls
            assert stats['meta_requests']==1
            saved=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)
            assert set(saved)=={'version','pixelId','choice','at'} and saved['choice']=='granted'
            passed('explicit grant: one script, automatic logging disabled, init without user matching, one PageView')

            page.locator('#student-name').fill('가상 개인정보')
            page.locator('#education').select_option(label='아직 미정')
            page.locator('#entry').select_option(label='아직 미정')
            page.locator('#message').fill('가상 상담 자유 입력')
            page.get_by_role('button',name='상담 내용 만들기').click()
            assert page.evaluate('window.__metaCalls')==calls
            assert page.locator('#message-result').is_visible()
            passed('consultation content creation sends no input fields, Lead or extra Meta event')

            page.evaluate("document.cookie='_fbp=test-only; Path=/'; document.cookie='_fbc=test-only; Path=/'")
            page.get_by_role('button',name='광고 쿠키 설정').click()
            page.get_by_role('button',name='허용 안 함',exact=True).click()
            assert page.evaluate('window.__metaCalls').pop()==['consent','revoke']
            assert '_fbp=' not in page.evaluate('document.cookie') and '_fbc=' not in page.evaluate('document.cookie')
            assert page.locator('#message').input_value()=='가상 상담 자유 입력'
            page.reload(wait_until='networkidle')
            assert stats['meta_requests']==1
            ctx.close(); passed('withdrawal revokes consent and expires first-party pixel cookies without erasing the form')

            for suffix in ['/pharmacy/?email=private%40example.test','/pharmacy/#private-student-data']:
                ctx,stats=context(enabled);page=ctx.new_page();page.goto(base+suffix,wait_until='networkidle')
                page.get_by_role('button',name='허용',exact=True).click()
                assert stats['meta_requests']==0
                ctx.close()
            passed('unexpected query and hash values suppress Meta requests even after grant')

            ctx,stats=context(enabled);page=ctx.new_page()
            page.goto(base+'/pharmacy/?utm_source=studygroup&utm_medium=paid_social&fbclid=test_click_id',wait_until='networkidle')
            page.get_by_role('button',name='허용',exact=True).click()
            page.wait_for_function("(window.__metaCalls||[]).some(x=>x[0]==='track')")
            assert stats['meta_requests']==1
            assert page.evaluate('window.__metaCalls').pop()==['track','PageView']
            ctx.close();passed('normal campaign and click identifiers support consented PageView')

            ctx,stats=context(enabled,storage_blocked=True);page=ctx.new_page()
            page.goto(base+'/pharmacy/',wait_until='networkidle')
            page.get_by_role('button',name='허용 안 함',exact=True).click()
            assert not page.locator('.uk-meta-panel').is_visible() and stats['meta_requests']==0
            assert page.locator('#consultation-form').is_visible()
            page.reload(wait_until='networkidle')
            assert page.locator('.uk-meta-panel').is_visible() and stats['meta_requests']==0
            ctx.close();passed('blocked browser storage keeps refusal usable and never defaults to consent')

            ctx,stats=context(enabled,delayed=True);page=ctx.new_page()
            page.goto(base+'/pharmacy/',wait_until='networkidle')
            page.get_by_role('button',name='허용',exact=True).click()
            page.get_by_role('button',name='광고 쿠키 설정').click()
            page.get_by_role('button',name='허용 안 함',exact=True).click()
            assert stats.get('held_route') is not None
            stats['held_route'].fulfill(status=200,content_type='application/javascript',body=stats['held_body'])
            page.wait_for_function('window.__metaCalls !== undefined')
            assert page.evaluate('window.__metaCalls')==[]
            ctx.close();passed('withdrawal during library download prevents later init and PageView')

            ctx,stats=context(enabled);page=ctx.new_page();page.goto(base+'/',wait_until='networkidle')
            page.get_by_role('button',name='허용',exact=True).click()
            page.wait_for_function("(window.__metaCalls||[]).some(x=>x[0]==='track')")
            page.locator('.pharmacy-link').click()
            page.wait_for_function("(window.__metaCalls||[]).some(x=>x[0]==='track')")
            assert not page.locator('.uk-meta-panel').is_visible()
            assert stats['meta_requests']==2
            assert [x for x in page.evaluate('window.__metaCalls') if x[0]=='track']==[['track','PageView']]
            ctx.close();passed('home-to-pharmacy navigation preserves consent and records one view per document')

            ctx,stats=context(enabled);page=ctx.new_page();page.goto(base+'/pharmacy/',wait_until='networkidle')
            for version,at in [(1,1),(999,int(time.time()*1000)),(1,9999999999999)]:
                page.evaluate('(x)=>localStorage.setItem(x.key,JSON.stringify(x.data))',{'key':KEY,'data':{
                    'choice':'granted','version':version,'pixelId':FAKE_ID,'at':at}})
                page.reload(wait_until='networkidle')
                assert page.locator('.uk-meta-panel').is_visible() and stats['meta_requests']==0
            ctx.close();passed('expired, changed-policy and invalid future consent records do not auto-track')
            browser.close()
    finally:
        server.shutdown();server.server_close();worker.join(timeout=5)
    print(json.dumps({'passed':len(checks),'checks':checks,'real_meta_events_sent':False},ensure_ascii=False,indent=2))


if __name__=='__main__':
    run()
