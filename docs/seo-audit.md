# 신촌점 SEO·AEO·GEO 현황 진단

- 대상: **영국유학센터 신촌점**, `https://uksinchon.com/`
- 조사일: **2026-11-05 한국시간**. 공개 URL·공식 문서 조회: 23:02~23:06 KST / 14:02~14:06 UTC.
- 소스 기준: `dfca42379a47f992b1ee60777858eb75078b71ea`. 원격 `main`도 같은 커밋임을 읽기 조회로 확인했다.
- 단계: **조사·진단·설계만 완료**. 구현·설정 변경·DB 변경·발행·배포를 실행하지 않았다. 이 문서와 [구현 로드맵](seo-roadmap.md)만 새로 작성한다.
- 근거 구분: **소스 확인**, **공개 HTTP 확인**, **가상 렌더링 관찰**, **공식 문서 확인**, **미확인**, **제안**을 구분한다. 가상 원고는 운영 글이나 운영 DB 검증이 아니다.

이 문서는 조사 당시의 기준선이다. 이후 사용자의 실행 요청에 따른 변경·검증·운영 확인 대기는 [첫 구현 기록](SEO_IMPLEMENTATION.md)에 구분해 기록한다.

## 1. 진단 결론

권장안은 **현재 직원 CMS와 서버 HTML 렌더링을 유지하고, 고정 주소·정보 검토·이미지·목록 발견 경로를 보강하는 것**이다. 매일 글을 올리는 운영을 시작하기 위해 프레임워크나 CMS를 다시 선정할 필요는 확인되지 않았다.

이미 있는 기반은 다음과 같다.

- 공개 글마다 `/blog/story-{UUID}/` 주소가 있고 제목을 수정해도 주소가 바뀌지 않는다.
- 공개 승인된 버전만 서버에서 HTML로 만든다. 본문·소제목·출처·canonical·BlogPosting이 초기 응답에 들어간다.
- 목록 페이지에 실제 `<a href>` 링크와 페이지 나누기가 있다. sitemap·RSS도 구현되어 있다.
- 초안과 공개본을 분리하고, 네이버 가져오기에는 원문 해시·초안 버전에 묶인 사람 검수와 별도 공개 승인이 있다.

먼저 보강할 부분은 다음과 같다.

1. 실제 Google·AI 서비스가 공개 HTML과 사진에 접근하는지 계정·로그로 확인한다. 현재 환경의 403만으로 봇 차단을 확정할 수 없다.
2. 발행일·실질 수정일·사실 확인일과 검토 책임을 분리한다. 현재 `verifiedAt` 한 칸과 버전 저장 시각만으로는 부족하다.
3. 이미지별 대체 텍스트·크기·권리·설명, 읽을 수 있는 표를 지원한다. 대규모 미디어 저장소 이동은 별도 판단한다.
4. 홈의 초기 HTML에서 글로 들어가는 길과 주제 안내를 만든다. 현재 홈은 여전히 준비 안내 중심이다.
5. 네이버 글은 문장만 바꾸어 전부 복제하지 않는다. 대표 5개에서 공식 조건·실무 판단·비교 자료를 보완하고 검증한다.

검색 순위·AI 인용·상담 증가는 위 기능의 개발 완료 기준과 구분한다. 색인·대표 URL 선택·인용은 검색 서비스가 결정한다.

## 2. 기존 문서 규칙과 이번 문서의 위치

저장소 루트·상위 경로에 적용되는 `AGENTS.md`나 별도 문서 작성 규칙은 발견하지 못했다. `docs/STAFF_BLOG.md`, `NAVER_IMPORT.md`, `PHARMACY_LANDING.md` 등은 한국어 Markdown, 기준일, 실제 구현 상태, 미확인 사항, 검증 범위를 기록한다. 이 형식을 따른다. 인증 정보·실제 고객 원고·개인정보·DB 덤프는 문서에 넣지 않는다.

`docs/content-strategy/`는 조사 시작 전부터 **추적되지 않은 기존 자료**였다. 읽기만 했으며 수정·추가 추적하지 않는다. 그중 `SITE_PLAN.md`의 ‘CMS 없음’, ‘홈 canonical 없음’, ‘Astro 등 SSG 우선’, `/articles/` 주소 제안은 이후 구현 전의 기록이다. **현재 상태와 후속 기술 판단은 이 진단 및 새 로드맵을 기준**으로 한다. 이전 자료의 콘텐츠 기획 취지는 활용하되 낡은 현황을 그대로 적용하지 않는다.

## 3. 조사한 파일과 재현 범위

| 파일·범위 | 확인 내용 |
|---|---|
| `index.html`, `assets/blog-entry.js` | 준비 안내형 홈, 상담·약대 링크, RSS 확인 후 JS로 블로그 입구를 표시하는 방식 |
| `cms/server/schema.js:7–12` | 글 UUID·slug·소유자, 초안/공개 버전, D1 사진 BLOB, 공개 미디어 연결, 발행 이벤트 |
| `cms/server/content.js:7–54` | 허용된 Delta 형식, 요약·출처·확인일 정리, 서버 HTML, 사진 alt·lazy 처리 |
| `cms/server/pages.js:4–37` | HTML·응답 헤더, 글 메타·날짜·schema, 12개 목록, 필터·페이지 canonical·robots |
| `cms/server/api.js:99–139` | 고정 slug 생성, 저장·검토·발행·공개 내림·미디어 접근 갱신 |
| `admin/index.html`, `admin/editor.js:70–108` | 입력 필드, Quill 서식, 자동 저장, 사진 변환, 미리보기·공개 승인 |
| `cms/server/naver-content.js`, `naver.js`, `naver-api.js` | RSS·본문 추출, 원문 이력, AI 입력/검사, 검수 무효화와 공개 제한 |
| `functions/blog/[[path]].js`, `functions/media/[id].js` | 공개 HTML 경로, 익명·비공개 사진의 권한과 캐시 헤더 |
| `functions/sitemap.xml.js`, `functions/feed.xml.js` | 공개 승인본의 URL·lastmod, RSS 최근 20개 |
| `robots.txt`, `_headers`, `_routes.json` | 저장소의 크롤링 지시, 관리 화면 noindex, Functions 경로 |
| `blog/styles.css`, `pharmacy/`, `seminar-2027/index.html` | 글 본문 스타일, 기존 상담·행사 URL과 정적 메타 |
| `study-path/index.html`, `hello-uk/index.html`, `preview/`의 HTML head | 상담 도구·시안의 noindex, 일부 브랜드 표기 차이 |
| `workers/naver-scheduler/` | 매시간 수집 요청용 코드·예약 선언. 실제 설치·활성화는 미확인 |
| `docs/STAFF_BLOG.md`, `NAVER_IMPORT.md`, `SEMINAR_2027.md`, `content-strategy/`의 Markdown | 기존 운영 설명·조사·양식·초기 설계 |
| `tests/check_cms.py`, `check_cms_browser.py`의 관련 부분 | 기존 검증 범위 확인. 이번에는 DB를 쓰는 통합 테스트를 실행하지 않음 |

별도의 DB를 만들거나 기존 DB를 열지 않았다. `price_manager/`, `.wrangler/`의 DB·상태, Secret 파일은 조사 대상에서 제외했다.

### 가상 렌더링 관찰

현재 `articlePage`와 `publicBlog`를 가상 값·메모리 내 조회 대역으로 호출했다. 임시 산출물은 저장소 밖 `/tmp/seo-audit-20261105/`에만 보관했다. 파일 경로는 이번 세션의 재현 보조 자료이며 장기 보관을 보장하지 않는다. 이 문서에 관찰 결과를 남긴다.

- 글 초기 HTML에 h1, 본문, 출처 링크, JSON-LD가 포함됨.
- 390px Chromium에서 JavaScript 활성/비활성 모두 가상 글 본문·출처를 읽을 수 있었고 가로 넘침이 없었음. 실제 운영 이미지·긴 표·학교 원고의 화면 검증은 아님.
- 일반 `/blog/?page=2`: HTTP 200, 자신의 페이지 URL을 canonical로 출력.
- 유효한 카테고리 필터: `noindex,nofollow`, canonical은 카테고리를 제외한 전체 목록 URL.
- 빈 `/blog/?page=9999`: 현재 HTTP 200, `noindex,nofollow`, 해당 빈 페이지 URL을 canonical로 출력.
- 이 관찰은 SQL·인증·운영 D1 연결·실제 검색 수집·성능 측정의 성공을 뜻하지 않음.

## 4. 공개 사이트·계정 확인 결과

| 조회 URL | 이번 관찰 | 판단 |
|---|---|---|
| `https://uksinchon.com/`, `/blog/`, `/pharmacy/` | 모두 HTTP 403, `error code: 1010` | 이 환경에서 본문·최종 헤더 확인 불가 |
| `https://uksinchon.com/robots.txt`, `/sitemap.xml`, `/feed.xml` | 모두 동일한 403 | 실제 배포된 지시·XML, CDN 추가 지시는 미확인 |
| `https://www.uksinchon.com/` | 동일한 403 | www→대표 도메인 리디렉션은 미확인 |
| `https://uksinchon.com/study-path/`, `/hello-uk/` | 동일한 403 | 공개 도구의 최종 응답·표시 상태 미확인 |
| `https://ukuhak.com/` | 동일한 403 | 참고 사이트의 실제 홈·메뉴·글 구조·성과 분석 불가 |
| GitHub `dfca423`의 Cloudflare Pages check | 성공 기록을 읽기 확인 | 배포 작업 성공 근거이며 크롤러·색인 성공 근거는 아님 |
| Search Console·Cloudflare 운영 대시보드·D1·방문/상담 분석 | 인증된 조회 권한 없음 | 데이터·설정·실제 직원 발행 수 미확인 |

인증서 검증과 환경 프록시를 유지했다. 봇 UA 위장, 차단 우회, 보안 기능 해제는 하지 않았다. **이 환경의 403을 방문자 전체나 Googlebot 차단으로 일반화하지 않는다.** 참고 사이트를 보았다고 가정한 디자인 비교도 하지 않는다.

## 5. 구조 진단

### A01. 실제 수집 가능 여부 — 우선순위 P0, 운영 상태 미확인

저장소 `robots.txt`는 `User-agent: *`, `Allow: /`, sitemap 위치만 선언한다. 별도 봇별 학습 제한은 없다. 그러나 실제 robots 응답·CDN의 관리형 robots·WAF/봇 차단 설정·IP 검증·최종 `X-Robots-Tag`는 확인하지 못했다. 소스 Allow만으로 수집 가능하다고 판정할 수 없다.

후속 확인은 Search Console URL 검사와 실제 검증된 봇 로그를 함께 사용한다. Google-InspectionTool의 테스트 성공만으로 주기적 Googlebot 수집까지 성공했다고 보지 않는다. 원인 확인 전 SSR 교체나 사이트 전체 보안 해제를 제안하지 않는다. [로드맵 R00, R08](seo-roadmap.md#작업-목록)을 따른다.

### A02. 렌더링 — 기반 양호, 전면 재구축 근거 없음

정적 홈·상담 페이지와 **Pages Functions + D1 기반 서버 HTML 블로그**가 공존한다. 블로그의 공개 본문·메타·목록 링크는 JS 실행을 기다리지 않는다. Google은 렌더링할 수 있지만 모든 검색/AI 수집기가 JS를 실행한다고 가정할 수 없으므로 현재 구조가 유리하다.[G01][G02]

SSR 도입은 앞으로 할 일이 아니라 이미 있는 특성이다. SSG로 옮기면 발행마다 빌드·초안 미리보기·공개 내림·사진 접근 회수·빌드 실패 복구가 추가된다. 프레임워크 교체의 순위 이점은 확인되지 않았다. 실제 TTFB·트래픽·D1 비용·지연이 측정된 뒤 공개본 캐시나 일부 정적화를 비교한다. 현재 응답의 `max-age=0, must-revalidate`는 확인되지만 실제 CDN 재사용·DB 사용량은 미측정이다.

### A03. 글 식별자·slug·URL — 고정성을 유지할 것

`cms_posts.id`와 `slug`는 별도 필드다. 일반 작성과 네이버 가져오기 모두 생성 시 `story-{UUID}`를 넣는다. 제목·카테고리 저장 API에 slug를 수정하는 동작은 없다. 발행 후 제목을 바꾸어도 주소가 유지되는 점은 장점이다.

의미 있는 짧은 slug는 사람에게 읽기 쉬울 수 있으나 UUID가 검색 부적격이라는 근거는 없다. 현재 글을 `/articles/`로 옮기는 일은 첫 범위에서 제외하는 것을 권장한다. `/blog/`를 유지하며 관계·주제 분류는 ID로 관리한다. 의미형 slug를 나중에 도입하더라도 첫 발행 전에만 확정하고 이후에는 명시적 주소 변경·별칭 기록이 필요하다. 실제 기존 글 목록을 열지 못했으므로 개별 UUID 대응표는 아직 만들 수 없다. [로드맵의 주소 대응 원칙](seo-roadmap.md#주소-대응과-리디렉션-계획)을 따른다.

정적 페이지의 `/index.html` 링크와 대표 canonical 경로가 혼재한다. Cloudflare가 이미 정규화하는지 미확인이므로 리디렉션을 중복 추가하지 않는다. 쿼리·슬래시·www 변형의 실제 응답부터 확인한다.

### A04. 목록·카테고리·페이지네이션 — 기본은 갖추었고 정책 보완 필요

- 전체 목록은 12개 + 다음 글 존재 판정용 1개를 조회한다. 이전/다음은 초기 HTML의 `<a href>`다.
- 일반 2페이지부터 자신의 URL을 canonical로 사용한다. 전부 1페이지로 합치는 오류는 없다.[G03]
- 카테고리는 현재 한글 라벨 6개의 쿼리 필터이며 `noindex,nofollow`다. 독립적인 검색용 주제 안내 페이지가 아니다.
- 필터 canonical에서 카테고리를 제거한다. 필터를 검색 제외하려는 정책과 ‘전체 목록의 중복’이라는 신호가 혼재한다. 카테고리 콘텐츠를 검색에 노출하려면 별도 주제 소개·대표 글·자기 canonical이 필요하다.
- 빈 깊은 페이지가 200을 반환한다. 소프트 404와 불필요한 URL 증가 가능성을 점검해야 한다.
- 같은 발행 시각의 정렬에 ID 같은 보조 키가 없다. OFFSET 방식에서는 새 글 삽입 중 중복/누락도 생길 수 있어 25개 이상 표본으로 경계·정렬을 확인한다. 당장 커서 URL 전환이 필수인 규모라는 증거는 없다.
- Google은 `rel=next/prev` 자체를 페이지 관계 신호로 쓰지 않는다. 링크의 존재·목적지·고유 URL·canonical을 검증한다.[G03]

### A05. 날짜·검토 책임 — 먼저 고칠 데이터 의미

| 현재 값 | 확인된 의미 | 보완점 |
|---|---|---|
| `cms_posts.created_at` | 초안 생성 시각 | 공개 발행일과 구분 유지 |
| `published_at` | 첫 승인 때 설정, 재승인 때 보존 | 최초 사이트 발행일로 유지. 네이버 원문 발행일과 분리 |
| `cms_posts.updated_at` | 저장·검토·승인 등 작업 시각 | 사용자에게 보여주는 실질 수정일로 쓰지 않을 것 |
| 공개 버전 `cms_versions.created_at` | 현재 공개 스냅샷의 저장 시각 | 현재 `dateModified`, byline 수정일, sitemap lastmod에 사용. 내용 변화의 실질성을 구분하지 않음 |
| snapshot `verifiedAt` | 사람이 입력한 날짜. 달력 형식 검증 | 검토자·근거·검토 범위·적용 학년도·다음 확인일 없음. 실제 사실 확인을 증명하지 못함 |
| 네이버 `published_at`, `fetched_at`, `approved_at` | 원문 발행, 수집, 원문/초안 대조 승인 | 세 시각을 사이트 발행·공식 사실 검토일로 대체하지 않을 것 |

공개 버전 저장은 최초 공개보다 앞설 수 있어 처음 발행할 때 `dateModified`가 `datePublished`보다 이르게 나올 가능성도 있다. 원고 변경 없이 저장된 새 버전·서식만 바꾼 버전·사실 검토만 한 버전을 구분하지 않는 점이 핵심이다. 반대로 비공개 초안 수정이 공개 글 수정일에 바로 반영되지 않는 현재 분리는 유지할 가치가 있다.

`verifiedAt`는 출처 목록이 있을 때만 페이지에 출력된다. 날짜와 책임자를 독립적인 발행 메타로 관리하고, 독자가 보는 날짜·구조화 데이터·sitemap을 같은 승인본에서 생성하도록 제안한다.[G04]

### A06. 이미지와 표 — 콘텐츠 축적 전에 확장 경계 결정

현재 사진은 브라우저에서 긴 쪽 1600px 이내 WebP로 변환하고 한 장 900,000바이트 이하로 받는다. 원본 파일은 남기지 않으며 D1 `cms_media.data` BLOB에 보관한다. 공개 승인본의 사진만 `/media/{UUID}`에서 익명 접근할 수 있다.

- 모든 이미지 alt가 `본문 사진`으로 고정되고 width/height, srcset, 설명·권리·출처 필드가 없다.
- 모든 이미지를 lazy로 출력한다. 첫 화면의 큰 대표 이미지도 같은 처리일 수 있어 LCP를 측정해 구분해야 한다.
- 1600px 사진 하나가 모바일에도 전달된다. 용량·레이아웃 안정성의 개선 여지가 있으나 실제 속도 저하 수치는 측정하지 않았다.
- Quill 허용 형식·서버 sanitizer·renderer에 표가 없다. 네이버의 이미지 표를 사진으로만 복사하면 비교 정보·접근성이 보존되지 않는다.
- 이미지 URL이 확장자 없는 UUID라는 이유만으로 바꿀 필요는 없다. URL 안정성과 올바른 MIME·접근 권한을 우선한다.

**최소안:** 기존 D1와 `/media/{id}`를 유지하며 이미지 사용별 alt·캡션·권리, 파일의 width/height를 추가하고 안전한 표 블록을 지원한다. **구조안:** 원본·파생본을 비공개 R2 등에 저장하고 `/media/{id}`를 안정적인 접근 계층으로 유지한다. 초안 보호와 공개 내림 후 접근 회수를 같은 방식으로 보장해야 한다. 공개 버킷으로 전부 옮기는 방식은 현재 권한 모델을 훼손한다.

D1/R2 공식 한도·요금 문서는 이번 환경에서 403이었다.[X03] 비용·보존 기간·계정 한도는 미확인이다. 미디어 수·총량·증가율·실제 비용을 확인한 뒤 저장소를 이동한다. ‘무료라 무제한’ 또는 특정 가격을 전제로 선택하지 않는다.

### A07. 콘텐츠 모델·직원 입력 — 부족한 구조를 본문 양식으로만 해결하지 않을 것

현재 snapshot은 제목, 카테고리 라벨, 요약, Delta 본문, 출처 URL 문자열, 확인일, 작성자 이름이다. 글 유형·적용 연도/학년도·조건·공식 출처 구분·검토자·다음 확인 시점·관련 글 ID·대표 이미지가 없다. 카테고리 라벨 변경은 기존 글 필터와 연결될 수 있다. 작성자 이름은 저장 시 현재 소유자 이름으로 들어가므로 공개 인물 ID와 이름 변경 정책도 정해야 한다.

모든 글에 FAQ·표·학교 조건 양식을 강제하지 않는다. 입학 안내는 지원 조건과 예외, 비교 글은 동일 조건 표, 사례는 실제 선택 과정과 공개 동의, 소식은 유효 기간과 다음 행동이 중심이다. 시스템은 URL·날짜 직렬화·메타·sitemap을 처리하고, 직원은 사실과 판단의 근거에 집중하도록 한다.

### A08. 내부 발견 경로·홈 — 점진적 프롤로그로 발전할 준비 필요

홈에는 `/blog/` 링크가 처음부터 있으나 `hidden` 상태다. RSS에 첫 공개 글이 있을 때 JS로 표시한다. 브라우저 렌더링 이후에는 발견될 수 있어도 JS를 실행하지 않는 수집기와 사용자에게 처음부터 보이는 입구는 아니다. 글 목록의 순차 링크와 sitemap은 이미 있으므로 ‘글 발견 경로가 전혀 없다’고 진단하지 않는다.

지금은 소개·최근 글·상담 경로부터, 내용이 쌓이면 편집자가 고른 대표 글·주제 안내·시작 안내를 더하는 홈을 권장한다. 공개 글 주소와 CMS는 그 과정에서 유지한다. 실제로 없는 글·빈 주제 페이지를 미리 만들지 않는다. 글 상세에는 상위 주제와 다음 질문의 관련 글을 연결한다.

### A09. 메타데이터·실제 기관 정보 — 보완과 사실 확인을 분리

글의 title·description·canonical·기본 OG·BlogPosting은 존재한다. 대표 이미지 OG, 작성자 고유 페이지/URL, 경로 표시, 주제별 schema는 아직 없다. 목록도 공통 shell에서 `og:type=article`로 출력된다. 이는 세부 개선 대상이며 현재 글 본문이 없다는 뜻은 아니다. schema에 없는 자격·평점·성과를 만들지 않는다.[G05]

`study-path/`, `hello-uk/`는 소스상 `noindex,nofollow`인 상담 도구이며 일부 title·description에 ‘신촌지사’가 남아 있다. 공식 브랜드 ‘신촌점’으로 정리할 범위를 후속 작업에 넣되, 이번에는 변경하지 않았다. 홈의 ‘브리티시 카운슬 공인’ 같은 자격 표현은 증빙을 별도로 확인해야 한다. 조사로 실제 자격을 인증한 것은 아니다.

`/seminar-2027/`는 본사 공지 재현 성격이며 날짜는 2026-11-04다. 메인 안내 삭제와 상세 페이지의 종료 상태는 별개다. 기존 URL을 유지하면서 종료 표시·현재 문의 경로·원문 출처를 검토한다. 행사 신청이 지금도 열려 있다고 가정하거나 새로운 행사 날짜를 만들지 않는다. 원본과 유사한 페이지의 대표 URL이 본사로 선택될 가능성도 있다.[G06]

### A10. 네이버·AI 재편집 — 사람 검수는 있으나 새 가치의 자동 생성은 아님

원문 텍스트·해시·이력, AI 모델/프롬프트 버전, 근거 문구, 현재 버전 대조 검수가 구현되어 있다. 원문 또는 초안이 바뀌면 검수를 다시 요구하고 공개 API에서 재확인한다. 이미지·OCR·공식 학교 사이트 확인은 AI 입력에 포함되지 않는다.

현재 AI는 원문 밖의 수치·조건을 추가하지 않도록 제한된다. 이는 보존할 장점이지만 **최신 공식 자료와 상담 해석을 자동으로 보충하는 기능은 아니다.** 새로운 자료를 수집·사람이 확인하는 단계와 원문 재편집 단계를 분리해야 한다. 근거 문구가 원문에 있다는 검사로 주장 전체의 정확성·현재 유효성을 보증할 수 없다.

실제 운영 관리자 생성, 공개 글 수, API 키·모델 사용 가능 여부, 예약 Worker 설치·청구 한도·정기 실행은 미확인이다. 기존 구현·과거 로컬 검증 기록과 운영 활성화 완료를 구분한다.

## 6. 네이버 재게시 운영 전략

### 제어 가능한 범위

| 영역 | 자사 사이트 | 네이버 블로그 |
|---|---|---|
| 글 본문·제목·내부 링크 | 자체 코드·CMS로 제어 | 운영자가 원고를 편집할 수 있는 범위. 실제 계정 권한은 미확인 |
| canonical·HTTP 리디렉션·응답 헤더 | 제어 가능. Google 선택을 보장하지 않음 | 일반 글 편집으로 플랫폼의 head/헤더를 자유롭게 바꾸는 전제는 두지 않음. 외부 canonical 지정 기능·권한은 확인 못함 |
| sitemap·robots·서버 상태 | 사이트와 Cloudflare 운영 설정으로 제어 | 네이버 플랫폼 정책·구현 영역. 자사 파일로 바꾸지 못함 |
| 검색 결과의 대표 URL·순위 | Google이 결정 | 동일하게 운영자가 보장할 수 없음 |

발행 순서, 원문 링크, self-canonical은 의도를 전달하는 요소다. 먼저 사이트에 발행하거나 며칠 간격을 두는 것만으로 사이트가 대표 URL이 되지는 않는다.[G06] 자사 글을 검색시키고 싶으면서 일괄적으로 네이버를 canonical로 지정하는 방식도 맞지 않는다. 내용상 거의 같은 글은 어느 한쪽만 대표로 선택될 수 있음을 받아들여야 한다.

### 기존 글

1. 최근 RSS 50개 전체를 자동 재발행하지 않는다. 현재 유효성·상담 수요·보완 가능성으로 선별한다. RSS 밖의 글은 수동 목록/개별 URL로 관리한다.
2. 종료된 행사·지난 할인·바뀐 입학 조건은 기록으로 보존하거나 최신 안내로 통합한다. 현재 모집 정보처럼 재포장하지 않는다.
3. 자사판에는 적용 학년도·대상/예외·학교 공식 링크·확인 범위·신촌점의 상담 판단을 넣는다. 네이버 원문은 참고 자료로 남기되 공식 출처와 구분한다.
4. 원고를 실질적으로 보완할 수 없으면 네이버 글을 유지하고 사이트의 관련 안내에서 링크하는 방안도 사용한다. 단순 복제 수를 성과로 세지 않는다.

### 앞으로 쓰는 새 글

직원은 지금 익숙한 네이버 작성 흐름을 계속 쓸 수 있다. 원자료에서 사실·출처·그림 권리·독자 질문을 함께 정리하고 사이트용 심층판을 사람 검토로 완성한다. 사이트에 먼저 쓰는 방식은 팀이 익숙해진 뒤 비교할 선택지이며 필수 전환 조건이 아니다.

권장 역할은 **네이버: 독자의 관심을 여는 이야기·사례·요약**, **사이트: 조건·비교·업데이트가 축적되는 기준 문서**다. 같은 주제를 다루어도 제목만 바꾸지 않고, 독자가 사이트를 방문해야 얻는 실질 정보를 만든다. 양쪽에 필요한 경우 서로 설명 있는 링크를 제공하되 링크만으로 대표 URL이 확정된다고 설명하지 않는다.

### 실제 Google 선택 확인

사이트의 개별 공개 URL을 Search Console URL 검사에서 조회한다. **색인된 버전**의 사용자 선언 canonical·Google 선택 canonical·마지막 크롤링을 기록한다. 실시간 검사 성공만으로 Google 선택 canonical을 판단하지 않는다. 다른 사이트 URL을 검사할 권한이 없으면 네이버 계정의 Search Console 데이터를 볼 수 있다고 가정하지 않는다.[G07]

대표 5개는 공개 직후 기술 상태를 확인하고, 재크롤링·색인 데이터가 생기면 2주·4주 검토 시점에 다시 기록한다. 이는 색인 보장 기한이 아니다. `site:` 검색이나 제목 검색은 보조 관찰일 뿐 전체 색인 수·대표 URL의 확정 도구가 아니다. 네이버가 선택되면 중복성·본문 기여·내부 링크·정규화 신호·수집 상태를 함께 진단한다.

## 7. 대표 글 표본 5개

2026-11-05 네이버 RSS HTTP 200, 항목 50개를 확인했다. 아래 5개는 공개 `PostView.naver`의 본문 영역도 HTTP 200으로 읽었다. 제목·텍스트 범위·사진 참조 개수만 확인했고, 사진 파일을 내려받거나 OCR·학교 조건 사실 검증·사용 권리 확인을 하지 않았다. **게시 대상으로 선정한 검증 후보이며 공개 승인은 아니다.**

| 표본 | 원문 URL·주제 | 본문 추출 / 이미지 참조 | 사이트판에서 추가 검토할 가치 |
|---|---|---|---|
| P1 | https://blog.naver.com/pedu2/224442365768 — 리버풀 약대 파운데이션, 2027 입학 | 3,553자 / 5개 | 과정·입학년도·성적/과목·진학 조건 구분. 약사 자격을 입학 조건과 분리. 공식 학교/자격기관 확인 전 보장 표현 사용 금지 |
| P2 | https://blog.naver.com/pedu2/224408275837 — 공무원 어학연수 대학부설 비교 | 5,229자 / 7개 | 비교 조건·수업량·숙소·포함/제외 비용·기관별 휴직 인정 확인 범위를 읽을 수 있는 표로 제시 |
| P3 | https://blog.naver.com/pedu2/224466258454 — 2026년 11월 어학원 국적비율 | 1,470자 / 22개 | 자료 기준월·학교/캠퍼스·집계 범위·변동 가능성. 국적비율만으로 추천하지 않는 상담 해석. 사진 속 수치를 별도 확인 |
| P4 | https://blog.naver.com/pedu2/224465727870 — 본머스 범죄심리학 석사 후기 | 3,275자 / 14개 | 실제 선택 과정·대안·조건별 조언. 증언과 일반 입학 요건을 구분하고 사이트 재게시·사진·식별 가능성 검토 |
| P5 | https://blog.naver.com/pedu2/224440279774 — 엑시터 2027 석사 장학금 | 1,384자 / 12개 | 대상·과정·국적·조건·마감·중복 수혜·통화·환산 기준·종료 상태. 원문의 금액을 현재 조건으로 자동 승계하지 않음 |

이 조합으로 입학 안내·비교 표·이미지 중심의 시점 자료·사례·기간 한정 소식을 각각 검증한다. 모든 글을 같은 FAQ 틀로 바꾸는 실험이 아니다. 공식 근거·권리 확인이 어려운 후보는 같은 유형의 확인 가능한 글로 바꾸고 이유를 기록한다.

## 8. 공식 지원 여부와 AI 서비스별 접근 정책

### FAQPage·llms.txt

2026-11-05 조회에서 Google FAQPage 문서는 업데이트 페이지로 이동했다. 공식 기록은 **2026-05-07부터 FAQ 리치 결과 종료**, 2026-06-15 관련 문서 제거를 명시한다.[G08] 이전의 ‘정부·의료 사이트만 지원’ 설명을 현재 권장안으로 사용하지 않는다. 독자에게 필요한 질문·답변 본문은 사용할 수 있지만 FAQPage로 검색 표시 확대를 얻겠다는 개발 항목은 제외한다. 다른 서비스에서의 소비를 입증하지 못했으므로 AI 인용을 위한 필수 schema로도 삼지 않는다.

Google의 2026년 AI 최적화 가이드는 `llms.txt` 등 AI 전용 파일을 Google Search가 쓰지 않으며 노출·순위에 긍정/부정 영향을 주지 않는다고 명시한다.[G01] 원 제안 사이트는 이번 환경에서 403이어서 최신 규격 전체를 읽지 못했다.[X04] 다른 서비스의 명시적인 사용 목적·소비자·갱신 책임이 생길 때 선택 기능으로 검토한다. 크롤링 허용·인용·학습 제어 파일로 간주하지 않는다.

### 수집·사용 목적별 구분

아래는 설정을 변경한 결과가 아니라 **2026-11-05 읽은 공식 문서에 따른 검토표**다. 모든 AI 제공자를 한 정책으로 제어할 수 있다고 가정하지 않는다.

| 서비스·제어 | 목적과 확인된 동작 | 허용·제한의 영향 및 후속 확인 |
|---|---|---|
| Googlebot | 검색 색인과 Google Search 기능을 위한 자동 수집. robots 적용 [G09] | 차단하면 일반 검색과 AI 검색의 콘텐츠 발견에 영향을 줄 수 있음. 검색 표시·생성형 AI 포함 설정도 별도 점검 |
| Google-InspectionTool | URL 검사 등 테스트용 수집 [G09] | 테스트 성공은 Googlebot의 지속 수집 성공과 구분. 실제 로그도 확인 |
| Google-Extended | 별도의 HTTP UA가 아닌 robots 정책 토큰. 모델 훈련 및 문서에 명시된 Gemini Apps/Vertex AI의 grounding 제어 [G09] | 차단이 일반 Google Search 제외·순위 신호는 아님. Gemini의 근거 답변·링크 유입에도 영향을 줄 수 있어 ‘학습만 끄는 독립 스위치’라고 단순화하지 않음 |
| Search Console의 Search generative AI control | Search AI Overviews·AI Mode·명시된 Discover 기능의 링크/콘텐츠 포함·제외 [G10] | 일반 검색 표시·학습 제어와 별개. 부모 속성 상속/하위 재정의까지 읽기 확인 필요 |
| OpenAI OAI-SearchBot | ChatGPT 검색용 수집. robots와 공식 IP 허용 권장 [O01] | 제외하면 검색 답변에 표시되지 않으며 탐색용 링크는 남을 수 있음. 허용은 인용 보장 아님 |
| OpenAI GPTBot | 생성형 기초 모델 훈련에 쓰일 수 있는 수집 [O01] | 검색봇과 독립 제어. 검색 유입을 위해 학습 허용이 필수라는 근거 없음 |
| OpenAI ChatGPT-User | 사용자가 요청한 페이지 조회. 자동 웹 크롤러 아님 [O01] | robots가 적용되지 않을 수 있으며 검색 포함 여부 제어를 대체하지 않음. 인증/HTTP 접근 제한은 별도 |
| PerplexityBot | Perplexity 검색용. 기초 모델 훈련용 아님 [P01] | robots 및 공식 IP·UA 조합 확인. WAF에서 실제 응답을 확인해야 함 |
| Perplexity-User | 사용자 요청에 따른 조회. 문서는 일반적으로 robots를 무시한다고 설명 [P01] | 자동 검색봇 허용·학습 수집과 구분. 사용자 조회도 호스팅 차단에 막힐 수 있음 |
| Claude/Anthropic | 공식 안내 URL이 HTTP 403 [X01] | 현재 봇 이름별 목적·robots 적용·허용/차단 효과를 이번에 공식 검증하지 못함. 추정 규칙을 적용하지 말고 공식 본문 확보 후 검색/사용자 조회/학습별로 결정 |
| Bing/Copilot | 2023 공식 공지에는 Bing Chat과 훈련에 대한 NOCACHE/NOARCHIVE 효과가 있음 [B01] | 현재 도움말은 HTTP 200이나 본문이 없는 JS shell만 확보. 2023 동작을 2026 Copilot 전체 정책으로 확정하지 않음. 최신 공식 본문·로그 확인 전 이 태그 도입 보류 [X02] |
| 그 밖의 AI | 자체 수집·검색 API·다른 색인 이용 여부가 서비스마다 다름 | 공통 ‘모든 AI 허용’이나 인용 보장을 만들지 않음. 중요 유입 서비스부터 문서·로그·실제 답변 표본 추가 |

Google은 2026-10-30 공식 공지에서 AIPREF 기반 공유 학습 제어 지원을 **2027년 계획**으로 설명한다.[G11] 현재 모든 업체에 적용되는 확정 표준처럼 배포하지 않는다. `Google-Extended`와 Search Console 포함 설정을 혼동하지 않는다.

### robots 외에 확인할 계층

1. 실제 응답의 robots.txt 및 Cloudflare 관리형 지시가 저장소와 다른지 확인.
2. HTML robots·봇 전용 meta·HTTP `X-Robots-Tag`·canonical을 최종 응답에서 확인.
3. `nosnippet`, `max-snippet`, `data-nosnippet` 등 미리보기 제한과 생성형 AI 포함 설정을 확인. `noindex`는 검색 제외이며 학습 제어의 대체재가 아님.[G12]
4. 로그인·JS challenge·봇 차단·속도 제한·국가/IP 정책·미디어 별도 차단을 확인. 호스팅 보안 화면에서 실제 적용 규칙 ID와 이벤트를 읽음.
5. UA 문자열만 믿지 않고 Google의 DNS/IP 검증, 각 제공자의 최신 공식 IP 범위와 실제 로그를 함께 대조. 가짜 UA 요청의 성공을 해당 봇 접근 성공으로 보고하지 않음.

공식 Perplexity 문서는 Cloudflare Bot Fight Mode가 custom skip 규칙으로 우회되지 않는 한계도 설명한다.[P01] 따라서 ‘Allow 규칙 하나면 해결’로 확정하지 않는다. Cloudflare 자체 문서·계정의 현재 기능/플랜은 이번에 확인 못했으며 최소 범위의 규칙 조정은 후속 구현 검토 대상이다.[X03]

## 9. Search Console과 측정

공식 도움말은 **2026-08-31 전 세계 사이트 대상** Search generative AI control 및 별도 Generative AI performance report 제공을 명시한다.[G10][G13] 현재 신촌점 속성의 권한·포함 설정·상속·보고서 표시·데이터는 모두 **미확인**이다.

후속 읽기 확인 절차:

1. `uksinchon.com` 도메인 속성과 운영 `https://uksinchon.com/` URL-prefix 속성 및 소유권·권한 확인.
2. Settings → Search generative AI에서 포함/제외/상속과 부모/하위 속성 재정의 기록. 공식 기본값 Include를 실제 계정 값으로 대체해 기록하지 않음. 이번에는 설정을 변경하지 않음.
3. Generative AI performance report 유무와 날짜 범위 확인. 안 보이면 권한·속성·제외 설정·노출 데이터 부족을 구분. 단순히 기능 미지원 또는 AI 노출 0건으로 판정하지 않음.
4. 현재 공식 보고서는 AI Overviews·AI Mode **노출수**를 설명한다. 페이지·국가·날짜·기기 등으로 내려받고 PT 날짜를 한국 운영일과 구분. Search Labs 실험 데이터는 포함되지 않음.
5. 일반 Web 성과에도 AI 기능 트래픽이 포함되므로 두 보고서 수치를 더해 총 노출을 만들지 않음. 별도 보고서에서 모든 AI의 인용·클릭·상담을 측정할 수 있다고 가정하지 않음.

이전 `ai-features` 문서는 Web 성과에 포함된다는 설명을 유지하고 있다. 더 최근의 2026 가이드와 보고서 도움말을 함께 읽고 별도 보고서 ‘없음’이라는 과거 전제를 수정했다.[G01][G02][G13]

| 구분 | 개발·운영 확인 수단 | 현재 상태 |
|---|---|---|
| HTML·링크·메타·발행 권한 | 로컬 표본/후속 개발 테스트, 승인본 대조 | 소스·가상 HTML만 이번에 확인 |
| 실험실 성능 | 동일 장치·네트워크 조건의 Lighthouse/DevTools, 대표 이미지·표 포함 3회 비교 | 이번 수치 측정 안 함. 가상 렌더링 성공과 구분 |
| 실제 사용자 성능 | 배포 후 CrUX·GSC CWV 또는 승인된 RUM, 모바일/PC 분리 | 권한·트래픽·데이터 부족 여부 미확인 |
| 일반 검색 성과 | GSC 색인·쿼리/페이지별 노출·클릭·CTR | 미확인 |
| Google 생성형 AI | 포함 설정, 생성형 AI 보고서, 날짜 있는 답변 표본 | 공식 제공 확인 / 사이트 값 미확인 |
| 다른 AI | referrer/유입 경로와 서비스별 질의 표본·실제 링크 | 미측정. referrer 누락을 비노출로 단정하지 않음 |
| 상담 | 문의 버튼 클릭과 실제 수신·유효 상담을 분리한 집계 | 블로그는 단순 채널 링크. 클릭=접수 또는 Lead로 집계할 수 없음 |

실제 사용자 CWV의 좋은 수준은 p75 LCP ≤2.5초, INP ≤200ms, CLS ≤0.1이다.[W01] 일반적인 Lighthouse 페이지 로드 검사의 TBT를 실제 INP로 부르지 않는다. 실험실 목표는 회귀 방지·병목 발견용이고 배포 후 현장 데이터의 대체재가 아니다. 트래픽이 적어 표본이 부족하면 그대로 기록한다.

## 10. 미확인 사항과 확보 방법

| 미확인 | 필요한 근거 | 그동안 계속 가능한 작업 |
|---|---|---|
| 실제 승인 글·계정 수, 운영 검수 흐름 | 관리자가 비공개 화면에서 확인한 목록·역할 및 대표 5개 사용 기록 | 소스 모델·파일 구조·공식 지침 기반 설계 |
| GSC 색인·선택 canonical·생성형 AI 설정/보고서 | 읽기 권한 또는 개인정보를 제외한 해당 화면·내보내기 | 메타·주소 정책 및 확인 절차 설계 |
| 실제 Googlebot/AI 접근 | Cloudflare 보안 이벤트·검증된 봇 로그·응답 기록 | 봇 목적·통제 범위 비교 |
| 이미지 용량·D1 비용·R2 한도/요금 | 계정 지표와 현재 공식 문서 | 기존 URL·권한 유지하는 확장 설계 |
| 실제 네이버 head 편집 권한·재게시 권리 | 계정 UI·플랫폼 안내·사진/사례 권리 확인 | 본문 중심의 선별 재게시 기획 |
| 학교·장학금·약사 자격의 최신 사실 | 해당 학년도 공식 학교/자격기관 자료와 실제 검토자 | 원문 구조 분석과 검증 후보 선정 |
| 영국유학닷컴 화면·구조 | 접근 가능한 공개 화면/제공 자료 | 신촌점 자체 진단·점진적 홈 설계 |
| Claude·현행 Bing·Cloudflare 공식 지원 세부 | 현재 공식 문서 본문과 계정 기능 | 확인된 서비스부터 정책표 작성, 미검증 설정 보류 |

미확인은 구현을 시작하기 위한 중간 승인 질문으로 돌리지 않았다. 다음 문서에 의존관계·완료 기준·복구 방법까지 정리했다.

## 11. 공식 조사 근거

모두 **2026-11-05** TLS 검증을 유지해 조회했다. 링크는 조사 시점의 문서이며 후속 구현에서 변경 여부를 재확인한다. 공식 문서의 설명과 실제 사이트 설정을 구분한다.

| ID | URL·확인 내용 |
|---|---|
| G01 | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide — HTTP 200. 2026년 가이드, 독자에게 새로운 정보·SEO 기반·포함 설정·llms.txt/특정 문체/조각내기 비필수 |
| G02 | https://developers.google.com/search/docs/appearance/ai-features 및 https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics — 각 200. 검색 스니펫 자격·접근·텍스트·JS 처리 |
| G03 | https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading — 200. 고유 URL·순차 링크·각 페이지 canonical |
| G04 | https://developers.google.com/search/docs/appearance/publication-dates — 200. 공개/실질 갱신일과 가시 날짜·구조화 데이터 |
| G05 | https://developers.google.com/search/docs/appearance/structured-data/article — 200. 실제 글의 Article 계열 메타 |
| G06 | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls — 200. canonical·redirect·sitemap은 신호이며 Google이 대표를 결정 |
| G07 | https://support.google.com/webmasters/answer/9012289 — 200. URL 검사와 Google 선택 canonical, 색인/실시간 검사의 구분 |
| G08 | https://developers.google.com/search/docs/appearance/structured-data/faqpage → https://developers.google.com/search/updates#removing-faq-rich-result — 200. 2026-05-07 종료·06-15 문서 제거 |
| G09 | https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended → https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers — 200. 봇 목적·정책 토큰·Google-Extended 범위 |
| G10 | https://support.google.com/webmasters/answer/16908024 — 200. Search generative AI control, 기본/상속/제외·대상 서비스 |
| G11 | https://developers.google.com/search/blog/2026/10/ai-training-control — 200. 공유 학습 제어 지원은 2027년 계획 |
| G12 | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag 및 https://developers.google.com/search/docs/crawling-indexing/control-what-you-share — 각 200. 표시 제한·검색과 기타 사용 통제 구분 |
| G13 | https://support.google.com/webmasters/answer/16984139 및 https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports — 각 200. 생성형 AI 성과 보고서, 제공 범위·데이터 부족·노출수 |
| G14 | https://developers.google.com/search/docs/fundamentals/creating-helpful-content — 200. 독창적 경험·분석·근거와 사람을 위한 작성 |
| O01 | https://platform.openai.com/docs/bots → https://developers.openai.com/api/docs/bots — 200. 검색/훈련/사용자 조회 분리·공식 IP |
| P01 | https://docs.perplexity.ai/guides/bots → https://docs.perplexity.ai/docs/resources/perplexity-crawlers — 200. 검색/사용자 조회·robots·IP/WAF 지침 |
| B01 | https://blogs.bing.com/webmaster/2023/9/Announcing-new-options-for-webmasters-to-control-usage-of-their-content-in-Bing-Chat/ — 200. **2023년 공지**라는 한계를 유지 |
| W01 | https://web.dev/articles/vitals — 200. 현장/실험실 측정·CWV 임계값·TBT/INP 구분 |
| X01 | https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler — 403. 최신 본문 미확인 |
| X02 | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a 및 https://www.bing.com/webmasters/help/which-robots-metatags-does-bing-support-5198d240 — 200이나 초기 본문 없는 shell. 현행 AI 정책 근거로 채택하지 않음 |
| X03 | https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/ · https://developers.cloudflare.com/ai-crawl-control/features/robots-txt/ · https://developers.cloudflare.com/d1/platform/limits/ · https://developers.cloudflare.com/r2/data-access/public-buckets/ — 모두 403. 계정별 지원·한도·요금 미확인 |
| X04 | https://llmstxt.org/ — 403. 규격 최신 본문 미확인. Google의 지원 판단은 G01에 근거 |

네이버 공개 RSS `https://rss.blog.naver.com/pedu2.xml` 및 표본 5개의 공개 본문 읽기는 모두 200이었다. `PostView.naver?blogId=pedu2&logNo={글번호}&redirect=Dlog&widgetTypeCall=true&directAccess=false`로 제공된 공개 본문을 읽었고, 원문 전체·사진·실제 고객 자료를 이 저장소에 복사하지 않았다.
