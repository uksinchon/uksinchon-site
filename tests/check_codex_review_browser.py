"""Use CMS_CODEX_UI_FIXTURE=1 node tests/check_codex_review.mjs. Fictional local DB only."""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright,expect

BASE='http://127.0.0.1:8797'
checks=[]
def passed(message):checks.append(message);print('PASS',message,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844});a=c.new_page();errors=[]
 a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('codex-admin@example.test');a.locator('#password').fill('FictionalSeoPassword123!');a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible()
 a.locator('#naver-tab').click();a.get_by_text('먼저 검토할 대표 글 5개',exact=True).click();a.locator('#apply-codex-pilots').click()
 expect(a.locator('#pilot-state')).to_have_text(re.compile('Codex 검토 원고 적용 2개 · 기존 원고 보존 2개'),timeout=60000)
 assert '재확인 시점' in a.locator('#pilot-state').inner_text()
 passed('bulk application preserves existing drafts, applies reviewed packets and exposes an expired packet without requesting human fact checks')
 a.locator('.naver-item-row').filter(has_text='224466258454').get_by_role('button',name='초안 열기',exact=True).click()
 expect(a.locator('#editor-view')).to_be_visible();expect(a.locator('#fact-review-state')).to_have_text(re.compile('Codex'))
 expect(a.locator('#naver-review-state')).to_have_text(re.compile('AI 검토가 완료'))
 assert not any(a.locator('#fact-check-'+key).is_checked() for key in ['facts','conditions','rights'])
 expect(a.locator('.comparison-table-blot')).to_have_count(1)
 for width in [320,390,768,1440]:
  a.set_viewport_size({'width':width,'height':950});assert not a.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 passed('reviewed text, table, source scope and truthful AI identity load without checked human declarations or mobile overflow')
 a.set_viewport_size({'width':390,'height':844});a.once('dialog',lambda d:d.accept());a.locator('#apply-codex-post').click();expect(a.locator('#notice')).to_have_text(re.compile('Codex의 AI 검토 원고를 적용'))
 expect(a.locator('#fact-review-state')).to_have_text(re.compile('Codex'))
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#public-link')).to_be_visible();href=a.locator('#public-link').get_attribute('href')
 passed('an existing draft receives an explicit new version and publishes through the normal UI without a fabricated human review')
 public=b.new_context(java_script_enabled=False,viewport={'width':390,'height':844});v=public.new_page();r=v.goto(BASE+href,wait_until='networkidle');assert r.status==200
 expect(v.locator('.fact-review')).to_contain_text('Codex (AI 검토)');expect(v.locator('table')).to_be_visible();assert not v.evaluate('document.documentElement.scrollWidth>innerWidth');assert v.locator('img').count()==0
 v.screenshot(path='/workspace/Codex_검토완료_공개글_모바일.png',full_page=True)
 a.locator('#title').fill('검증용 수정된 제목');expect(a.locator('#naver-review-state')).to_have_text(re.compile('검수가 필요'))
 a.locator('#save').click();expect(a.locator('#save-state')).to_have_text(re.compile('저장 완료'));assert '현재 버전의 사실 확인 기록이 없습니다' in a.locator('#fact-review-state').inner_text()
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_have_text(re.compile('검수 완료'))
 v.reload(wait_until='networkidle');expect(v.get_by_role('heading',name='영국 어학원 한국인 비율, 숫자보다 먼저 볼 집계 기준 5가지',exact=True)).to_be_visible()
 passed('published HTML works without JavaScript and discloses AI review; later edits invalidate the proof and keep the live article intact')
 assert not errors,errors
 b.close()
report={'passed':len(checks),'checks':checks,'productionPostsPublished':0,'sources':'fictional local responses'}
Path('/workspace/Codex_검토_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
