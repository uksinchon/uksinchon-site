# 공개 작성자 표시와 Google 색인 운영 점검

확인일: **2026-11-17 한국시간** · 관련 로드맵: [R04·R06·R08](seo-roadmap.md)

## 요청 판단과 확인 범위

사용자가 전달한 최적화 제안을 현재 코드와 Google 공식 문서에 대조했다. 전달된 메일의 주장 자체를 운영 설정·색인 상태의 검증 결과로 취급하지 않았다. 원본 메일·서명·회신 초안은 공개 저장소에 포함하지 않는다.

| 항목 | 판단·조치 | 남은 확인 |
|---|---|---|
| Search Console 속성 등록 | 타당하다. 기존 속성이 있는지 먼저 확인하고, 없는 경우에만 소유권을 확인한다 | 이 환경에 해당 Google 계정 세션·Search Console 연결이 없어 등록 여부 미확인·미실행 |
| 사이트맵 제출 | 타당하다. `/sitemap.xml`은 코드에서 공개 승인본만 자동 반영한다 | 운영 XML의 실제 내용·Search Console 제출/처리 결과 미확인·미실행 |
| UCL 글·약대 URL 검사 | 우선 처리할 소수 URL로 적절하다. 실시간 접근과 색인된 버전의 상태를 나누어 확인한다 | 계정 접근이 없어 검사·색인 생성 요청 미실행 |
| 모든 글을 발행할 때마다 수동 색인 요청 | 필수 운영 규칙으로 채택하지 않는다. 공개 글의 사이트맵·내부 링크를 기본 경로로 유지하고 중요한 신규/수정 URL을 선별 요청한다 | 반복 요청은 수집을 가속하지 않고, 요청에도 색인·노출 보장은 없다 [G1] |
| `Admin` 작성자 표시 개선 | 블로그 목록·상세·미리보기와 JSON-LD가 같은 작성자 판정을 사용하도록 수정했다 | 실제 운영 응답은 아래의 접근 제한으로 확인하지 못함 |
| 기존 실명 작성자의 일괄 기관명 치환 | 이번 최소 수정에서 제외한다. 명시된 실명과 실제 검토 책임은 보존한다 | 실명 직원 글까지 기관 공동 명의로 전환하려면 별도 공개 명의 정책이 필요함 |
| 검토 요청한 장학금 원고 | 운영 CMS의 실제 현재 초안을 확보하기 전에는 내용 검토·공개 완료로 표시하지 않는다 | CMS 인증 세션이 없어 대상 원고·사진·출처·조건을 조회하지 못함 |

코드 기준선은 원격 `main`의 `bd5aad3`이다. 기존 편집기·표·사진 크기 변경을 먼저 반영한 뒤 공개 작성자 출력만 수정했다. 기존의 미추적 콘텐츠 전략 문서는 작업·커밋 대상에서 제외했다.

## 실제 조사 근거

확인한 파일:

- `cms/server/pages.js`: 기존 목록·상세는 `authorName`을 그대로 표시하고 Article/BlogPosting 작성자는 항상 `Person`으로 출력했다.
- `cms/server/publication.js`, `cms/server/content.js`, `cms/server/api.js`: 작성 계정·검토자·공개 승인자와 공개 날짜가 원고 이력에 기록된다.
- `functions/sitemap.xml.js`: 약대 페이지와 공개 승인된 글 URL을 자동 생성한다. 초안·휴지통 글은 승인본 조인에서 제외된다.
- `functions/feed.xml.js`, `robots.txt`, `_headers`, `_routes.json`, `pharmacy/index.html`, `index.html`: RSS·크롤링 지시·헤더·라우팅·약대 canonical·초기 HTML의 블로그 링크를 확인했다.

| 실제 요청 URL | 2026-11-17 이 환경의 응답 | 해석 |
|---|---|---|
| `https://uksinchon.com/robots.txt` | HTTP 403, `error code: 1010` | 운영 robots 내용 미확인 |
| `https://uksinchon.com/sitemap.xml` | HTTP 403, 같은 오류 | 운영 XML·포함 글 미확인 |
| `https://uksinchon.com/blog/story-03da9a1a-b92c-4bd2-ac4e-638c2ac4beb2/` | HTTP 403, 같은 오류 | 대상 UCL 글의 공개 여부·본문·메타·색인 상태 미확인 |
| `https://uksinchon.com/pharmacy/` | HTTP 403, 같은 오류 | 운영 최종 HTML·헤더 미확인 |
| `https://search.google.com/search-console` | 공개 소개 페이지로 이동 | 이 환경에 인증된 속성 화면이 연결되지 않음. 사이트 미등록의 증거는 아님 |
| Google 공식 문서 [G1]·[G2]·[G3] | HTTP 200, 본문 확인 | 아래 판단 근거 |

일반 TLS 요청과 제공된 프록시 설정을 유지했다. 다른 UA·IP 위장이나 차단 우회는 하지 않았다. 이 환경의 403은 **Googlebot도 차단된다는 증거가 아니다**. Search Console과 Cloudflare의 검증된 요청 기록을 통해 구분해야 한다. 사이트의 robots 설정이 정상이라는 전달 내용만으로 CDN·실제 색인 상태까지 정상 판정하지 않았다.

## 구현한 최소 수정

공통 `publicAuthor(snapshot)`가 다음을 반환한다.

- 공백·빈 값과 `Admin`, `Administrator`, `Editor`, `관리자`, `운영자`, `작성자` 같은 일반 계정명은 **영국유학센터 신촌점** 공동 명의다. 대소문자·앞뒤 공백은 정규화한다.
- 공동 명의의 구조화 데이터는 `Organization`, `@id: https://uksinchon.com/#organization`, `url: https://uksinchon.com/`을 사용한다. 기관명을 `Person`으로 표시하지 않는다. Google은 Article 작성자로 Person과 Organization을 모두 지원한다 [G2].
- 명시된 실명은 기존 `Person` 이름·식별자를 유지한다. `Admin Smith`처럼 일반명과 우연히 일부가 겹치는 이름도 보존한다.
- 상세 본문의 작성자, 목록 카드, 비공개 미리보기, JSON-LD가 같은 판정을 사용한다.

이는 표시와 책임 주체를 명확히 하는 수정이다. 기관명 사용 자체가 검색 순위를 올린다는 주장은 하지 않는다. 개인 계정명을 신촌점 명칭으로 일괄 바꾸지 않으며, 실제 작성 계정·사실 확인자·승인자·버전·원고·사진·slug·최초 발행일·실질 수정일은 변경하지 않는다. 과거 원고를 다시 승인하거나 수정일을 현재 날짜로 바꾸는 데이터 작업도 필요하지 않다. 검토 기록의 `Admin`은 실제 실행 계정에 대한 기록이므로 작성자 표시와 구별해 보존한다.

비교한 대안은 계정명/과거 승인본 일괄 변경과 별도 공개 명의 편집 기능이다. 전자는 책임 기록을 흐릴 수 있고 데이터 복구 비용이 크다. 후자는 공개 명의 선택·권한·기존 원고 호환 규칙이 더 필요하다. 현재 확인된 일반 계정명 문제에는 출력 함수의 최소 수정이 적절하다. 전체 실명 치환이나 새 프로필/URL 체계를 이 작업에 포함하지 않는다.

## Search Console에서 실행할 순서

1. [Search Console](https://search.google.com/search-console)에 사이트 관리 Google 계정으로 접속한다. `uksinchon.com` 도메인 속성 또는 `https://uksinchon.com/`을 포함하는 기존 속성을 확인한다. 없으면 등록·소유권 확인을 한다. 소유자 또는 전체 사용자 권한이 있어야 개별 색인 요청을 할 수 있다 [G1].
2. **Sitemaps**에서 `https://uksinchon.com/sitemap.xml`을 제출한다. 처리 상태·마지막 읽기·발견 URL 수를 기록한다. 실제 XML에서 아래 두 URL의 포함 여부를 먼저 확인한다. 글이 빠져 있으면 CMS의 공개 승인본과 연결 상태를 확인하고, 비공개 원고를 사이트맵에 억지로 넣지 않는다.
3. **URL 검사**에 아래 주소를 각각 입력한다.

   - UCL 글: `https://uksinchon.com/blog/story-03da9a1a-b92c-4bd2-ac4e-638c2ac4beb2/`
   - 약대: `https://uksinchon.com/pharmacy/`

4. 색인된 버전의 상태·제외 사유·마지막 수집·사용자 canonical·Google 선택 canonical을 기록한다. 이어 **실제 URL 테스트**로 최종 HTTP 200, 수집 허용, 색인 허용, 렌더링된 본문을 확인한다. 실시간 테스트 성공만으로 색인 완료나 Google 선택 canonical을 판정하지 않는다.
5. 접근·색인 조건이 정상인 중요한 URL은 **색인 생성 요청**을 한 번 수행하고 접수 결과·한국시간을 기록한다. 이미 색인되었고 실질 변경이 없다면 반복 요청하지 않는다. 차단이면 Cloudflare에서 검증된 Googlebot과 InspectionTool 요청을 구분해 원인을 확인한다. 보안 전체 해제는 하지 않는다.
6. 며칠~몇 주 범위에서 상태 변화를 재확인한다 [G1]. 정확한 처리 날짜·검색 순위·AI 인용은 보장하지 않는다. 사이트 주소를 검색했을 때 일부 페이지만 보이는 현상만으로 나머지 페이지가 미색인이라고 결론 내리지 않는다.

향후 발행은 공개본 URL의 200·본문·canonical·내부 링크·사이트맵 포함을 기술 완료 기준으로 삼는다. 색인 여부, Google 선택 URL, 노출·클릭·상담은 운영 지표로 별도 기록한다. 사이트맵은 URL 발견을 돕는 힌트이며 수집·색인을 보장하지 않는다 [G3].

## 검증·배포·복구

- `node tests/check_public_authors.mjs`: 6개. 일반 계정/실명/기관 분류, 본문·JSON-LD 일치, 미리보기 비공개·이스케이프, 실제 격리 Worker+D1의 상세/목록/분류 목록, 원고·책임·날짜·사이트맵 불변을 확인했다.
- `node tests/check_editorial_model.mjs`: 6개. 기존 원고·출처·검토·수정 날짜 의미 회귀.
- `node tests/check_seo.mjs`: 11개. 25개 목록의 페이지 경계, canonical, 불변 공개본, 사진·표·관련 글·사이트맵·구형 원고 회귀.
- `python3 tests/check_seo_browser.py`: 6개. 실제 Chromium에서 직원 작성·사진/표·검토/공개·JS 없는 공개 HTML·320/375/390/768/1440px 화면·저장 실패 복구 회귀. 합계 29개를 통과했다.
- CMS와 블로그 Functions의 esbuild 번들 생성, `git diff --check`가 통과했다.
- 테스트의 계정·원고·자료·이미지는 모두 격리된 가상 데이터다. 운영 원고나 실제 학생 자료를 수정하지 않았다.

코드 변경은 **`5bdbd9b` (R04)**, 이 운영 안내는 별도의 **R04/R08 문서 커밋**으로 남긴다. Cloudflare Pages 체크 성공과 운영 최종 응답 확인을 구분하며, 인증된 Search Console 실행 결과 없이 제출/색인 완료로 표시하지 않는다. 복구는 공개 출력 변경 커밋 `5bdbd9b`를 되돌려 재배포한다. DB 마이그레이션·운영 데이터 변환이 없어 데이터 복원이나 리디렉션은 필요하지 않다.

## 공식 근거

모두 2026-11-17 본문을 확인했다.

- **[G1]** [Ask Google to recrawl your URLs](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl): URL 검사 권한·요청 한도·반복 요청의 비효과·수일~수주 소요·색인 비보장.
- **[G2]** [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article): Person/Organization 작성자 지원, 작성자 식별 URL, 사이트맵 활용과 검색 기능 노출 비보장.
- **[G3]** [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): 사이트맵 제출은 힌트이며 다운로드·수집 이용을 보장하지 않음.
