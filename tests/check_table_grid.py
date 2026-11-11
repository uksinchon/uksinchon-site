"""Table grid and native cell editing on fictional local data only."""
import sys,time
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);a=b.new_page(viewport={'width':1440,'height':1000});errors=[];a.on('pageerror',lambda e:errors.append(str(e)))
 a.goto(BASE+'/admin/',wait_until='networkidle');a.locator('#email').fill('cms-admin@example.test');a.locator('#password').fill('FictionalTestPassword123!');a.locator('#auth-submit').click();expect(a.locator('#workspace')).to_be_visible();a.locator('#new-post').click();expect(a.locator('#editor-view')).to_be_visible()
 title='격자 표 검증 '+str(time.time_ns());a.locator('#title').fill(title);a.locator('.ql-editor').fill('앞 문장\n뒤 문장\n');a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).setSelection(5,0)')
 assert a.locator('#add-image').count()==0;assert a.locator('#add-table').count()==0
 a.locator('#insert-table').click();expect(a.locator('#table-grid-picker')).to_be_visible();a.get_by_role('button',name='3열 3행 표',exact=True).hover();expect(a.locator('#table-grid-size')).to_have_text('3 × 3');assert a.locator('#table-grid .selected').count()==9
 a.screenshot(path='work/table-grid-picker.png');a.get_by_role('button',name='3열 3행 표',exact=True).click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(9)
 a.get_by_label('1행 1열',exact=True).fill('학교');a.get_by_label('1행 2열',exact=True).press_sequentially('Course',delay=30);expect(a.get_by_label('1행 2열',exact=True)).to_have_value('Course')
 a.get_by_label('2행 1열',exact=True).fill('한국어 입력');a.get_by_label('2행 2열',exact=True).fill('<script>alert(1)</script>\n둘째 줄')
 a.get_by_label('3행 1열',exact=True).evaluate("(e)=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='한글 조합';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));if(!e.isConnected)throw Error('composition interrupted');e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));}");expect(a.get_by_label('3행 1열',exact=True)).to_have_value('한글 조합')
 a.get_by_role('button',name='＋ 행',exact=True).click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(12);a.get_by_role('button',name='＋ 열',exact=True).click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(16)
 a.locator('#undo').click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(12);a.locator('#redo').click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(16)
 a.get_by_role('button',name='마지막 열 삭제',exact=True).click();a.get_by_role('button',name='마지막 행 삭제',exact=True).click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(9)
 a.locator('#save').click();expect(a.locator('#save-state')).to_contain_text('저장 완료');a.locator('#back-list').click();a.get_by_role('button',name=title,exact=True).click();expect(a.locator('#editor-view')).to_be_visible();expect(a.get_by_label('1행 2열',exact=True)).to_have_value('Course')
 delta=a.evaluate('()=>Quill.find(document.querySelector("#rich-editor")).getContents()');assert delta['ops'][0]['insert']=='앞 문장\n',delta
 with a.expect_popup() as popup:a.locator('#preview').click()
 v=popup.value;v.wait_for_load_state('networkidle');expect(v.locator('.body-table td')).to_have_count(9);assert v.locator('.body-table td').nth(4).inner_text()=='<script>alert(1)</script>\n둘째 줄'
 a.once('dialog',lambda d:d.accept());a.locator('#publish').click();expect(a.locator('#notice')).to_contain_text('공개했습니다.');v.goto(BASE+a.locator('#public-link').get_attribute('href'),wait_until='networkidle');expect(v.locator('.body-table td')).to_have_count(9)
 for width in [1440,768,390,320]:
  for page in [a,v]:
   page.set_viewport_size({'width':width,'height':1000});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  a.locator('#insert-table').click();expect(a.locator('#table-grid-picker')).to_be_visible();rect=a.locator('#table-grid-picker').bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=width;a.keyboard.press('Escape')
 a.set_viewport_size({'width':1440,'height':1000});a.get_by_role('button',name='표 삭제',exact=True).click();expect(a.locator('.comparison-table-blot')).to_have_count(0);a.locator('#undo').click();expect(a.locator('.comparison-table-blot textarea')).to_have_count(9)
 assert not errors,errors;print('PASS picker hover/cursor insertion, direct Korean/text entry, row/column edits, undo/redo, reopen/preview/publish and mobile widths');b.close()
