"""Regression checks for formatting against an isolated local CMS after check_cms.py."""
import sys,time
from playwright.sync_api import sync_playwright,expect
from PIL import Image
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':900});a=c.new_page();errors=[];a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/');a.locator('#email').fill('cms-admin@example.test');a.locator('#password').fill('FictionalTestPassword123!');a.locator('#auth-submit').click();a.locator('#workspace').wait_for(state='visible')
 a.locator('#new-post').click();a.locator('#editor-view').wait_for(state='visible');title='서식 회귀 '+str(time.time_ns());a.locator('#title').fill(title)
 a.locator('.ql-editor').fill('정렬과 서식 검증\n두 번째 문단\n'+'긴 글 문단\n'*90)
 def select(index=0,length=3):a.evaluate('([i,n])=>Quill.find(document.querySelector("#rich-editor")).setSelection(i,n)',[index,length])
 select();a.locator('.ql-bold').click();a.locator('.ql-strike').click()
 select();a.locator('.ql-size .ql-picker-label').click();a.locator('.ql-size .ql-picker-item[data-value="large"]').click()
 select();a.locator('.ql-color .ql-picker-label').click();a.locator('.ql-color .ql-picker-item[data-value="#e60000"]').click()
 select();a.locator('.ql-background .ql-picker-label').click();a.locator('.ql-background .ql-picker-item[data-value="#ffff00"]').click()
 select();a.locator('.ql-align[value="center"]').click()
 expect(a.locator('.ql-editor p').first).to_have_class('ql-align-center')
 a.locator('#undo').click();expect(a.locator('.ql-editor p').first).not_to_have_class('ql-align-center');a.locator('#redo').click();expect(a.locator('.ql-editor p').first).to_have_class('ql-align-center')
 Image.new('RGB',(120,80),(100,150,180)).save('/tmp/format-photo.png');select(30,0);a.locator('#image-file').set_input_files('/tmp/format-photo.png');a.locator('.ql-editor img').wait_for()
 # Align the paragraph containing the uploaded image using the visible toolbar.
 idx=a.evaluate('()=>{const q=Quill.find(document.querySelector("#rich-editor"));let i=0;for(const op of q.getContents().ops){if(op.insert.image)return i;i+=typeof op.insert==="string"?op.insert.length:1;}}')
 select(idx,1)
 for alignment in ['center','','right']:
  a.locator('.ql-align[value="'+alignment+'"]').click()
  assert a.locator('.ql-editor img').evaluate('(e)=>getComputedStyle(e.parentElement).textAlign')=={'center':'center','':'left','right':'right'}[alignment]
 a.locator('#image-metadata-panel > summary').click();a.get_by_label('독자에게 전달할 사진 설명',exact=True).fill('서식 확인 사진');a.get_by_label('사용 근거 · 예: 직접 촬영, 학교의 사용 허락',exact=True).fill('가상 생성')
 a.locator('#save').click();expect(a.locator('#save-state')).to_contain_text('저장 완료')
 delta=a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getContents()')
 assert any(o.get('attributes',{}).get('color')=='#e60000' and o.get('attributes',{}).get('background')=='#ffff00' and o.get('attributes',{}).get('size')=='large' and o.get('attributes',{}).get('strike') for o in delta['ops']),delta
 for width in [1440,768,390,320]:
  a.set_viewport_size({'width':width,'height':900});a.locator('.ql-editor p').nth(50).scroll_into_view_if_needed();box=a.locator('#toolbar').bounding_box();assert abs(box['y'])<2,box
  assert not a.evaluate('document.documentElement.scrollWidth>innerWidth'),width
  a.locator('#save').click();box=a.locator('#notice').bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=900,box
 print('PASS text formats, undo/redo, image alignment, sticky toolbar and visible notice at desktop/mobile widths',flush=True)
 a.locator('#back-list').click();a.get_by_role('button',name=title,exact=True).click();expect(a.locator('#editor-view')).to_be_visible()
 assert a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getContents()')==delta
 def styles(page,selector):return page.locator(selector).evaluate('(e)=>{while(e.firstElementChild)e=e.firstElementChild;let s=getComputedStyle(e);let bg=s.backgroundColor;for(let n=e;bg==="rgba(0, 0, 0, 0)"&&n.parentElement;n=n.parentElement)bg=getComputedStyle(n.parentElement).backgroundColor;return [s.color,bg,s.fontSize]}')
 a.set_viewport_size({'width':1440,'height':900})
 editor_style=styles(a,'.ql-editor .ql-color-\\#e60000')
 with a.expect_popup() as popup:a.locator('#preview').click()
 v=popup.value;v.set_viewport_size({'width':1440,'height':900});v.wait_for_load_state('networkidle');expect(v.locator('.article-image')).to_have_class('article-image ql-align-right')
 preview_style=styles(v,'.article-body .ql-color-\\#e60000');assert preview_style==editor_style,(preview_style,editor_style)
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_contain_text('공개했습니다.')
 href=a.locator('#public-link').get_attribute('href');v.goto(BASE+href);assert styles(v,'.article-body .ql-color-\\#e60000')==preview_style
 expect(v.locator('#edit-post')).to_be_visible();v.locator('#edit-post').click();expect(v.locator('#editor-view')).to_be_visible();expect(v.locator('#title')).to_have_value(title)
 anonymous=b.new_context();n=anonymous.new_page();n.goto(BASE+href);expect(n.locator('#edit-post')).to_be_hidden();assert anonymous.request.get(BASE+'/api/cms/edit-target?slug='+href.split('/')[-2]).status==401
 # A logged-in unrelated employee cannot get an edit link for another author's post.
 email=str(time.time_ns())+'@example.test'
 staff=c.request.post(BASE+'/api/cms/users',headers={'Origin':BASE},data={'name':'다른 직원','email':email,'password':'FictionalTestPassword123!'})
 assert staff.ok
 unrelated=b.new_context();assert unrelated.request.post(BASE+'/api/cms/login',headers={'Origin':BASE},data={'email':email,'password':'FictionalTestPassword123!'}).ok
 assert unrelated.request.post(BASE+'/api/cms/password',headers={'Origin':BASE},data={'currentPassword':'FictionalTestPassword123!','password':'ChangedFictionalPassword123!'}).ok
 assert unrelated.request.get(BASE+'/api/cms/edit-target?slug='+href.split('/')[-2]).status==403
 other=unrelated.new_page();other.goto(BASE+href);expect(other.locator('#edit-post')).to_be_hidden()
 a.route('**/api/cms/posts/*/publish',lambda route:route.fulfill(status=500,content_type='application/json',body='{"error":"가상 발행 오류"}'))
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_have_text('가상 발행 오류');assert a.locator('#notice').get_attribute('role')=='alert'
 print('PASS saved/reopened Delta, preview/public styles, direct editing, anonymous protection and publication success/error notices',flush=True)
 assert not errors,errors
 b.close()
