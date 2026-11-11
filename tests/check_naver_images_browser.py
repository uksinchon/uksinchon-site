"""Use CMS_NAVER_IMAGES_UI_FIXTURE=1 node tests/check_naver_images.mjs. Fake images only."""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:8799'
checks=[]
def passed(message):checks.append(message);print('PASS',message,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844});a=c.new_page();errors=[];requests=[]
 a.on('pageerror',lambda e:errors.append(str(e)));a.on('request',lambda r:requests.append(r.url))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('images-admin@example.test');a.locator('#password').fill('FictionalSeoPassword123!');a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible()
 # Publish the text-only fake draft first, to prove imports do not change its live approval.
 seed=a.evaluate('''async()=>{
  const api=async(path,body)=>{const r=await fetch('/api/cms/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d;};
  const item=(await api('naver')).items.find(x=>x.id==='666666666666');const data=await api('posts/'+item.post_id);const checks={facts:true,conditions:true,rights:true};
  await api('naver/items/'+item.id+'/review',{revision:data.post.revision,sourceHash:(await api('naver/items/'+item.id)).item.source_hash,checks});await api('posts/'+item.post_id+'/factcheck',{revision:data.post.revision,checks});const pub=await api('posts/'+item.post_id+'/publish',{revision:data.post.revision});return {id:item.post_id,url:pub.url};
 }''')
 a.locator('#posts-tab').click();a.get_by_role('button',name='가상 사진 가져오기 원문',exact=True).click();expect(a.locator('#editor-view')).to_be_visible()
 public=b.new_context(java_script_enabled=False,viewport={'width':390,'height':844});v=public.new_page();assert v.goto(BASE+seed['url']).status==200;assert v.locator('.article-body img').count()==0
 a.locator('#naver-import-images').click();expect(a.locator('#naver-images-dialog')).to_be_visible();expect(a.locator('#naver-images-grid input')).to_have_count(12);expect(a.locator('#naver-images-grid input[data-index="3"]')).to_be_disabled();expect(a.locator('#naver-images-grid img').first).to_be_visible(timeout=20000)
 for width in [320,390,768,1440]:
  a.set_viewport_size({'width':width,'height':950});assert not a.evaluate('document.documentElement.scrollWidth>innerWidth');assert not a.locator('#naver-images-dialog').evaluate('(e)=>e.scrollWidth>e.clientWidth')
 a.set_viewport_size({'width':390,'height':844});a.screenshot(path='/workspace/신촌점_네이버사진_선택_모바일.png',full_page=False)
 a.locator('#naver-images-all').click();expect(a.locator('#naver-images-count')).to_have_text(re.compile('11개 선택'));a.locator('#naver-images-next').click();a.locator('input[data-index="12"]').check();a.locator('input[data-index="13"]').click();expect(a.locator('#naver-images-count')).to_have_text(re.compile('12개 선택'));expect(a.locator('input[data-index="13"]')).not_to_be_checked();a.locator('#naver-images-close').click();assert v.reload().status==200;assert v.locator('.article-body img').count()==0
 passed('the mobile picker previews only authenticated Naver images, disables foreign hosts, limits selection across pages and cancels without publication')

 a.locator('.ql-editor').click();a.keyboard.press('Control+Home');a.keyboard.press('ArrowRight');a.keyboard.press('ArrowRight')
 a.locator('#naver-import-images').click();expect(a.locator('#naver-images-grid input')).to_have_count(12);a.locator('input[data-index="0"]').check();a.locator('input[data-index="1"]').check();a.locator('#naver-images-rights').fill('직접 생성한 가상 검증 이미지');a.locator('#naver-images-insert').click();expect(a.locator('#naver-images-result')).to_have_text(re.compile('추가 2개'),timeout=30000);a.locator('#naver-images-close').click();expect(a.locator('.ql-editor img')).to_have_count(2);expect(a.locator('.image-detail')).to_have_count(2)
 data=a.evaluate('''async(id)=>(await(await fetch('/api/cms/posts/'+id)).json())''',seed['id']);ids=[op['insert']['image'].split('/')[-1] for op in data['snapshot']['delta']['ops'] if isinstance(op.get('insert'),dict) and 'image' in op['insert']]
 meta=data['snapshot']['imageMeta'];assert meta[ids[0]]['width']==1600 and meta[ids[0]]['height']==960;assert meta[ids[1]]['width']==16;assert meta[ids[0]]['source'].endswith('photo-0.png');assert meta[ids[1]]['source'].endswith('photo-1.png');assert meta[ids[0]]['rights']=='직접 생성한 가상 검증 이미지';assert meta[ids[0]]['alt']=='';assert data['post']['published_revision']!=data['post']['revision'];assert not data['snapshot'].get('publication');assert v.reload().status==200;assert v.locator('.article-body img').count()==0
 passed('selected PNG/WebP images become bounded private WebP media in source order, with source/rights metadata and no invented alt or approval; the live text stays unchanged')

 a.locator('#naver-import-images').click();expect(a.locator('input[data-index="0"]')).to_be_disabled();expect(a.locator('input[data-index="1"]')).to_be_disabled();a.locator('input[data-index="2"]').check();a.locator('#naver-images-insert').click();expect(a.locator('#naver-images-result')).to_have_text(re.compile('추가 0개.*사진 3'),timeout=30000);a.locator('#naver-images-close').click();expect(a.locator('.ql-editor img')).to_have_count(2)
 passed('already imported photos are disabled and an invalid remote image reports failure without adding a duplicate or broken embed')

 a.locator('#naver-import-images').click();a.locator('input[data-index="5"]').check();a.locator('input[data-index="6"]').check();counter={'n':0}
 def intercept(route):
  if route.request.method!='POST':route.continue_();return
  counter['n']+=1
  if counter['n']==1:route.continue_()
  else:route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'가상 사진 저장 실패'}))
 a.route('**/api/cms/posts/*/images',intercept);a.locator('#naver-images-insert').click();expect(a.locator('#naver-images-result')).to_have_text(re.compile('추가 1개.*가상 사진 저장 실패'),timeout=30000);a.unroute('**/api/cms/posts/*/images');a.locator('#naver-images-insert').click();expect(a.locator('#naver-images-result')).to_have_text(re.compile('추가 1개.*이미 추가됨 0개'),timeout=30000);a.locator('#naver-images-close').click();expect(a.locator('.ql-editor img')).to_have_count(4)
 # Uploaded bytes may succeed while the draft save fails. Keep the inserted photo
 # in the unsaved editor and resume after it, instead of reversing source order.
 a.locator('#naver-import-images').click();a.locator('input[data-index="7"]').check();a.locator('input[data-index="8"]').check()
 def fail_save(route):
  if route.request.method=='PUT':route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'가상 원고 저장 실패'}))
  else:route.continue_()
 a.route('**/api/cms/posts/'+seed['id'],fail_save);a.locator('#naver-images-insert').click();expect(a.locator('#naver-images-result')).to_have_text(re.compile('가상 원고 저장 실패'),timeout=30000);a.unroute('**/api/cms/posts/'+seed['id']);a.locator('#naver-images-insert').click();expect(a.locator('#naver-images-result')).to_have_text(re.compile('추가 1개'),timeout=30000);a.locator('#naver-images-close').click();expect(a.locator('.ql-editor img')).to_have_count(6)
 final=a.evaluate('''async(id)=>(await(await fetch('/api/cms/posts/'+id)).json())''',seed['id']);order=[final['snapshot']['imageMeta'][op['insert']['image'].split('/')[-1]]['source'].split('photo-')[-1] for op in final['snapshot']['delta']['ops'] if isinstance(op.get('insert'),dict) and 'image' in op['insert']];assert order==['0.png','1.png','5.png','6.png','7.png','8.png'],order
 passed('partial upload and draft-save failures retain progress; retry resumes without duplicate photos or reversed source order')

 a.locator('#image-metadata-panel > summary').click()
 for i,box in enumerate(a.locator('.image-detail').all()):
  box.get_by_label('독자에게 전달할 사진 설명',exact=True).fill('직접 만든 가상 사진 '+str(i+1));box.get_by_label('사용 근거 · 예: 직접 촬영, 학교의 사용 허락',exact=True).fill('직접 생성한 가상 검증 이미지')
 a.get_by_text('함께 읽을 글·수정 기록',exact=True).click();a.locator('#change-note').fill('가상 사진 추가 및 설명 검증')
 for key in ['facts','conditions','rights']:a.locator('#naver-check-'+key).check()
 a.locator('#naver-approve').click();expect(a.locator('#notice')).to_have_text(re.compile('현재 버전의 검수를 기록'));a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_have_text(re.compile('공개했습니다'));assert v.reload().status==200;expect(v.locator('.article-body img')).to_have_count(6);assert v.locator('.article-body img').first.get_attribute('width')=='1600';assert v.locator('.article-body img').first.get_attribute('alt')=='직접 만든 가상 사진 1';assert all(img.get_attribute('src').startswith('/media/') for img in v.locator('.article-body img').all());assert not v.evaluate('document.documentElement.scrollWidth>innerWidth')
 assert not any('pstatic.net' in url for url in requests),requests
 assert not errors,errors
 passed('only explicit current review and publication expose stored site images; public HTML works without JavaScript or Naver hotlinks')
 b.close()
report={'passed':len(checks),'checks':checks,'productionImports':0,'productionPostsPublished':0,'images':'generated fictional rectangles only'}
Path('/workspace/신촌점_네이버사진_화면검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
