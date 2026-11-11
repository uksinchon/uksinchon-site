"""YouTube and simple image UI regression against fictional local CMS only."""
import sys,time,re
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1440,'height':900})
 # Do not send test viewer traffic or playback events to YouTube.
 c.route('https://www.youtube-nocookie.com/**',lambda route:route.fulfill(content_type='text/html',body='<html><body>가상 영상 재생기</body></html>'))
 a=c.new_page();errors=[];a.on('pageerror',lambda e:errors.append(str(e)));a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('cms-admin@example.test');a.locator('#password').fill('FictionalTestPassword123!');a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible();a.locator('#new-post').click();expect(a.locator('#editor-view')).to_be_visible()
 title='미디어 가상 검증 '+str(time.time_ns());a.locator('#title').fill(title);a.locator('.ql-editor').fill('앞 문장\n뒤 문장\n')
 a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).setSelection(5,0)')
 Image.new('RGB',(180,120),(120,160,180)).save('/tmp/media-editor.png')
 with a.expect_file_chooser() as choice:a.locator('.ql-image').click()
 choice.value.set_files('/tmp/media-editor.png');expect(a.locator('#notice')).to_have_text('사진과 글을 공동 DB에 저장했습니다.');expect(a.locator('.ql-editor img')).to_have_count(1)
 delta=a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getContents()');assert delta['ops'][0]['insert']=='앞 문장\n',delta;assert 'image' in delta['ops'][1]['insert'],delta
 assert not a.locator('#image-metadata-panel').evaluate('(e)=>e.open')
 for alignment in ['right','center','']:
  a.locator('.ql-editor img').click();a.locator('.ql-align[value="'+alignment+'"]').click();assert a.locator('.ql-editor img').evaluate('(e)=>getComputedStyle(e.parentElement).textAlign')=={'right':'right','center':'center','':'left'}[alignment]
 a.locator('.ql-editor img').click();a.locator('.ql-align[value="right"]').click()
 print('PASS toolbar file picker inserts at saved cursor; click image and align without metadata forms',flush=True)
 def end():a.evaluate('()=>{const q=Quill.find(document.querySelector("#rich-editor"));q.setSelection(q.getLength()-1,0)}')
 end();a.locator('.ql-editor').evaluate("(e)=>{const d=new DataTransfer();d.setData('text/plain','https://youtu.be/M7lc1UVf-VE?si=fictional');e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));}")
 expect(a.locator('.ql-editor .youtube-video')).to_have_count(1)
 end();a.keyboard.insert_text('https://www.youtube.com/shorts/aqz-KE-bpKQ');a.keyboard.press('Enter');expect(a.locator('.ql-editor .youtube-video')).to_have_count(2)
 a.once('dialog',lambda d:d.accept('https://www.youtube.com/watch?v=jNQXAC9IVRw'));a.locator('.ql-youtube').click();expect(a.locator('.ql-editor .youtube-video')).to_have_count(3)
 a.locator('#save').click();expect(a.locator('#save-state')).to_contain_text('저장 완료');a.locator('#back-list').click();a.get_by_role('button',name=title,exact=True).click();expect(a.locator('#editor-view')).to_be_visible();expect(a.locator('.ql-editor .youtube-video')).to_have_count(3);expect(a.locator('.ql-editor img')).to_have_count(1)
 with a.expect_popup() as popup:a.locator('#preview').click()
 v=popup.value;v.wait_for_load_state('networkidle');expect(v.locator('.article-body .youtube-video')).to_have_count(3);expect(v.locator('.article-image')).to_have_class('article-image ql-align-right')
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_contain_text('공개했습니다.');href=a.locator('#public-link').get_attribute('href');v.goto(BASE+href,wait_until='networkidle');expect(v.locator('.article-body iframe')).to_have_count(3)
 for width in [1440,768,390,320]:
  for page in [a,v]:
   page.set_viewport_size({'width':width,'height':900});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  for frame in v.locator('.youtube-video iframe').all():
   rect=frame.bounding_box();assert abs(rect['width']/rect['height']-16/9)<.02,rect
 assert v.locator('.article-image img').get_attribute('alt')==''
 print('PASS pasted/typed/toolbar YouTube links survive reopen, preview and publish; optional photo fields and responsive players at desktop/mobile widths',flush=True)
 post_id=a.evaluate('()=>document.querySelector("#public-link").getAttribute("href").split("story-")[1].split("/")[0]');data=c.request.get(BASE+'/api/cms/posts/'+post_id).json()
 for embed in [{'youtube':'https://evil.example/embed'},{'youtube':'M7lc1UVf-VE\" onload=alert(1)'},{'video':'https://evil.example/embed'}]:
  body={**data['snapshot'],'revision':data['post']['revision'],'delta':{'ops':[{'insert':embed},{'insert':'\n'}]}}
  assert c.request.put(BASE+'/api/cms/posts/'+post_id,headers={'Origin':BASE},data=body).status==400
 assert not errors,errors;print('PASS server rejects arbitrary frame URLs, forged video IDs and HTML attributes',flush=True);b.close()
