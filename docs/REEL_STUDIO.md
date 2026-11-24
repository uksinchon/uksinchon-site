# 쇼릴 제작실 (1단계)

기준일: 2026-11-24 (한국시간). 관리자 화면 `/admin/reels.html`, 직원 안내 `/admin/reels-help.html`.

## 흐름

네이버 새 글 → **AI 45초 기획안**(장면·화면 문구·내레이션·채널별 문구) → 담당자 검토(문구·원고·사진·음악·내레이션 mp3) → **GitHub Actions 렌더**(`uksinchon/uksinchon-shorts`의 `reel-render`) → 영상 확인 → **승인** → 예약 대기열(`uksinchon-shorts/queue/approved/<id>.json`) → Claude 정기 작업이 Metricool로 4개 채널 예약 → `queue/done/<id>.json` → GitHub Actions(`reel-queue`)가 결과를 이 사이트에 기록.

Metricool 요금제(Starter)는 REST API를 쓸 수 없어 예약은 Claude의 Metricool 연결(MCP)로 한다. Claude 작업 환경은 uksinchon.com에 직접 접속하지 못하므로 대기열은 GitHub 저장소를 거친다.

## 상태

`new`(새 글) → `planning` → `editing`(검토) → `rendering` → `review`(영상 확인) → `approved`(예약 대기) → `scheduled` → `published`. 오류는 `failed`, 제외는 `skipped`. 렌더·승인 이후에는 편집이 잠기고, 관리자만 `reopen`으로 되돌린다.

## 연결 설정 (운영자가 한 번)

### Cloudflare Pages 프로젝트 `uksinchon` → Settings → Variables and Secrets (Production)

| 이름 | 종류 | 값 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secret | Anthropic API 키 (없으면 기존 `OPENAI_API_KEY`+`CMS_REWRITE_MODEL`로 기획안 생성) |
| `REEL_PLAN_MODEL` | 일반(선택) | 기획안 모델 ID. 비우면 `claude-sonnet-5-5` (OpenAI 사용 시 `CMS_REWRITE_MODEL`) |
| `REEL_GITHUB_TOKEN` | Secret | GitHub fine-grained 토큰: `uksinchon-shorts` 저장소 **Contents: Read and write, Actions: Read and write** |
| `REEL_AGENT_TOKEN` | Secret | 32자 이상 임의 문자열 (렌더 서버·대기열 보고 인증) |
| `REEL_GITHUB_REPO` | 일반(선택) | 기본 `uksinchon/uksinchon-shorts` |

### GitHub `uksinchon/uksinchon-shorts` → Settings → Secrets and variables → Actions

| 이름 | 값 |
|---|---|
| `REEL_AGENT_TOKEN` | 위와 같은 값 |
| `MEDIA_PUSH_TOKEN` | fine-grained 토큰: `uksinchon-media` 저장소 **Contents: Read and write** |

## 저장 위치

- D1: `cms_reels`(기획안·문구·상태·렌더/예약 결과), `cms_reel_music`(검증 곡 목록), `cms_reel_events`(작업 기록). 첫 사용 시 자동 생성.
- 음악 파일: 비공개 `uksinchon-shorts/music/library/` (Pixabay 곡 단독 재배포 금지 조건 때문에 공개 저장소에 두지 않음)
- 내레이션: `uksinchon-shorts/reels/<id>/narration.mp3`
- 완성 영상·썸네일: 공개 `uksinchon-media/YYYY/MM/` (Metricool이 받을 공개 주소)

## 보안

- 직원 API는 기존 CMS 세션·Origin 검사를 그대로 쓴다. mp3 업로드 두 경로만 JSON 형식 검사에서 제외한다.
- `/api/cms/reels/agent/*`는 브라우저 세션 대신 `REEL_AGENT_TOKEN`(Bearer)으로만 열린다.
- 렌더 워크플로는 `site` 입력을 `https://uksinchon.com` 또는 `*.uksinchon.pages.dev`로 제한해 키가 다른 주소로 가지 않게 한다.
- 관리자 CSP에 `raw.githubusercontent.com`(영상·썸네일 미리보기)만 추가했다.

## 검증

`node tests/check_reels.mjs` — 가상 D1·가상 네이버/AI/GitHub로 11개 항목(기획안 정리, 서명 2줄, 중복 방지, AI 기획, 사진 프록시, 방패 확인 없는 곡 거부, 버전 충돌, 렌더 요청·잠금, 렌더 키 인증, 승인 대기열 내용, 예약·게시 결과 기록, 교차 사이트 차단). `CMS_REELS_UI=1`이면 8803 포트에 화면 확인용 서버를 띄운다. 운영 DB·실제 API는 쓰지 않는다.

## 2단계 예정

타입캐스트 API 내레이션 자동 생성(문장별 미리듣기·재생성), 장면 스틸 미리보기, 템플릿 추가.
