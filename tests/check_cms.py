"""Integration checks against local Wrangler + real persistent D1 emulation.
Never run against production. Test accounts and content are fictional.
Usage: python3 tests/check_cms.py http://127.0.0.1:8791
"""
import concurrent.futures
import http.cookiejar
import io
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from PIL import Image

BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791'
assert BASE.startswith('http://127.0.0.1:') or BASE.startswith('http://localhost:')
KEY='local-test-setup-key-not-for-production-32'
PASS='FictionalTestPassword123!'
TEMP='TemporaryTestPassword123!'
checks=[]
class Client:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def req(self,path,method='GET',body=None,expected=200,origin=None,content_type=None):
  headers={}
  if method!='GET':headers['Origin']=origin or BASE
  if body is not None:
   if isinstance(body,bytes):raw=body;headers['Content-Type']=content_type or 'application/octet-stream'
   else:raw=json.dumps(body).encode();headers['Content-Type']='application/json'
  else:raw=None
  try:
   r=self.opener.open(urllib.request.Request(BASE+path,data=raw,headers=headers,method=method),timeout=20);status=r.status;data=r.read();rh=r.headers
  except urllib.error.HTTPError as e:status=e.code;data=e.read();rh=e.headers
  assert status==expected,(method,path,status,expected,data[:800])
  return json.loads(data) if rh.get_content_type()=='application/json' else data.decode(errors='replace'),rh
 def api(self,path,method='GET',body=None,expected=200,**kwargs):return self.req('/api/cms/'+path,method,body,expected,**kwargs)[0]
 def login(self,email,password=PASS):return self.api('login','POST',{'email':email,'password':password})

def passed(name):checks.append(name);print('PASS',name,flush=True)

a=Client();anon=Client();status=anon.api('status');assert status['storageConfigured']
first=not status['initialized']
if first:
 anon.api('setup','POST',{'setupToken':'wrong'},403)
 anon.api('setup','POST',{'setupToken':KEY,'name':'가상 관리자','email':'cms-admin@example.test','password':PASS},403,origin='https://other.example')
 a.api('setup','POST',{'setupToken':KEY,'name':'가상 관리자','email':'cms-admin@example.test','password':PASS})
else:a.login('cms-admin@example.test')
assert anon.api('status')['initialized']
a.api('setup','POST',{'setupToken':KEY,'name':'추가 관리자','email':'wrong@example.test','password':PASS},409)
passed('first-admin bootstrap is token-protected, origin-protected and single-use')
anon.api('posts',expected=401)
a.api('posts','POST',{},403,origin='https://other.example')
passed('anonymous and cross-origin writes are blocked')
run=str(time.time_ns())
users=[]
for suffix in ['one','two']:
 email=f'{suffix}-{run}@example.test';a.api('users','POST',{'name':'가상 직원 '+suffix,'email':email,'password':TEMP},201)
 user=Client();login=user.login(email,TEMP);assert login['user']['mustChange']
 user.api('posts',expected=403)
 user.api('password','POST',{'currentPassword':TEMP,'password':PASS})
 users.append((user,email))
one,email_one=users[0];two,email_two=users[1]
passed('administrator creates staff; temporary password must change before writing')
one.api('users',expected=403)
id=one.api('posts','POST',{},201)['id'];post=one.api('posts/'+id)
assert post['post']['revision']==1
second=two.api('posts','POST',{},201)['id']
two.api('posts/'+id,expected=403);one.api('posts/'+second,expected=403)
assert not any(p['id']==id for p in two.api('posts')['posts'])
passed('staff see and edit only their own drafts; admin can review all')
content={'title':'가상 검증 글 <script>시험</script>','category':'어학연수','summary':'테스트용 요약','sources':'https://example.org/official','verifiedAt':'2026-11-02','delta':{'ops':[{'insert':'공식 자료의 조건을 확인하고 학교를 비교하는 가상의 테스트 글입니다. '},{'insert':'위험한 링크','attributes':{'link':'javascript:alert(1)','onerror':'bad'}},{'insert':'\n'},{'insert':'소제목'},{'insert':'\n','attributes':{'header':2}},{'insert':'목록 항목'},{'insert':'\n','attributes':{'list':'bullet'}}]},'revision':1}
revision=one.api('posts/'+id,'PUT',content)['revision'];assert revision==2
one.api('posts/'+id,'PUT',{**content,'delta':{'ops':[{'insert':{'image':'https://example.org/external.jpg'}}]},'revision':revision},400)
passed('shared rich-text draft stores; arbitrary embedded images and executable link attributes are rejected or removed')
image=Image.new('RGB',(16,12),(80,120,160));buf=io.BytesIO();image.save(buf,format='WEBP');image_bytes=buf.getvalue()
img=one.api('posts/'+id+'/images','POST',image_bytes,201,content_type='image/webp')['url']
anon.req(img,expected=404)
one.req(img)
content['delta']['ops'] += [{'insert':{'image':img}},{'insert':'\n'}]
revision=one.api('posts/'+id,'PUT',{**content,'revision':revision})['revision']
preview,headers=one.req('/api/cms/posts/'+id+'/preview')
assert 'noindex' in headers.get('X-Robots-Tag','') and '비공개 미리보기' in preview
anon.req('/api/cms/posts/'+id+'/preview',expected=401)
assert '<script>시험</script>' not in preview and '&lt;script&gt;' in preview
assert 'javascript:' not in preview
passed('private images and preview require authorization; text renders safely without executing HTML')
one.api('posts/'+id+'/review','POST',{'revision':revision})
assert a.api('posts/'+id)['post']['status']=='review'
one.api('posts/'+id+'/publish','POST',{'revision':revision},403)
a.api('posts/'+id+'/publish','POST',{'revision':revision})
post=a.api('posts/'+id)['post'];public_url='/blog/'+post['slug']+'/'
html,headers=anon.req(public_url)
assert '테스트용 요약' in html and 'BlogPosting' in html and '가상 직원 one' in html
assert 'rel="canonical"' in html and 'javascript:' not in html
anon.req(img)
listing,_=anon.req('/blog/');sitemap,_=anon.req('/sitemap.xml');rss,_=anon.req('/feed.xml')
assert post['slug'] in listing and post['slug'] in sitemap and post['slug'] in rss
assert second not in listing
passed('only an administrator publishes; article, list, sitemap and RSS expose approved version and its images')
content['title']='수정 중인 비공개 제목';content['revision']=revision
revision=one.api('posts/'+id,'PUT',content)['revision']
html,_=anon.req(public_url);assert '수정 중인 비공개 제목' not in html and '테스트용 요약' in html
new_img=one.api('posts/'+id+'/images','POST',image_bytes,201,content_type='image/webp')['url'];anon.req(new_img,expected=404)
passed('editing a published post preserves approved content; newly uploaded draft images remain private')
one.api('posts/'+id,'PUT',{**content,'revision':revision-1},409)
assert one.api('posts/'+id)['post']['revision']==revision
passed('stale edit cannot overwrite a newer revision')
def save_same(index):
 try:return one.api('posts/'+id,'PUT',{**content,'title':'동시 저장 '+str(index),'revision':revision})
 except AssertionError as e:
  assert '409' in str(e);return 'conflict'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(save_same,[1,2]))
assert sum(isinstance(x,dict) for x in results)==1 and results.count('conflict')==1
revision=next(x['revision'] for x in results if isinstance(x,dict))
passed('two simultaneous writes produce one saved revision and one conflict')
versions=one.api('posts/'+id+'/versions')['versions'];assert any(v['revision']==2 for v in versions)
old=one.api('posts/'+id+'/versions/2')['snapshot'];old['title']='복원한 가상 글';revision=one.api('posts/'+id,'PUT',{**old,'revision':revision})['revision']
a.api('posts/'+id+'/publish','POST',{'revision':revision})
html,_=anon.req(public_url);assert '복원한 가상 글' in html
assert len(one.api('posts/'+id+'/versions')['versions'])>=5
passed('earlier versions can be restored into a new revision and republished without deleting history')
a.api('posts/'+id+'/unpublish','POST',{'revision':revision})
anon.req(public_url,expected=404);anon.req(img,expected=404)
sitemap,_=anon.req('/sitemap.xml');rss,_=anon.req('/feed.xml');assert post['slug'] not in sitemap and post['slug'] not in rss
assert one.api('posts/'+id)['post']['published_revision'] is None
passed('unpublishing removes article and images from public access while keeping drafts and versions')
uid=next(u['id'] for u in a.api('users')['users'] if u['email']==email_one)
a.api('users/'+uid+'/reset','POST',{'password':TEMP})
one.api('me',expected=401);one.api('login','POST',{'email':email_one,'password':PASS},401)
one.login(email_one,TEMP)
assert one.api('me')['user']['mustChange']
a.api('users/'+uid+'/active','POST',{'active':False});one.api('me',expected=401)
one.api('login','POST',{'email':email_one,'password':TEMP},401)
passed('password reset and deactivation revoke sessions; old credentials cannot log in')
missing,_=anon.req('/blog/story-not-found/',expected=404);assert '글을 찾을 수 없습니다' in missing
admin_html,head=anon.req('/admin/');assert 'noindex' in head.get('X-Robots-Tag','')
passed('unknown posts return 404; staff editor is excluded from indexing')
Path('/tmp/uksinchon-cms-restart-check.json').write_text(json.dumps({'id':id,'revision':revision,'title':'복원한 가상 글'}))
report={'passed':len(checks),'checks':checks,'backend':'Wrangler + persistent local D1','production_db_connected':False,'real_customer_data_used':False}
Path('/workspace/신촌점_직원블로그_통합검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
