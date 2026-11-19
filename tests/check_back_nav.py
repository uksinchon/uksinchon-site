"""Mobile back button on sub pages, against CMS_HOME_UI_FIXTURE (8802) only. No real data or form events."""
from playwright.sync_api import sync_playwright, expect
from urllib.parse import urlsplit
import subprocess,sys,time,atexit
BASE='http://127.0.0.1:8802'
# Pages the CMS fixture does not serve are checked on a plain static server of the repository.
STATIC='http://127.0.0.1:8807'
srv=subprocess.Popen([sys.executable,'-m','http.server','8807','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);atexit.register(srv.terminate);time.sleep(1)
checks=[]
def passed(n):checks.append(n);print('PASS',n,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def ctx(**o):
  c=b.new_context(**o)
  c.route('**/*',lambda r:r.abort() if urlsplit(r.request.url).netloc not in (urlsplit(BASE).netloc,urlsplit(STATIC).netloc) else (r.fulfill(status=200,content_type='application/javascript',body='window.UK_META_PIXEL_CONFIG={enabled:false};') if r.request.url.endswith('meta-pixel-config.js') else r.continue_()))
  return c
 m=ctx(viewport={'width':390,'height':844});pg=m.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 # home and diagnosis tools: no extra back button
 for path in ['/','/study-path/','/hello-uk/']:
  pg.goto(BASE+path,wait_until='networkidle');assert pg.locator('.uk-back').count()==0,path
 passed('home and the two diagnosis tools keep their own navigation without an extra back button')
 # every sub page shows it inside the header on mobile
 for path in ['/blog/','/counsel/','/counsel/privacy.html','/pharmacy/','/seminar-2027/']:
  pg.goto((STATIC if path in ('/pharmacy/','/seminar-2027/') else BASE)+path,wait_until='networkidle');btn=pg.locator('.uk-back');expect(btn).to_have_count(1);expect(btn).to_be_visible()
  box=btn.bounding_box();assert box['y']<90 and box['x']<60,(path,box)
  assert not pg.evaluate('document.documentElement.scrollWidth>innerWidth'),path
 passed('blog, counsel, privacy, pharmacy and seminar pages show a visible back button at the top left on mobile without overflow')
 # goes back to the page the visitor came from
 pg.goto(BASE+'/',wait_until='networkidle');pg.locator('.hero-actions a[href="/counsel/"]').first.click();pg.wait_for_url(BASE+'/counsel/')
 pg.locator('.uk-back').click();pg.wait_for_url(BASE+'/');passed('the button returns to the previous page (counsel → home)')
  # direct visit with no previous page falls back to home
 fresh=m.new_page();fresh.goto(BASE+'/counsel/',wait_until='networkidle');fresh.locator('.uk-back').click();fresh.wait_for_url(BASE+'/')
 passed('opened directly with no previous page, the button falls back to the home page')
 # hidden on desktop
 d=ctx(viewport={'width':1366,'height':800}).new_page();d.goto(BASE+'/blog/',wait_until='networkidle');assert not d.locator('.uk-back').is_visible()
 passed('the button is hidden on desktop widths')
 assert not errors,errors
 b.close()
print({'passed':len(checks)})
