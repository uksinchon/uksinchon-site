# 신촌점 메인 화면 구현·운영 기록

확인일: **2026-11-18 한국시간**. 관련 로드맵: **R07(홈 확장), R04(초기 HTML), R06(검증·배포)**. 기준 코드: `d853e61`.

사용자가 선택한 **1안의 첫 화면 + 2안의 상담팀·사례 + 3안의 UK 노트**를 구현한다. 메인 문구는 **“영국 유학, 어학연수 내 조건에서 출발하세요.”**다. 이전의 진단 단계 이후 사용자가 구현과 배포를 승인한 작업이다.

## 화면과 연결

1. 첫 화면: 지정 문구, 기존 상담 예약·카카오톡 버튼, 대학 진학·석사·어학연수 선택 카드, 약대 바로가기.
2. 과정 안내: 대학·파운데이션·IYO, 석사·대학원, 어학연수·방학 프로그램. 기존 UK 노트 카테고리로 연결한다.
3. 상담팀: 실제 신촌점 사진과 이정민 지사장·이경민 실장·이경호 과장의 공개 소개.
4. 사례: 본사에 실제 공개된 신촌점 후기 3개로 연결한다. 새 후기나 합격 실적을 만들어 넣지 않는다.
5. 신촌 UK 노트: 현재 공개된 글 중 최초 발행일 내림차순 최근 3개. 전체 목록·주제별 목록 링크를 제공한다.
6. 상담·위치: 기존 `/counsel/`, 카카오톡, 전화, 지도. 모바일에는 하단 상담 버튼을 고정한다.

PC 1280×720·1366×768·1440×900에서 문구와 주 상담 버튼이 첫 화면에 들어간다. 모바일은 세로 배치와 접히는 메뉴를 사용한다. 키보드 포커스·본문 건너뛰기·메뉴 Escape 닫기를 제공한다. 파고다 설명회는 홈에 노출하지 않는다.

공개 브랜드는 **영국유학센터 신촌점**, 블로그 브랜드는 **신촌 UK 노트**다. 직원의 직접 발행 방식, 사진 출처의 선택 입력, 검토 질문 제거는 기존 동작을 유지한다. 상담 접수 폼을 새로 만들거나 실제 접수를 테스트하지 않는다.

## 확인한 공식 자료와 사용 범위

2026-11-18 정상 TLS 검증을 유지한 HTTP 요청으로 본사 소개·후기 본문·사진을 확인했다. 상태 코드뿐 아니라 실제 제목·본문을 대조했다. 존재하지 않는 후기 경로가 목록으로 응답하는 경우는 제외했다.

| 자료 | 확인한 사실·적용 |
|---|---|
| [본사 신촌점 소개](https://www.ukcentre.co.kr/intro/#sinchon) | 세 담당자의 이름·직책·담당 분야, 사무실·프로필 사진, 주소·전화·지도. 경력 연수·실적 수치·운영 시간은 추가하지 않음 |
| [러프버러 파운데이션 후기](https://www.ukcentre.co.kr/review/신촌지사-세계-1위-스포츠-대학교-러프버러대학교-스포츠-경영-파운데이션-수속후기) | 스포츠 경영 파운데이션 수속 사례. 홈 카드에는 순위 주장을 복제하지 않음 |
| [골드스미스 석사 후기](https://www.ukcentre.co.kr/review/신촌지사-영국-석사-합격-후기12년-차-직장인-다시-채우는-1년-골드스미스-런던대학교-미디어석사) | 12년 차 직장인의 휴직·지원 서류·출국 준비. 졸업이나 취업 성과로 확대하지 않음 |
| [ELC 이스트본 후기](https://www.ukcentre.co.kr/review/신촌지사-영국어학연수-후기ㅣelc-이스트본-6개월-연수중인-학생의-60일차-솔직한-이야기) | 6개월 연수 중 60일 차의 경험. 현재 모든 학생에게 적용되는 조건으로 표현하지 않음 |

본사 후기의 본문·학생 사진을 사이트 글로 재게시하지 않고 원문으로 연결한다. 역사적인 원문 URL의 ‘신촌지사’는 주소 보존을 위해 그대로 사용한다.

본사에 공개된 지점 자체 소개용 사진 4개를 원본 그대로 로컬에 보관해 외부 이미지 서버 의존을 줄였다. 모든 사진에 크기·대체 설명·지연 로딩을 적용했다. 출처 공개를 제3자의 포괄적인 재사용 허가로 해석하지 않는다.

| 로컬 파일 (`assets/home/`) | 본사 원본 경로 | 크기 |
|---|---|---:|
| `office.jpg` | `/files/asset/image/sinchon-promise-1785058162.jpg` | 900×506, 41,305 B |
| `team-jeongmin.jpg` | `/files/doc/ukeducentre_intro/photo2.jpg` | 227×275, 62,581 B |
| `team-kyungmin.png` | `/files/doc/ukeducentre_intro/km.png` | 620×608, 456,763 B |
| `team-kyungho.png` | `/files/asset/image/sinchon-profile-lee-gyeongho-1785058162.png` | 174×174, 51,940 B |

## 구조 결정과 공개본 계약

`index.html`은 소개·상담·주제 링크를 가진 실제 정적 홈페이지다. `assets/home.css`와 `assets/home.js`를 사용하고 새 UI 프레임워크·외부 글꼴은 도입하지 않는다. 제목·설명·canonical·OG·RSS·실제 사업장과 일치하는 Organization/ProfessionalService·WebSite·WebPage JSON-LD를 제공한다. 후기 평점·FAQPage·확인하지 않은 날짜는 생성하지 않는다.

최소안은 정적 카테고리 링크만 제공하는 방식이다. 최신 글을 자동 노출하려면 발행마다 정적 홈을 재배포하거나 요청 시 공개본을 읽어야 한다. **기존 D1과 Pages Functions를 재사용해 최신 글 영역만 서버에서 채우는 방식**을 선택했다. 직원 발행에 별도 빌드 절차를 추가하지 않고 JS 없는 초기 HTML에도 실제 글 링크가 나온다. 전체 사이트의 SSR 프레임워크 전환은 필요하지 않다.

- `functions/index.js` → `cms/server/home.js`. Pages의 `context.next`로 정적 템플릿을 얻고 두 HTML 주석 사이만 교체한다. 추가 ASSETS 설정이나 Secret은 필요하지 않다.
- `cms_posts.published_revision`과 일치하는 `cms_versions.snapshot`만 조회한다. 수정 중인 초안의 제목·요약·작성자는 노출하지 않는다. DB에 쓰지 않는다.
- 최초 발행일·안정적인 기존 slug를 사용한다. 제목 수정으로 URL이나 발행 순서를 바꾸지 않는다. 작성자 표시는 공개 블로그와 같은 규칙을 사용한다.
- 공개 글이 없거나 DB가 연결되지 않거나 읽기에 실패하면 정적 주제 안내를 유지한다. 이를 가짜 최신 글·예시 게시글로 채우지 않는다. 1~2개만 공개되어 있으면 실제 개수만 표시한다.
- 생성 HTML은 `public, max-age=0, must-revalidate`. 정적 파일에서 받은 ETag·Last-Modified·길이·인코딩을 제거해 재발행·비공개 전환 뒤 이전 HTML을 304로 재사용하지 않게 한다. GET/HEAD만 지원한다.
- `_routes.json`에 `/`와 `/index.html`을 추가한다. `/index.html`은 쿼리를 보존해 `/`로 308 이동한다. 다른 게시글·약대·상담 URL은 바꾸지 않는다.
- 기존 Meta PageView 정책을 유지하며 공개된 홈 앵커를 허용 목록에 추가한다. 새 상담 이벤트나 개인정보 전송은 추가하지 않는다.

기존 글 ID·slug·스냅샷·이미지 모델·DB 스키마를 변경하지 않아 데이터 변환이나 백업 복원 작업이 필요하지 않다. 홈페이지 요청당 공개본 조회가 한 번 추가되는 비용은 있다. 실제 방문량·D1 사용량과 CDN 추가 캐시 규칙은 인증 권한이 없어 미확인이다.

## 완료 기준과 검증 결과

2026-11-18 다음 **39개 검증 그룹 통과**. 가상 로컬 계정·D1·원고만 사용했다. 실제 글 발행·상담 접수·Meta 이벤트 전송은 하지 않았다.

| 검증 | 통과 | 확인 범위 |
|---|---:|---|
| `node tests/check_home.mjs` | 7 | 초기 HTML, 최신 3개, 초안 비노출, XSS·문자 이스케이프, 재발행·삭제·비공개, DB 장애 대체 표시, HEAD·캐시·링크 |
| `python3 tests/check_home_browser.py` | 5 | PC 첫 화면, 320/360/390/430/768/1024px, 키보드 메뉴, 실제 사진·후기 링크, JS 없는 글 자동 반영, 기존 상담 화면 이동 |
| `python3 tests/check_home_pages.py` | 4 | Wrangler가 실제 생성한 Pages 라우터·`context.next`·정적 파일·D1 발행/재발행/비공개·dot route·관리자 검색 제외 헤더 |
| `node tests/check_seo.mjs` | 11 | 기존 발행 이력·메타·목록 페이지네이션·이미지·표·고정 주소 회귀 |
| `python3 scripts/check_meta_pixel.py` | 12 | 모의 Meta 라이브러리, 한 번의 PageView, URL 허용 목록, 기존 상담 기능·차단 시 동작 |

Wrangler 4.40.0 Pages Functions 빌드, JS 구문, `git diff --check`, 허용된 공개 파일만 담는 개발 폴더·ZIP 생성도 확인했다. 새 홈 CSS·JS·사진은 공개 파일 목록에 포함된다. ZIP만으로 CMS가 배포된다고 안내하지 않는다. `price_manager/` 및 기존 미추적 콘텐츠 전략 문서는 작업·배포 대상에 추가하지 않는다.

개발 성능 관찰은 실제 생성한 Pages 라우터·로컬 서버에서 새 Chromium 컨텍스트로 PC 1366×768·모바일 390×844 각각 3회 수행했다. CPU·네트워크 제한 없이 Meta를 끈 조건에서 LCP 중앙값은 각각 208ms·240ms, 최초 화면 CLS는 모두 0이었다. 로컬 기준선이며 배포 서버·실제 휴대전화의 성능이나 필드 Core Web Vitals 합격을 뜻하지 않는다. 배포 후 실제 사용자 측정은 별도로 확인한다.

재현용 도구는 저장소 밖 `/tmp/uksinchon-cms-tools`(Miniflare·esbuild), `/tmp/uksinchon-pages-tools`(Wrangler 4.40.0), Python Playwright와 `/usr/bin/chromium`이다. 화면 검증은 `CMS_HOME_UI_FIXTURE=1 node tests/check_home.mjs`를 8802 포트에 유지한 상태에서 실행한다.

실제 Pages 라우터 검증은 **새 빈 로컬 상태 경로**로 아래 명령을 실행한 뒤 별도 터미널에서 `python3 tests/check_home_pages.py`를 실행한다. 이 토큰·계정은 테스트 전용 가짜 값이며 운영에 설정하지 않는다.

```bash
python3 scripts/prepare_cms_dev.py
WRANGLER_REGISTRY_PATH=/tmp/uksinchon-pages-registry \
WRANGLER_LOG_PATH=/tmp/uksinchon-pages-dev.log WRANGLER_SEND_METRICS=false \
/tmp/uksinchon-pages-tools/node_modules/.bin/wrangler pages dev .wrangler/dev-public \
  --ip 127.0.0.1 --port 8804 --compatibility-date 2025-11-01 \
  --persist-to /tmp/uksinchon-pages-home-state \
  --d1 CMS_DB=fictional-home-pages --binding CMS_LOCAL_DEV=true \
  --binding CMS_SETUP_TOKEN=fictional-home-pages-setup-key-20261118
```

## 배포·운영 확인과 복구

화면·사진·기존 PageView 통합(R07)과 공개 노트 서버 연결·회귀 검증(R04/R06/R07)을 논리적 커밋으로 나눴다.

| 구현 커밋 | 검증·복구 단위 |
|---|---|
| [`c225cdd`](https://github.com/uksinchon/uksinchon-site/commit/c225cdd) · R07 | 정적 화면·실제 사진·후기·상담 연결·공개 파일 패키징·Meta 12개·PC/모바일 화면 검증. 되돌리면 기존 메인으로 복구 |
| [`78539d8`](https://github.com/uksinchon/uksinchon-site/commit/78539d8) · R04/R06/R07 | 공개 노트 SSR·루트 라우트·홈 API 7개·화면 5개·Pages 4개·SEO 11개. 되돌리면 정적 주제 안내 유지 |

배포 성공은 [main 커밋 이력](https://github.com/uksinchon/uksinchon-site/commits/main/)의 최종 커밋에 연결된 **Cloudflare Pages / Deploy successful** 체크로 확인한다. 코드 푸시만 완료된 상태와 구분한다.

운영 URL `https://uksinchon.com/`의 이 실행 환경 직접 요청은 기존과 같이 403/1010이다. 이를 Googlebot 차단으로 단정하지 않는다. 운영 CMS 세션·WAF·Search Console·필드 Core Web Vitals는 접근 권한이 없어 미확인이다. 배포 성공과 운영 DB의 실제 글 수·검색 색인·AI 인용·상담 전환을 구분한다. 후자는 운영 지표이며 개발 완료 기준으로 보장하지 않는다.

복구는 해당 커밋을 되돌려 재배포한다. 노트 서버 연결만 되돌리면 정적 홈의 주제 안내는 남는다. 전체 홈을 되돌려도 글·이미지·발행 이력에 DB 복구는 필요 없다. 주소 변경은 `/index.html`→`/` 정규화 한 가지이며 기존 게시글 리디렉션이나 데이터 일괄 변환은 없다. 팀 구성 변경 시 사진·직책·담당 분야를 함께 갱신하고, 후기 원문이 삭제되면 해당 카드를 교체한다.
