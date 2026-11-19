"""Home UI against CMS_HOME_UI_FIXTURE only. No real Meta or form events."""
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
import json

BASE='http://127.0.0.1:8802'
checks=[]
def passed(name):checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def context(**options):
  c=browser.new_context(**options)
  def network(route):
   url=route.request.url
   if urlsplit(url).netloc!=urlsplit(BASE).netloc:route.abort()
   elif url.endswith('/assets/meta-pixel-config.js'):route.fulfill(status=200,content_type='application/javascript',body='window.UK_META_PIXEL_CONFIG={enabled:false};')
   else:route.continue_()
  c.route('**/*',network);return c
 admin=context()
 def api(path,body=None,method='GET'):
  r=admin.request.fetch(BASE+'/api/cms/'+path,method=method,data=body,headers={'Origin':BASE,'Content-Type':'application/json'})
  assert r.ok,(path,r.status,r.text());return r.json()
 api('login',{'email':'home-admin@example.test','password':'FictionalSeoPassword123!'},'POST')
 # Start visual checks with a real empty publication state, not fake article examples.
 for row in api('posts')['posts']:
  if row['published_revision']:api('posts/'+row['id']+'/unpublish',{'revision':row['revision']},'POST')
 c=context(viewport={'width':1366,'height':768});page=c.new_page();errors=[];posts=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:posts.append(r.url) if r.method=='POST' else None)
 r=page.goto(BASE+'/',wait_until='networkidle');assert r.status==200
 expect(page.locator('h1')).to_have_count(1)
 assert ' '.join(page.locator('h1').inner_text().split())=='영국 유학, 어학연수 내 조건에서 출발하세요.'
 for width,height in [(1280,720),(1366,768),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)')
  button=page.locator('.hero-actions .primary').first;box=button.bounding_box();assert box['y']+box['height']<height,(width,box)
  assert button.get_attribute('href')=='/counsel/'
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 passed('the exact requested headline and working consultation entry are visible above the fold at three PC viewport sizes')

 hero=page.locator('.hero-photo');expect(hero).to_have_js_property('complete',True)
 assert hero.evaluate('(e)=>e.naturalWidth>0')
 assert hero.bounding_box()['width']>400 and hero.bounding_box()['height']>350
 assert hero.get_attribute('fetchpriority')=='high'
 for photo in page.locator('.guide-photo').all():
  photo.scroll_into_view_if_needed();expect(photo).to_have_js_property('complete',True)
  assert photo.evaluate('(e)=>e.naturalWidth>0') and photo.get_attribute('loading')=='lazy'
 mobile=context(viewport={'width':390,'height':844},device_scale_factor=2)
 mobile_page=mobile.new_page();mobile_page.goto(BASE+'/',wait_until='networkidle')
 mobile_photo=mobile_page.locator('.hero-photo');expect(mobile_photo).to_have_js_property('complete',True)
 assert mobile_photo.bounding_box()['y']<120 and mobile_photo.bounding_box()['height']>200
 assert mobile_photo.evaluate('(e)=>e.currentSrc').endswith('/assets/home/london-768.webp')
 assert all(urlsplit(img.get_attribute('src')).netloc=='' for img in mobile_page.locator('img').all())
 mobile.close()
 passed('real photos load in the large PC hero and three course cards; mobile shows its smaller local photograph at the top without external image requests')

 for width in [320,360,390,430,768,1024]:
  page.set_viewport_size({'width':width,'height':950});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 page.set_viewport_size({'width':390,'height':844});page.locator('.mobile-menu summary').click();expect(page.locator('.mobile-menu nav')).to_be_visible()
 page.keyboard.press('Escape');assert not page.locator('.mobile-menu').evaluate('(e)=>e.open')
 assert page.locator('.mobile-menu summary').evaluate('(e)=>e===document.activeElement')
 page.locator('.mobile-menu summary').click();page.locator('.mobile-menu a[href="#team"]').click();assert not page.locator('.mobile-menu').evaluate('(e)=>e.open')
 assert page.url.endswith('#team');expect(page.locator('.mobile-contact')).to_be_visible();assert page.locator('.mobile-contact a').first.get_attribute('href')=='/counsel/'
 passed('mobile and tablet widths fit without horizontal overflow; the keyboard-accessible menu closes and the bottom contact bar remains available')

 page.locator('#team').scroll_into_view_if_needed()
 for name in ['이정민 지사장','이경민 실장','이경호 과장']:
  image=page.get_by_alt_text(name,exact=True);image.scroll_into_view_if_needed();expect(image).to_be_visible();expect(image).to_have_js_property('complete',True);assert image.evaluate('(e)=>e.naturalWidth>0')
 assert page.locator('.team-card').count()==3;assert page.locator('.story-card').count()==3
 for a in page.locator('.story-card a').all():assert a.get_attribute('href').startswith('https://www.ukcentre.co.kr/review/')
 assert '파고다' not in page.locator('body').inner_text()
 passed('three real staff photographs and the three verified Sinchon case links load; no placeholder portraits or removed seminar return')

 note_id=api('posts',{},'POST')['id']
 api('posts/'+note_id,{'schemaVersion':2,'title':'가상 메인 노트 — 직원 발행 검증','summary':'실제 운영 원고가 아닌 공개 HTML 확인용 가상 요약','contentType':'guide','category':'대학·파운데이션','delta':{'ops':[{'insert':'검증용 가상 본문입니다.\n'}]},'revision':1},'PUT')
 api('posts/'+note_id+'/publish',{'revision':2},'POST')
 nojs=context(java_script_enabled=False,viewport={'width':390,'height':844});plain=nojs.new_page();response=plain.goto(BASE+'/',wait_until='networkidle')
 assert '가상 메인 노트 — 직원 발행 검증' in response.text()
 expect(plain.locator('#home-notes h3')).to_have_text('가상 메인 노트 — 직원 발행 검증')
 assert plain.locator('.note-fallback').count()==0
 note=api('posts/'+note_id);api('posts/'+note_id+'/unpublish',{'revision':note['post']['revision']},'POST')
 plain.reload(wait_until='networkidle');expect(plain.locator('.note-fallback')).to_have_count(3)
 passed('a published note appears in initial HTML with JavaScript disabled, then disappears after unpublishing and leaves truthful topic fallbacks')

 page.goto(BASE+'/',wait_until='networkidle');page.locator('.hero-actions .primary').first.click();expect(page.locator('#counsel-form')).to_be_visible()
 assert page.url==BASE+'/counsel/';assert not posts,posts
 passed('the primary button opens the existing consultation form without sending a form submission or any real Meta event')

 page.set_viewport_size({'width':1440,'height':1000});page.goto(BASE+'/',wait_until='networkidle')
 # Load below-the-fold photographs before exporting a full-page preview.
 # Taking a full-page screenshot alone can capture lazy images before download.
 for image in page.locator('img').all():
  image.scroll_into_view_if_needed();expect(image).to_have_js_property('complete',True)
  assert image.evaluate('(e)=>e.naturalWidth>0')
 page.evaluate('scrollTo(0,0)');page.screenshot(path='/workspace/신촌점_따뜻한_메인_PC.png',full_page=True)
 page.set_viewport_size({'width':1366,'height':768});page.screenshot(path='/workspace/신촌점_따뜻한_첫화면_PC.png')
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/workspace/신촌점_따뜻한_메인_모바일.png',full_page=True)
 page.screenshot(path='/workspace/신촌점_따뜻한_첫화면_모바일.png')
 assert not errors,errors
 browser.close()
report={'passed':len(checks),'checks':checks,'testData':'fictional local CMS, real public staff assets; Meta disabled','productionDataModified':False}
Path('/workspace/신촌점_따뜻한_메인_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
