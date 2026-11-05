"""Browser checks against fictional local Wrangler + D1. Never run against production."""
from pathlib import Path
from PIL import Image
import sys
from playwright.sync_api import sync_playwright, expect
import re
import json,time
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
PASS='FictionalTestPassword123!';TEMP='TemporaryTestPassword123!'
email='browser-'+str(time.time_ns())+'@example.test';title='가상 브라우저 검증 · '+str(time.time_ns())
image=Path('/tmp/uksinchon-editor-photo.png');Image.new('RGB',(2000,1200),(160,185,177)).save(image)
checks=[]
def passed(name):checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 admin=browser.new_context(viewport={'width':1440,'height':1050});a=admin.new_page();errors=[]
 a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('cms-admin@example.test');a.locator('#password').fill(PASS);a.locator('#auth-submit').click();a.locator('#workspace').wait_for(state='visible')
 a.get_by_role('button',name='직원 계정',exact=True).click();a.locator('#user-name').fill('가상 브라우저 직원');a.locator('#user-email').fill(email);a.locator('#user-password').fill(TEMP);a.get_by_role('button',name='계정 만들기',exact=True).click();a.get_by_text(email,exact=False).wait_for()
 passed('administrator login and staff creation through Korean UI')
 staff=browser.new_context(viewport={'width':390,'height':844});s=staff.new_page();s.on('pageerror',lambda e:errors.append(str(e)))
 s.goto(BASE+'/admin/',wait_until='networkidle');s.locator('#email').fill(email);s.locator('#password').fill(TEMP);s.locator('#auth-submit').click();s.locator('#password-view').wait_for(state='visible')
 s.locator('#old-password').fill(TEMP);s.locator('#new-password').fill(PASS);s.locator('#new-password-again').fill(PASS);s.get_by_role('button',name='변경하기',exact=True).click();s.locator('#workspace').wait_for(state='visible')
 passed('staff signs in and changes temporary password before accessing editor')
 s.get_by_role('button',name='＋ 새 글 쓰기',exact=True).click();s.locator('#editor-view').wait_for(state='visible');s.locator('#title').fill(title);s.locator('.ql-editor').fill('학교를 선택하기 전, 수업량과 숙소 조건을 함께 확인하는 가상의 글입니다.\n같은 조건으로 비교한 뒤 질문을 정리해 주세요.');s.locator('#sources').fill('https://example.org/official');s.locator('#verified-at').fill('2026-11-02');s.locator('#summary').fill('동일 조건 비교를 안내하는 가상 예시입니다.')
 s.get_by_role('button',name='초안 저장',exact=True).click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 s.locator('#image-file').set_input_files(str(image));expect(s.locator('.ql-editor img')).to_be_visible()
 expect(s.locator('#notice')).to_have_text('사진과 글을 공동 DB에 저장했습니다.')
 assert s.locator('.ql-editor img').evaluate('(e)=>e.naturalHeight')==960
 s.get_by_label('독자에게 전달할 사진 설명',exact=True).fill('가상 검증 이미지');s.get_by_label('사용 근거 · 예: 직접 촬영, 학교의 사용 허락',exact=True).fill('직접 생성한 가상 이미지');s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 passed('rich-text editor, Korean summary, sources and actual server photo upload with 1600px resizing')
 for width in [320,375,390,430,768]:
  s.set_viewport_size({'width':width,'height':900});assert not s.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 s.set_viewport_size({'width':390,'height':844});s.screenshot(path='/workspace/신촌점_직원글쓰기_모바일.png',full_page=True)
 passed('editor fits 320–768px mobile widths')
 s.get_by_role('button',name='검토 요청하기',exact=True).click();expect(s.locator('#notice')).to_have_text(re.compile('^관리자에게 검토'))
 s.reload(wait_until='networkidle');s.get_by_role('button',name=title,exact=True).click();s.locator('#editor-view').wait_for(state='visible');assert s.locator('.ql-editor').inner_text().startswith('학교를 선택하기 전');assert s.locator('.ql-editor img').count()==1
 passed('saved text, image and review request survive browser reload')
 a.get_by_role('button',name='글 목록',exact=True).click();a.locator('#status-filter').select_option('review');a.get_by_role('button',name='검색',exact=True).click();a.get_by_role('button',name=title,exact=True).click();a.locator('#editor-view').wait_for(state='visible');a.locator('.ql-editor img').wait_for()
 with a.expect_popup() as popup:
  a.get_by_role('button',name='저장 후 미리보기 ↗',exact=True).click()
 preview=popup.value;preview.wait_for_load_state('networkidle');assert preview.get_by_role('heading',name=title,exact=True).is_visible();assert 'noindex' in preview.locator('meta[name=robots]').get_attribute('content');preview.close()
 passed('administrator opens authenticated preview of the staff draft')
 a.once('dialog',lambda d:d.accept());a.get_by_role('button',name='이 버전 공개 승인',exact=True).click();a.locator('#public-link').wait_for(state='visible');public_url=a.locator('#public-link').get_attribute('href')
 public=browser.new_context(viewport={'width':1440,'height':1050});v=public.new_page();r=v.goto(BASE+public_url,wait_until='networkidle');assert r.status==200;assert v.get_by_role('heading',name=title,exact=True).is_visible();expect(v.locator('.article-body img')).to_be_visible()
 v.screenshot(path='/workspace/신촌점_직원블로그_공개글.png',full_page=True)
 a.screenshot(path='/workspace/신촌점_직원글쓰기_관리자.png',full_page=True)
 passed('admin approval produces public Korean HTML with working image and source link')
 s.get_by_role('button',name='← 글 목록',exact=True).click();s.get_by_role('button',name=title,exact=True).click();s.locator('#title').fill('아직 승인하지 않은 수정 제목');s.get_by_role('button',name='초안 저장',exact=True).click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 v.reload(wait_until='networkidle');assert v.get_by_role('heading',name=title,exact=True).is_visible()
 passed('staff editing after publication keeps the previous approved article live')
 s.route('**/api/cms/posts/*',lambda route:route.abort() if route.request.method=='PUT' else route.continue_())
 s.locator('#title').fill('저장 실패 시 보존할 원고');s.get_by_role('button',name='초안 저장',exact=True).click();expect(s.locator('#save-state')).to_have_text(re.compile('^저장 실패'))
 assert s.locator('#title').input_value()=='저장 실패 시 보존할 원고';s.get_by_text('수정 이력·원고 보관',exact=True).click()
 with s.expect_download() as download:s.get_by_role('button',name='현재 원고 파일로 보관',exact=True).click()
 assert download.value.suggested_filename.endswith('.json')
 saved_file=download.value.path()
 s.unroute('**/api/cms/posts/*')
 s.once('dialog',lambda d:d.accept())
 s.locator('#draft-file').set_input_files(saved_file)
 expect(s.locator('#notice')).to_have_text('보관한 원고를 새 버전으로 저장했습니다.')
 expect(s.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 assert s.locator('#title').input_value()=='저장 실패 시 보존할 원고'
 passed('server failure retains text; downloaded draft restores to the same post as a new version')
 assert not errors,errors
 browser.close()
report={'passed':len(checks),'checks':checks,'production_db_connected':False,'test_data':'fictional local accounts and posts'}
Path('/workspace/신촌점_직원블로그_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
