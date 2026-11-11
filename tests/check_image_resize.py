"""Mouse image resize regression using only fictional local data."""
import sys,time
from PIL import Image
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1440,'height':1000});a=c.new_page();errors=[];a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('cms-admin@example.test');a.locator('#password').fill('FictionalTestPassword123!');a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible();a.locator('#new-post').click();expect(a.locator('#editor-view')).to_be_visible();title='크기 조절 가상 검증 '+str(time.time_ns());a.locator('#title').fill(title);a.locator('.ql-editor').fill('사진 크기를 검증하는 가상 본문입니다.\n')
 Image.new('RGB',(1200,800),(120,160,170)).save('/tmp/resize-image.png');a.locator('#image-file').set_input_files('/tmp/resize-image.png');expect(a.locator('#notice')).to_have_text('사진과 글을 공동 DB에 저장했습니다.');img=a.locator('.ql-editor img');img.click();expect(a.locator('.image-resize-box')).to_be_visible()
 before=img.bounding_box();handle=a.locator('.image-resize-handle.se').bounding_box();a.mouse.move(handle['x']+10,handle['y']+10);a.mouse.down();a.mouse.move(handle['x']+10-before['width']*.5,handle['y']+10-before['height']*.5,steps=12);a.mouse.up()
 expect(img).to_have_attribute('data-image-width','50');assert abs(img.bounding_box()['width']/before['width']-.5)<.02;assert abs(img.bounding_box()['width']/img.bounding_box()['height']-1.5)<.01
 a.locator('#undo').click();expect(img).not_to_have_attribute('data-image-width','50');a.locator('#redo').click();expect(img).to_have_attribute('data-image-width','50')
 a.locator('#save').click();expect(a.locator('#save-state')).to_contain_text('저장 완료');a.locator('#back-list').click();a.get_by_role('button',name=title,exact=True).click();expect(a.locator('#editor-view')).to_be_visible();expect(a.locator('.ql-editor img')).to_have_attribute('data-image-width','50')
 delta=a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getContents()');assert next(o for o in delta['ops'] if isinstance(o['insert'],dict))['attributes']['imageWidth']==50,delta
 img.click();a.screenshot(path='work/image-resize-preview.png')
 print('PASS real mouse drag preserves ratio, undo/redo and 50% size across save/reopen',flush=True)
 with a.expect_popup() as popup:a.locator('#preview').click()
 v=popup.value;v.wait_for_load_state('networkidle');expect(v.locator('.article-body img')).to_have_class('image-width-50');a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_contain_text('공개했습니다.');v.goto(BASE+a.locator('#public-link').get_attribute('href'),wait_until='networkidle')
 for width in [1440,768,390,320]:
  for page,selector in [(a,'.ql-editor img'),(v,'.article-body img')]:
   page.set_viewport_size({'width':width,'height':1000});picture=page.locator(selector);picture.scroll_into_view_if_needed();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
   fraction=picture.evaluate('(e)=>{const p=e.closest(".ql-editor,.article-body");const s=getComputedStyle(p);return e.getBoundingClientRect().width/(p.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight))}');assert abs(fraction-.5)<.02,fraction
 a.set_viewport_size({'width':1440,'height':1000});img=a.locator('.ql-editor img');img.click();a.locator('.image-resize-info button').click();expect(img).not_to_have_attribute('data-image-width','50');a.locator('#undo').click();expect(img).to_have_attribute('data-image-width','50')
 img.click();a.locator('.image-resize-handle.se').focus();a.keyboard.press('ArrowLeft');expect(img).to_have_attribute('data-image-width','49')
 print('PASS preview/public sizes match at desktop/mobile widths; reset and keyboard fine adjustment work',flush=True)
 assert not errors,errors;b.close()
