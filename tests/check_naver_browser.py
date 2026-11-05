"""Run with CMS_NAVER_UI_FIXTURE=1 node tests/check_naver.mjs.
Uses fictional local source/AI responses with real Workers + D1. No production access.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,re
BASE='http://127.0.0.1:8794'
checks=[]
def passed(name):checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1050});page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'/admin/',wait_until='networkidle');page.locator('#email').fill('admin@example.test');page.locator('#password').fill('FictionalPassword123!');page.locator('#auth-submit').click();expect(page.locator('#workspace')).to_be_visible();page.get_by_role('button',name='네이버 가져오기',exact=True).click();expect(page.locator('#naver-view')).to_be_visible();expect(page.locator('#naver-health')).to_have_text(re.compile('AI: 미연결'))
 passed('admin inbox honestly identifies missing AI setup and last cron invocation')
 row=page.locator('.naver-item-row').filter(has_text='가상 어학연수 안내 111111111');row.get_by_role('button',name='원문 보기·보완',exact=True).click();expect(page.locator('#naver-detail')).to_be_visible();expect(page.locator('#naver-detail-info')).to_have_text(re.compile('현재 RSS 요약만'))
 page.get_by_role('button',name='전체 본문 다시 읽기',exact=True).click();expect(page.locator('#naver-detail-info')).to_have_text(re.compile('본문 텍스트 확인'))
 assert '£300' in page.locator('#naver-source-text').input_value()
 page.get_by_role('button',name='원문 정리 초안 만들기 · AI 없이',exact=True).click();expect(page.locator('#editor-view')).to_be_visible();expect(page.locator('#naver-review-panel')).to_be_visible();expect(page.locator('#naver-review-meta')).to_have_text(re.compile('AI를 사용하지 않은'))
 passed('full source extraction and non-AI draft open in editor with explicit provenance')
 page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='이 버전 공개 승인',exact=True).click();expect(page.locator('#notice')).to_have_text(re.compile('검수 완료'))
 passed('publish action is blocked before human review even for administrator')
 page.locator('#applies-to').fill('가상 2027 일반영어 과정');page.locator('#verified-at').fill('2026-11-02');page.locator('#review-scope').fill('검증용 공식 자료의 대상과 예외 대조');page.locator('#add-source').click();source=page.locator('.source-detail').first;source.get_by_label('자료 주소',exact=True).fill('https://example.org/official');source.get_by_label('자료 제목',exact=True).fill('가상 공식 안내');source.get_by_label('자료 발행 기관',exact=True).fill('가상 기관');page.locator('#title').fill('사람이 재편집한 어학연수 조건 안내');page.locator('.ql-editor').fill('2027년 일반영어 24주 과정은 원문 기준 주당 £300입니다. 적용 시점과 숙소 비용은 별도로 확인해야 합니다.');page.get_by_role('button',name='초안 저장',exact=True).click();expect(page.locator('#save-state')).to_have_text(re.compile('^저장 완료'))
 for key in ['facts','conditions','rights']:page.locator('#naver-check-'+key).check()
 page.get_by_role('button',name='현재 버전 검수 완료 기록',exact=True).click();expect(page.locator('#naver-review-state')).to_have_text(re.compile('검수 완료가 기록'))

 expect(page.locator('#fact-review-state')).to_have_text(re.compile('현재 버전 확인 기록'))
 page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='이 버전 공개 승인',exact=True).click();expect(page.locator('#public-link')).to_be_visible();href=page.locator('#public-link').get_attribute('href')
 public=b.new_page();response=public.goto(BASE+href,wait_until='networkidle');assert response.status==200;expect(public.get_by_role('heading',name='사람이 재편집한 어학연수 조건 안내',exact=True)).to_be_visible();assert 'AI를 사용하지 않은 원문 정리 초안' not in public.locator('body').inner_text();expect(public.get_by_role('heading',name='출처·참고 자료',exact=True)).to_be_visible()
 passed('editing, explicit review and separate approval publish only intended article with source; internal notes stay private')
 page.locator('#title').fill('검수 후 다시 수정한 제목');expect(page.locator('#naver-review-state')).to_have_text(re.compile('검수가 필요'))
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':950});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/workspace/신촌점_네이버원문_검수화면.png',full_page=True)
 passed('new edits invalidate UI review status; original comparison and checklist fit mobile widths')
 page.get_by_role('button',name='← 글 목록',exact=True).click();page.get_by_role('button',name='네이버 가져오기',exact=True).click();page.set_viewport_size({'width':390,'height':844});expect(page.locator('#naver-view')).to_be_visible();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');page.screenshot(path='/workspace/신촌점_네이버_가져오기.png',full_page=True)
 page.get_by_text('먼저 검토할 대표 글 5개',exact=True).click();page.locator('#prepare-pilot').click();expect(page.locator('#pilot-state')).to_have_text(re.compile('새 초안 5개'),timeout=60000)
 pilot_ids=page.evaluate('''async()=>{const r=await fetch('/api/cms/naver');const d=await r.json();return d.items.filter(x=>['224442365768','224408275837','224466258454','224465727870','224440279774'].includes(x.id)).map(x=>x.post_id);}''');assert len(pilot_ids)==5
 details=page.evaluate('''async(ids)=>Promise.all(ids.map(async id=>(await(await fetch('/api/cms/posts/'+id)).json())))''',pilot_ids)
 assert all(x['post']['published_revision'] is None for x in details);assert sorted(x['snapshot']['contentType'] for x in details)==['case','comparison','guide','news','news'];assert all(not x['snapshot'].get('publication') for x in details)
 first=details[0];first_id=first['post']['id'];old_revision=first['post']['revision']
 page.evaluate('''async(data)=>{const r=await fetch('/api/cms/posts/'+data.post.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data.snapshot,title:'사람이 보존할 대표 글 초안',revision:data.post.revision})});if(!r.ok)throw new Error(await r.text());}''',first)
 page.locator('#prepare-pilot').click();expect(page.locator('#pilot-state')).to_have_text(re.compile('새 초안 0개 · 기존 초안 5개'),timeout=60000)
 kept=page.evaluate('''async(id)=>(await(await fetch('/api/cms/posts/'+id)).json())''',first_id);assert kept['snapshot']['title']=='사람이 보존할 대표 글 초안' and kept['post']['revision']==old_revision+1
 passed('five selected sources prepare typed private drafts without AI or publication; repeating preparation preserves human edits')
 assert not errors,errors
 b.close()
report={'passed':len(checks),'checks':checks,'network':'synthetic source and AI fixtures; no live publication'}
Path('/workspace/신촌점_네이버연동_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
