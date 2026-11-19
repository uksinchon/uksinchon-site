# 메인 화면 2차 디자인 (Claude 시안 기반)

확인일: **2026-11-19 한국시간**. 미리보기 브랜치 `draft/main-redesign`에서 검토한 뒤 main에 반영한다.

## 바뀐 점

- 사용자가 Claude 시안(남색·코랄, 시즌 카드, 진단, UK 노트, 과정, 숫자, 상담 순서)을 선택했다. 기존 홈의 메인 문구, 진단 우선 버튼(`#diagnosis`), 상담팀·후기·지도, 모바일 메뉴·하단 상담바, 서버 렌더링 UK 노트는 유지한다.
- 실사 사진: 본사 홈페이지(www.ukcentre.co.kr) 메인 이미지 7장을 WebP로 줄여 `assets/home/`에 보관했다. 원본 경로·크기는 `assets/home/photo-sources.json`.
- **신촌 UK 노트 카드 사진**: `cms/server/home.js`가 공개본의 대표 사진(`heroImageId`), 없으면 본문 첫 사진을 쓴다. `cms_public_media`에 있는 공개 사진만, 장식용 사진은 제외한다. 사진이 없으면 남색 `SINCHON UK NOTE` 표시를 쓴다.
- 클립 영역(`#clips`)은 운영 방식이 정해질 때까지 숨겨 둔다.
- Pretendard 글꼴(jsDelivr)을 사용한다. 차단돼도 시스템 글꼴로 표시된다.

## 검증

`node tests/check_home.mjs`(7), `node tests/check_home_images.mjs`(3, 새로 추가), `python3 tests/check_home_browser.py`(8), `node tests/check_seo.mjs`(11) 통과. 가상 로컬 D1·계정만 사용했다.

## 1분 영상 (유튜브 쇼츠 자동 표시)

- 채널: 영국 유학 읽어주는 남자 (`UCImGPdQRYjZlV_3tzNAgeXg`). 유튜브 공개 RSS에서 링크가 `/shorts/`인 영상만 골라 최신 4개를 홈에 서버 렌더링한다. API 키 불필요, Cloudflare가 RSS를 30분 캐시한다.
- 관리자: `/admin/clips.html`(글쓰기 관리 상단 **메인 1분 영상**)에서 영상별 **숨기기/다시 보이기**. 테이블 `cms_clip_hidden`은 처음 사용할 때 자동 생성한다.
- 방문자가 누를 때만 youtube-nocookie 플레이어를 불러온다. JavaScript가 없으면 유튜브로 이동한다. 썸네일은 `i.ytimg.com`에서 불러온다.
- 유튜브 응답이 실패하거나 쇼츠가 없으면 영역을 숨긴 채 홈을 정상 표시한다. 테스트 환경은 `HOME_CLIPS=off`로 외부 요청을 하지 않는다.
- 검증: `node tests/check_clips.mjs`(5). `CLIPS_LIVE=1`이면 실제 채널 RSS도 확인한다.

## 배포와 되돌리기

배포 직전 운영 main을 `backup/pre-home-v2-20261119` 브랜치·태그로 보관했다. 문제 시 그 커밋으로 되돌린다.
