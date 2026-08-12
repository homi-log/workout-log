# 운동일지 (Workout Log)

휴대폰 브라우저에서 바로 기록하는 단일 파일(single-file) 운동일지 웹앱.

## 구조

- **index.html** — 앱 전체 (HTML + CSS + JS 한 파일). 별도 빌드 도구 없음.
- **운동일지_데이터.json** — 초기/백업 데이터. 앱의 `JSON 불러오기`로 주입 가능.

## 데이터 저장

- 기본은 브라우저의 **localStorage** (`workout_db` 키)에 저장됩니다. 기기·브라우저별로 유지됩니다.
- **여러 기기 자동 동기화(선택):** 헤더의 **☁ 버튼**에 Google Apps Script 웹앱 URL을 등록하면
  본인 Google 시트에 저장되어 폰·PC가 같은 데이터를 공유합니다.
  설정 방법은 [google-sheets-sync/설정방법.md](google-sheets-sync/설정방법.md) 참고.
- 수동 백업/이전은 앱 안에서 `JSON` 내보내기 → 새 기기에서 `불러오기`.

## 운동 동영상

각 운동 입력 칸에서 **유튜브 링크** 또는 **파일 업로드**로 동영상을 붙일 수 있습니다.

- **유튜브 링크**는 URL만 저장되므로 클라우드 동기화·JSON 내보내기에 그대로 포함되어 모든 기기에서 재생됩니다.
- **업로드한 파일**은 용량이 커서 localStorage나 Google 시트에 들어갈 수 없어, 브라우저의 **IndexedDB에 이 기기에만** 저장됩니다.
  다른 기기로 동기화해도 참조(파일명)만 넘어가고 실제 영상은 옮겨지지 않습니다 — 여러 기기에서 보려면 유튜브 링크를 권장합니다.

## 로컬에서 실행

`index.html`을 브라우저로 열기만 하면 됩니다.

## 배포 (GitHub Pages)

**라이브 주소:** https://homi-log.github.io/workout-log/

저장소: https://github.com/homi-log/workout-log (main 브랜치 / 루트)

코드 수정 → commit → push 하면 1~2분 내 자동으로 재배포됩니다.
