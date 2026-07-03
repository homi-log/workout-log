# 운동일지 (Workout Log)

휴대폰 브라우저에서 바로 기록하는 단일 파일(single-file) 운동일지 웹앱.

## 구조

- **index.html** — 앱 전체 (HTML + CSS + JS 한 파일). 별도 빌드 도구 없음.
- **운동일지_데이터.json** — 초기/백업 데이터. 앱의 `JSON 불러오기`로 주입 가능.

## 데이터 저장

- 데이터는 브라우저의 **localStorage** (`workout_db` 키)에 저장됩니다.
- 기기·브라우저별로 데이터가 유지됩니다. 다른 기기로 옮기려면 앱 안에서 `JSON` 내보내기 → 새 기기에서 `불러오기`.

## 로컬에서 실행

`index.html`을 브라우저로 열기만 하면 됩니다.

## 배포 (GitHub Pages)

**라이브 주소:** https://homi-log.github.io/workout-log/

저장소: https://github.com/homi-log/workout-log (main 브랜치 / 루트)

코드 수정 → commit → push 하면 1~2분 내 자동으로 재배포됩니다.
