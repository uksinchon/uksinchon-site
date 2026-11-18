"""Staff self-publication UI; run against CMS_STAFF_PUBLISH_UI_FIXTURE only."""
from pathlib import Path
from urllib.parse import quote
from PIL import Image
from playwright.sync_api import sync_playwright, expect
import json, re, time
BASE='http://127.0.0.1:8800'
PASSWORD='FictionalSeoPassword123!'
title='직원 직접 발행 화면 검증 '+str(time.time_ns())
photo=Path('/tmp/staff-publish-photo.png');Image.new('RGB',(1800,1000),(130,165,180)).save(photo)
checks=[]
def passed(name):checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 staff=browser.new_context(viewport={'width':390,'height':844});s=staff.new_page();errors=[];actions=[]
 s.on('pageerror',lambda e:errors.append(str(e)))
 s.on('request',lambda r:actions.append(r.url) if r.method=='POST' else None)
 s.goto(BASE+'/admin/',wait_until='networkidle');s.locator('#email').fill('staff-writer@example.test');s.locator('#password').fill(PASSWORD);s.locator('#auth-submit').click();expect(s.locator('#workspace')).to_be_visible()
 for key in ['users-tab','naver-tab','counsel-tab','trash-view']:expect(s.locator('#'+key)).to_be_hidden()
 s.locator('#new-post').click();expect(s.locator('#publish')).to_be_visible();expect(s.locator('#publish')).to_have_text('발행하기');expect(s.locator('#publication-note')).to_contain_text('검토 요청 없이');assert s.locator('#fact-review-panel,#record-facts,[id^=fact-check-],#review-scope').count()==0
 passed('staff see the primary direct-publish button while account, import, inquiry and trash administration stay hidden')

 s.locator('#title').fill(title);s.locator('.ql-editor').fill('실제 학생이나 학교 정보가 아닌 직원 직접 발행 화면 검증용 가상 글입니다.\n');s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 s.locator('#image-file').set_input_files(str(photo));expect(s.locator('#notice')).to_have_text('사진과 글을 공동 DB에 저장했습니다.')
 s.locator('#image-metadata-panel > summary').click();s.get_by_label('독자에게 전달할 사진 설명',exact=True).fill('직접 생성한 가상 검증 이미지');s.get_by_label('사용 근거 · 예: 직접 촬영, 학교의 사용 허락',exact=True).fill('직접 생성한 가상 이미지')
 source=s.get_by_label('사진 출처 · 선택 (주소 또는 설명)',exact=True);assert source.get_attribute('type')=='text';source.fill('www.example.org/학교사진')
 s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 with s.expect_popup() as popup:s.locator('#preview').click()
 preview=popup.value;preview.wait_for_load_state('networkidle');assert preview.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow';expect(preview.locator('.image-source')).to_have_text('사진 출처: www.example.org/학교사진');assert preview.locator('.image-source a').count()==0;preview.close()
 s.once('dialog',lambda d:d.accept());s.locator('#publish').click();expect(s.locator('#notice')).to_have_text(re.compile('^공개했습니다'));expect(s.locator('#public-link')).to_be_visible();url=s.locator('#public-link').get_attribute('href');expect(s.locator('#publish')).to_have_text('수정 내용 발행하기')
 assert not any(u.endswith('/review') for u in actions)
 public=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});v=public.new_page();assert v.goto(BASE+url,wait_until='networkidle').status==200;expect(v.get_by_role('heading',name=title,exact=True)).to_be_visible();expect(v.locator('.article-body img')).to_be_visible()
 expect(v.locator('.image-source')).to_have_text('사진 출처: www.example.org/학교사진');assert v.locator('.image-source a').count()==0
 listing=public.new_page();listing.goto(BASE+'/blog/',wait_until='networkidle');expect(listing.get_by_role('link',name=title,exact=True)).to_be_visible()
 passed('a staff writer previews and directly publishes text and an owned photo; anonymous readers see the article and list without a review request')

 for width in [320,390,768,1440]:
  for page in [s,v]:
   page.set_viewport_size({'width':width,'height':950});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 s.screenshot(path='/workspace/직원_직접발행_편집기.png',full_page=True)
 s.locator('#title').fill(title+' 수정');s.get_by_text('함께 읽을 글·수정 기록',exact=True).click();s.locator('#change-kind').select_option('minor');s.locator('#change-note').fill('가상 오탈자 수정');s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 v.reload(wait_until='networkidle');expect(v.get_by_role('heading',name=title,exact=True)).to_be_visible()
 s.once('dialog',lambda d:d.accept());s.locator('#publish').click();expect(s.locator('#notice')).to_have_text(re.compile('^공개했습니다'));assert s.locator('#public-link').get_attribute('href')==url
 v.reload(wait_until='networkidle');expect(v.get_by_role('heading',name=title+' 수정',exact=True)).to_be_visible()
 passed('staff edit and republish on the same URL with a private draft in between; editor and public page fit mobile and PC widths')

 s.once('dialog',lambda d:d.accept());s.locator('#unpublish').click();expect(s.locator('#notice')).to_have_text(re.compile('^공개를 내렸습니다'));expect(s.locator('#public-link')).to_be_hidden();expect(s.locator('#publish')).to_have_text('발행하기')
 assert v.reload(wait_until='networkidle').status==404
 passed('the same staff writer can take their article down while keeping an editable draft')

 s.locator('#back-list').click();s.locator('#new-post').click();s.locator('#title').fill(title+' 조건 안내');s.locator('.ql-editor').fill('직원이 스스로 공식 자료를 대조하는 가상의 조건 안내입니다.\n');s.locator('#content-type').select_option('guide')
 s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'));assert s.locator('#fact-review-panel,#record-facts,[id^=fact-check-],#review-scope').count()==0
 s.once('dialog',lambda d:d.accept());s.locator('#publish').click();expect(s.locator('#notice')).to_have_text(re.compile('^공개했습니다'))
 guide_url=s.locator('#public-link').get_attribute('href');v.goto(BASE+guide_url,wait_until='networkidle');assert v.locator('.fact-review').count()==0
 assert not any(u.endswith(('/review','/factcheck')) for u in actions);assert not errors,errors
 passed('the scope input is absent and a guide publishes with dates, sources and applicability empty, without checklist calls or invented review metadata')
 s.locator('#back-list').click();s.get_by_role('button',name='이전 범위 보관 가상 글',exact=True).click();expect(s.locator('#editor-view')).to_be_visible();assert s.locator('#review-scope').count()==0
 s.locator('#summary').fill('기존 숨은 검토 메타 보존을 확인하는 가상 요약');s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 rows=s.request.get(BASE+'/api/cms/posts?q='+quote('이전 범위 보관 가상 글')).json()['posts']
 retained=s.request.get(BASE+'/api/cms/posts/'+rows[0]['id']).json();assert retained['snapshot']['reviewScope']=='기존 원고에 남아 있는 실제 범위'
 passed('an older scope value survives an editor reload and save without presenting the removed question')
 assert not errors,errors
 browser.close()
report={'passed':len(checks),'checks':checks,'testData':'fictional local accounts, sources and photo','productionDataModified':False}
Path('/workspace/직원_직접발행_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
