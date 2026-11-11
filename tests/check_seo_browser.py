"""Browser workflow against the fictional local SEO fixture only."""
from pathlib import Path
from PIL import Image
import json,re,time,sys
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8796'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
PASS='FictionalSeoPassword123!';TEMP='FictionalTemporaryPassword123!'
email='seo-writer-'+str(time.time_ns())+'@example.test'
title='검증용 비교 안내 · '+str(time.time_ns())
photo=Path('/tmp/seo-browser-fixture.png');Image.new('RGB',(2000,1200),(140,175,160)).save(photo)
checks=[]
def passed(name):checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 admin=browser.new_context(viewport={'width':1440,'height':1050});a=admin.new_page();errors=[]
 a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('seo-admin@example.test');a.locator('#password').fill(PASS);a.locator('#auth-submit').click();a.locator('#workspace').wait_for(state='visible')
 a.locator('#users-tab').click();a.locator('#user-name').fill('가상 SEO 직원');a.locator('#user-email').fill(email);a.locator('#user-password').fill(TEMP);a.get_by_role('button',name='계정 만들기',exact=True).click();a.get_by_text(email,exact=False).wait_for()
 staff=browser.new_context(viewport={'width':390,'height':844});s=staff.new_page();s.on('pageerror',lambda e:errors.append(str(e)))
 s.goto(BASE+'/admin/',wait_until='networkidle');s.locator('#email').fill(email);s.locator('#password').fill(TEMP);s.locator('#auth-submit').click();s.locator('#password-view').wait_for(state='visible');s.locator('#old-password').fill(TEMP);s.locator('#new-password').fill(PASS);s.locator('#new-password-again').fill(PASS);s.get_by_role('button',name='변경하기',exact=True).click();s.locator('#workspace').wait_for(state='visible')
 s.locator('#new-post').click();s.locator('#title').fill(title);s.locator('.ql-editor').fill('실제 학교 정보가 아닌 가상 비교 글입니다. 조건과 단위를 확인합니다.\n')
 s.locator('#content-type').select_option('comparison');s.locator('#applies-to').fill('가상 2027 학년도 · 동일 수업량과 숙소 조건');s.locator('#verified-at').fill('2026-11-02');s.locator('#review-scope').fill('검증용 공식 자료의 기간·수업량·포함/제외 대조');s.locator('#review-due').fill('2026-12-01')
 s.locator('#add-source').click();row=s.locator('.source-detail').first;row.get_by_label('자료 제목',exact=True).fill('가상 기관 공식 안내');row.get_by_label('자료 주소',exact=True).fill('https://example.org/official');row.get_by_label('자료 발행 기관',exact=True).fill('가상 기관')
 s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 assert s.locator('#fact-review-panel').is_hidden()
 passed('staff writes a comparison draft with scope, official sources and genuine confirmation dates; approval controls remain admin-only')
 s.locator('#image-file').set_input_files(str(photo));expect(s.locator('#notice')).to_have_text('사진과 글을 공동 DB에 저장했습니다.')
 expect(s.locator('.image-detail')).to_have_count(1);s.locator('#image-metadata-panel > summary').click();s.get_by_label('독자에게 전달할 사진 설명',exact=True).fill('검증용으로 직접 만든 초록색 이미지');s.get_by_label('사진 아래에 보일 설명 · 선택',exact=True).fill('실제 학교 사진이 아닙니다.');s.get_by_label('사용 근거 · 예: 직접 촬영, 학교의 사용 허락',exact=True).fill('직접 생성한 가상 검증 이미지')
 s.locator('#hero-image').select_option(index=1)
 # Seed a saved legacy comparison table to verify its existing edit dialog remains usable.
 s.evaluate('''()=>{const q=Quill.find(document.querySelector('#rich-editor'));q.insertEmbed(q.getLength()-1,'comparisonTable',{caption:'가상 동일 조건 비교',columns:['항목','선택지 A','선택지 B'],rows:[['기간','가상 12주','가상 12주'],['숙소','미확인','미확인']],notes:'실제 가격과 학교 조건이 아닌 테스트입니다.',source:''},'user');}''')
 expect(s.locator('.comparison-table-blot')).to_have_count(1)
 s.get_by_role('button',name='가상 동일 조건 비교 표 수정',exact=True).click();s.locator('#table-notes').fill('포함·제외 항목을 따로 확인하는 가상 표입니다.');s.get_by_role('button',name='표 반영하기',exact=True).click();s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 passed('image conversion, contextual alt/rights, hero selection and editable safe comparison tables save through the staff UI')
 for width in [320,375,390,768,1440]:
  s.set_viewport_size({'width':width,'height':950});assert not s.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 s.set_viewport_size({'width':390,'height':844});s.screenshot(path='/workspace/SEO_직원편집기_모바일.png',full_page=True)
 s.locator('#review').click();expect(s.locator('#notice')).to_have_text(re.compile('^관리자에게 검토'))
 s.reload(wait_until='networkidle');s.get_by_role('button',name=title,exact=True).click();s.locator('#editor-view').wait_for(state='visible');expect(s.locator('.comparison-table-blot')).to_have_count(1);assert s.get_by_label('독자에게 전달할 사진 설명',exact=True).input_value()=='검증용으로 직접 만든 초록색 이미지';assert s.locator('.source-detail').count()==1
 passed('rich text, table, source metadata and image descriptions survive reload without horizontal overflow at mobile and PC sizes')
 a.locator('#posts-tab').click();a.locator('#search').fill(title);a.get_by_role('button',name='검색',exact=True).click();a.get_by_role('button',name=title,exact=True).click();a.locator('#editor-view').wait_for(state='visible')
 with a.expect_popup() as popup:a.locator('#preview').click()
 v=popup.value;v.wait_for_load_state('networkidle');expect(v.locator('table caption')).to_have_text('가상 동일 조건 비교');assert v.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow';v.close()
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_have_text(re.compile('.*사실 확인.*'))
 for key in ['facts','conditions','rights']:a.locator('#fact-check-'+key).check()
 a.locator('#record-facts').click();expect(a.locator('#fact-review-state')).to_have_text(re.compile('현재 버전 확인 기록'))
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();a.locator('#public-link').wait_for(state='visible');public_url=a.locator('#public-link').get_attribute('href');a.screenshot(path='/workspace/SEO_관리자_검토화면.png',full_page=True)
 passed('preview stays private; publication is rejected before current fact review and succeeds only after human review plus separate approval')
 public=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});v=public.new_page();r=v.goto(BASE+public_url,wait_until='networkidle');assert r.status==200
 expect(v.get_by_role('heading',name=title,exact=True)).to_be_visible();expect(v.locator('table caption')).to_have_text('가상 동일 조건 비교');assert v.locator('.article-body img').get_attribute('alt')=='검증용으로 직접 만든 초록색 이미지';assert v.locator('.article-body img').get_attribute('width')=='1600';assert v.locator('.fact-review').inner_text().find('가상 관리자')>=0
 assert not v.evaluate('document.documentElement.scrollWidth>innerWidth');v.screenshot(path='/workspace/SEO_공개글_모바일.png',full_page=True)
 v.set_viewport_size({'width':1440,'height':1050});v.screenshot(path='/workspace/SEO_공개글_PC.png',full_page=True)
 passed('published source HTML works without JavaScript, with readable table, truthful image dimensions, reviewer and mobile layout')
 a.locator('#title').fill(title+' 오탈자 교정');a.get_by_text('함께 읽을 글·수정 기록',exact=True).click();a.locator('#change-kind').select_option('minor');a.locator('#change-note').fill('가상의 제목 오탈자만 교정');a.locator('#save').click();expect(a.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 v.reload(wait_until='networkidle');expect(v.get_by_role('heading',name=title,exact=True)).to_be_visible();assert '현재 버전의 사실 확인 기록이 없습니다' in a.locator('#fact-review-state').inner_text()
 a.route('**/api/cms/posts/*',lambda route:route.abort() if route.request.method=='PUT' else route.continue_())
 a.locator('#summary').fill('저장 실패 후 보관할 가상 메타데이터');a.locator('#save').click();expect(a.locator('#save-state')).to_have_text(re.compile('^저장 실패'));a.get_by_text('수정 이력·원고 보관',exact=True).click()
 with a.expect_download() as download:a.locator('#download-draft').click()
 data=json.loads(Path(download.value.path()).read_text());assert data['schemaVersion']==2;assert data['sourceDetails'][0]['title']=='가상 기관 공식 안내';assert any(op.get('insert',{}).get('comparisonTable') for op in data['delta']['ops'] if isinstance(op.get('insert'),dict));assert data['imageMeta']
 a.unroute('**/api/cms/posts/*');a.once('dialog',lambda d:d.accept());a.locator('#draft-file').set_input_files(download.value.path());expect(a.locator('#notice')).to_have_text('보관한 원고를 새 버전으로 저장했습니다.');expect(a.locator('.comparison-table-blot')).to_have_count(1)
 passed('new draft leaves the approved page live and invalidates review; full v2 metadata and tables recover from a saved draft after network failure')
 assert not errors,errors
 browser.close()
report={'passed':len(checks),'checks':checks,'productionPostsPublished':0,'realHumanContentApproval':False,'testData':'fictional local accounts, sources and images'}
Path('/workspace/SEO_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
