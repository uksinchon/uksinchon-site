"""Start CMS_TRASH_UI_FIXTURE=1 node tests/check_trash.mjs. Local fictional data only."""
from pathlib import Path
import json,re,time
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:8798'
PASSWORD='FictionalSeoPassword123!'
checks=[]
def passed(message):checks.append(message);print('PASS',message,flush=True)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844});a=c.new_page();errors=[]
 a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('trash-admin@example.test');a.locator('#password').fill(PASSWORD);a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible()
 group='휴지통 화면 검증 '+str(time.time_ns())
 seeded=a.evaluate('''async(group)=>{
   async function api(path,body){const r=await fetch('/api/cms/'+path,{method:path.includes('/')?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d;}
   const rows=[];for(let i=0;i<31;i++){
     const d=await api('posts',{});const title=group+(i===0?' 마지막 페이지 글':i===30?' 공개 글 · 매우긴제목에서도삭제버튼과복구버튼이화면밖으로넘치지않아야합니다':' 가상 초안 '+i);
     await api('posts/'+d.id,{schemaVersion:2,title,category:'상담 사례·소식',contentType:'news',revision:1,delta:{ops:[{insert:'이 글은 화면 검증용 가상 원고이며 실제 상담 사례가 아닙니다.\\n'}]}});rows.push({...d,title});
   }
   const live=rows[30];const r=await fetch('/api/cms/posts/'+live.id+'/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:2})});if(!r.ok)throw new Error(await r.text());live.url=(await r.json()).url;return rows;
 }''',group)
 a.locator('#search').fill(group);a.get_by_role('button',name='검색',exact=True).click();expect(a.locator('.post-row')).to_have_count(30)
 for width in [320,390,768,1440]:
  a.set_viewport_size({'width':width,'height':950});assert not a.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 a.set_viewport_size({'width':390,'height':844});a.screenshot(path='/workspace/신촌점_전체글목록_삭제_모바일.png',full_page=False)
 passed('each administrator row has a labelled delete action and long titles fit mobile and desktop widths')

 a.locator('#next-page').click();expect(a.locator('.post-row')).to_have_count(1);expect(a.locator('#page-label')).to_have_text('2쪽')
 delete=a.locator('.post-row [data-action=trash]');requests=[]
 a.on('request',lambda r:requests.append(r.url) if r.url.endswith('/trash') and r.method=='POST' else None)
 a.once('dialog',lambda d:d.dismiss());delete.click();expect(a.locator('.post-row')).to_have_count(1);assert not requests
 a.once('dialog',lambda d:d.accept());delete.click();expect(a.locator('#notice')).to_have_text(re.compile('글을 삭제했습니다'));expect(a.locator('#page-label')).to_have_text('1쪽');expect(a.locator('.post-row')).to_have_count(30)
 passed('cancel sends no deletion request; deleting the sole last-page item returns to the preceding populated page')

 live=seeded[30];row=a.locator('.post-row').filter(has_text=live['title'])
 public=b.new_context(java_script_enabled=False,viewport={'width':390,'height':844});v=public.new_page();assert v.goto(BASE+live['url']).status==200
 a.route('**/api/cms/posts/*/trash',lambda route:route.abort())
 a.once('dialog',lambda d:d.accept());row.locator('[data-action=trash]').click();expect(a.locator('#notice')).to_have_class(re.compile('error'));expect(row).to_be_visible();expect(row.locator('[data-action=trash]')).to_be_enabled();assert v.reload().status==200
 a.unroute('**/api/cms/posts/*/trash')
 a.once('dialog',lambda d:d.accept());row.locator('[data-action=trash]').click();expect(a.locator('#notice')).to_have_text(re.compile('글을 삭제했습니다'));expect(row).to_have_count(0);assert v.reload().status==404
 passed('a network failure keeps the visible row and live post; successful deletion removes the public page after confirmation')

 a.locator('#trash-view').click();expect(a.locator('#list-title')).to_have_text('휴지통');expect(a.locator('.post-row')).to_have_count(2)
 trashed=a.locator('.post-row').filter(has_text=live['title']);expect(trashed.get_by_role('heading',name=live['title'],exact=True)).to_be_visible();assert trashed.locator('button.row-title').count()==0
 for width in [320,390,768,1440]:
  a.set_viewport_size({'width':width,'height':950});assert not a.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 a.set_viewport_size({'width':390,'height':844});a.screenshot(path='/workspace/신촌점_휴지통_복구_모바일.png',full_page=False)
 a.once('dialog',lambda d:d.accept());trashed.locator('[data-action=restore]').click();expect(a.locator('#notice')).to_have_text(re.compile('비공개 초안으로 복구'));expect(a.locator('.post-row')).to_have_count(1);assert v.reload().status==404
 a.locator('#trash-view').click();row=a.locator('.post-row').filter(has_text=live['title']);expect(row).to_be_visible();expect(row.locator('.badge')).to_have_text('초안');row.get_by_role('button',name=live['title'],exact=True).click();expect(a.locator('#editor-view')).to_be_visible();expect(a.locator('#title')).to_have_value(live['title'])
 data=a.evaluate('''async(id)=>(await(await fetch('/api/cms/posts/'+id)).json())''',live['id']);assert data['post']['published_revision'] is None;assert data['post']['slug']==live['url'].split('/')[2];assert not data['snapshot'].get('publication')
 passed('trash is searchable and readable on mobile; restore preserves content and URL as an editable private draft')

 a.locator('#back-list').click();a.locator('#naver-tab').click();source=a.locator('.naver-item-row').filter(has_text='가상 휴지통 원문');expect(source).to_contain_text('휴지통에 있는 글');assert source.get_by_role('button',name='초안 열기',exact=True).count()==0;source.get_by_role('button',name='원문 보기·보완',exact=True).click();expect(a.locator('#naver-detail-info')).to_contain_text('휴지통');expect(a.locator('#naver-manual-draft')).to_be_disabled();expect(a.locator('#naver-ai-draft')).to_be_disabled();expect(a.locator('#naver-open-draft')).to_be_hidden()
 passed('the Naver inbox identifies trashed articles and disables regeneration instead of silently recreating them')

 staff=b.new_context(viewport={'width':390,'height':844});s=staff.new_page();s.on('pageerror',lambda e:errors.append(str(e)));s.goto(BASE+'/admin/');s.locator('#email').fill('trash-author@example.test');s.locator('#password').fill(PASSWORD);s.locator('#auth-submit').click();expect(s.locator('#workspace')).to_be_visible();s.locator('#new-post').click();s.locator('#title').fill('가상 직원 권한 화면 확인');s.locator('.ql-editor').fill('삭제 권한은 관리자에게만 제공되는지 확인하는 가상 초안입니다.');s.locator('#save').click();expect(s.locator('#save-state')).to_have_text(re.compile('저장 완료'));s.locator('#back-list').click();expect(s.locator('.post-row')).not_to_have_count(0);expect(s.locator('#trash-view')).to_be_hidden();assert s.locator('[data-action=trash]').count()==0;assert s.locator('[data-action=restore]').count()==0
 passed('staff can still create and edit their own drafts while delete and restore controls remain administrator-only')
 assert not errors,errors
 b.close()
report={'passed':len(checks),'checks':checks,'productionDeletes':0,'environment':'fictional local D1 only'}
Path('/workspace/신촌점_글삭제_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
