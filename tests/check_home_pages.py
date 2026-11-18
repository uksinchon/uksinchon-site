"""Integration against local Wrangler Pages on port 8804, with fictional data only.

Start as documented in docs/HOMEPAGE.md. Never points at a production CMS.
"""
import json
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPCookieProcessor, HTTPRedirectHandler

BASE = 'http://127.0.0.1:8804'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


opener = build_opener(HTTPCookieProcessor(CookieJar()), NoRedirect())
checks = []


def request(path, method='GET', body=None, expected=200):
    headers = {'Origin': BASE}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = Request(BASE + path, method=method, headers=headers,
                  data=None if body is None else json.dumps(body).encode())
    try:
        response = opener.open(req, timeout=30)
    except HTTPError as error:
        response = error
    raw = response.read().decode()
    assert response.status == expected, (path, response.status, raw)
    data = json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw
    return data, response.headers


def api(path, **options):
    return request('/api/cms/' + path, **options)[0]


def passed(message):
    checks.append(message)
    print('PASS', message, flush=True)


html, headers = request('/')
assert '영국 유학, 어학연수' in html and 'note-fallback' in html
assert 'must-revalidate' in headers['Cache-Control'] and 'ETag' not in headers
assert request('/', method='HEAD')[0] == ''
request('/', method='POST', expected=405)
assert 'text/css' in request('/assets/home.css')[1]['Content-Type']
passed('compiled Pages context.next serves the full static template and local assets with correct dynamic response headers')

_, redirect = request('/index.html?utm_source=fixture', expected=308)
assert redirect['Location'] == '/?utm_source=fixture'
assert request('/admin/')[1]['X-Robots-Tag'] == 'noindex, nofollow'
passed('the generated dot route preserves queries in the root redirect and existing admin headers remain active')

api('setup', method='POST', body={'setupToken': 'fictional-home-pages-setup-key-20261118', 'name': 'Admin',
    'email': 'home-pages@example.test', 'password': 'FictionalHomePagesPassword123!'})
post_id = api('posts', method='POST', body={}, expected=201)['id']
draft = {'schemaVersion': 2, 'title': 'Pages 전용 가상 공개 글', 'category': '어학연수',
         'delta': {'ops': [{'insert': '학교 정보가 아닌 로컬 라우팅 검증용 가상 본문입니다.\n'}]}}
api('posts/' + post_id, method='PUT', body={**draft, 'revision': 1})
current = api('posts/' + post_id)
api('posts/' + post_id + '/publish', method='POST', body={'revision': current['post']['revision']})
current = api('posts/' + post_id)
slug = current['post']['slug']
assert draft['title'] in request('/')[0]
assert '/blog/' + slug + '/' in request('/')[0]
api('posts/' + post_id, method='PUT', body={**current['snapshot'], 'title': 'Pages 전용 가상 수정 글',
    'revision': current['post']['revision']})
assert draft['title'] in request('/')[0] and 'Pages 전용 가상 수정 글' not in request('/')[0]
current = api('posts/' + post_id)
api('posts/' + post_id + '/publish', method='POST', body={'revision': current['post']['revision']})
assert 'Pages 전용 가상 수정 글' in request('/')[0]
passed('real Pages routing exposes approved D1 snapshots in initial HTML and keeps private changes hidden until republication')

current = api('posts/' + post_id)
api('posts/' + post_id + '/unpublish', method='POST', body={'revision': current['post']['revision']})
assert 'Pages 전용 가상 수정 글' not in request('/')[0] and 'note-fallback' in request('/')[0]
request('/blog/' + slug + '/', expected=404)
passed('unpublishing removes the note from both real Pages home output and its public detail route')
print(json.dumps({'passed': len(checks), 'checks': checks, 'productionDataModified': False}, ensure_ascii=False, indent=2))
