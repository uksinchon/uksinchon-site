"""Section divider in the note editor, on fictional local data only."""
import sys,time
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);a=b.new_page(viewport={'width':1280,'height':1000});errors=[];a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('cms-admin@example.test');a.locator('#password').fill('FictionalTestPassword123!');a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible();a.locator('#new-post').click();expect(a.locator('#editor-view')).to_be_visible()
 title='구분선 검증 '+str(time.time_ns());a.locator('#title').fill(title);a.locator('.ql-editor').fill('상담신청하기\n영국유학센터 고객 후기\n')
 a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).setSelection(7,0)')
 a.get_by_role('button',name='구분선 넣기',exact=True).click();expect(a.locator('.ql-editor hr.note-divider')).to_have_count(1)
 ops=a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getContents().ops');assert ops[0]['insert']=='상담신청하기\n' and ops[1]['insert']=={'divider':True},ops
 a.keyboard.type('다음 문단');t=a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getText()');assert t.startswith('상담신청하기\n다음 문단영국'),repr(t)
 a.locator('#undo').click();a.locator('#undo').click();expect(a.locator('.ql-editor hr.note-divider')).to_have_count(0);a.locator('#redo').click();expect(a.locator('.ql-editor hr.note-divider')).to_have_count(1)
 a.locator('#save').click();expect(a.locator('#save-state')).to_contain_text('저장 완료');a.locator('#back-list').click();a.get_by_role('button',name=title,exact=True).click();expect(a.locator('.ql-editor hr.note-divider')).to_have_count(1)
 with a.expect_popup() as pp:a.locator('#preview').click()
 v=pp.value;v.wait_for_load_state('networkidle');hr=v.locator('.article-body hr.note-divider');expect(hr).to_have_count(1)
 box=hr.bounding_box();body=v.locator('.article-body').bounding_box();assert round(box['width'])==72 and abs((box['x']+36)-(body['x']+body['width']/2))<2,(box,body)
 assert hr.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(185, 72, 43)'
 assert not errors,errors;print('PASS divider button, cursor placement, undo/redo, save/reopen and centred short accent line on the post');b.close()
