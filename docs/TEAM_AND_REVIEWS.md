# 상담팀 페이지와 신촌점 후기 게시판

확인일: 2026-11-19 (한국시간)

## 상담팀 페이지 `/team/`
- 본사 홈페이지 신촌지사 소개(https://www.ukcentre.co.kr/intro/#sinchon)의 내용(약속, 강점 4가지, 상담사 3명 경력, 수속 가능 분야 6개, 오시는 길)을 신촌점 사이트 안으로 옮긴 정적 페이지. 본사로 넘어가지 않는다.
- 파일: `team/index.html`, `assets/team.css`. 배너·지도 이미지 출처는 `assets/home/photo-sources.json`.
- 내용을 바꾸려면 `team/index.html`을 직접 고친다.

## 신촌점 후기 게시판 `/reviews/`
- 직원 글쓰기 화면에서 카테고리를 **신촌점 후기**로 고르고 공개하면 `/reviews/` 목록에 올라간다. 신촌 UK 노트(`/blog/`) 목록·카테고리·홈의 노트 카드에는 나오지 않는다.
- 글 주소는 다른 노트와 같은 `/blog/story-…/` 형식이며, 상단 위치 표시가 "신촌점 후기"로 연결된다. `/blog/?category=reviews`는 `/reviews/`로 이동한다.
- 홈의 "신촌점과 함께한 이야기"에는 최신 후기 3개가 서버에서 들어간다. 공개 후기가 없으면 본사 후기 링크 3개를 유지한다.
- 코드: `cms/server/content.js`(REVIEW_*), `cms/server/pages.js`(publicReviews), `functions/reviews/[[path]].js`, `cms/server/home.js`.
- 검증: `node tests/check_reviews.mjs` (6).
