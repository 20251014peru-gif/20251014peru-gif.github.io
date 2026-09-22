# 클라우드 활성화

2026-09-22 my-system-25497 프로젝트의 asia-northeast3에 calendarApi와 calendarReminderSweep를 배포했습니다. Cloud Scheduler는 매분 실행하며 ENABLED 상태입니다. Firestore 기존 catch-all에서 dalnimSpaces와 dalnimReminderJobs만 제외했고, 본인 계정의 family 공간을 생성했습니다. 기존 운영 워크로그 데이터는 변경하지 않았습니다.

실제 API 주소: https://calendarapi-ng2m4osziq-du.a.run.app

HTTP 요청은 API의 Firebase ID 토큰·공간 권한 검사를 거칩니다. calendarApi는 웹앱 접속을 위해 Cloud Run invoker를 public으로 설정합니다. 데이터 자체를 공개하지 않습니다. 예약 함수에는 스케줄러 실행 권한만 사용합니다. 실패한 최초 함수 생성 뒤 업데이트로 복구하는 경우 IAM도 확인해야 합니다.

클라우드 빌드는 package.json의 engines.pnpm=10.17.1과 잠금 파일을 사용합니다. @google-cloud/functions-framework를 명시적으로 포함하고 필요한 의존성 빌드 스크립트만 허용합니다.

## 0. 배포 준비 도구

`tools/prepare-cloud.mjs`는 인증된 gcloud 터미널에서 실행합니다. 계정 UID를 인자로 받아 활성·이메일 검증 계정인지 확인합니다. 현재 규칙, 웹 앱 설정, 기존 공간을 읽고 기본 모드에서는 변경 제안 파일만 만듭니다.

    node tools/prepare-cloud.mjs --project my-system-25497 --owner-uid OWNER_UID

검토한 규칙의 catch-all에서 dalnimSpaces와 dalnimReminderJobs만 제외합니다. 기존 다른 컬렉션의 접근 조건은 유지합니다. 예상한 규칙 모양과 다르면 중단합니다. `.cloud-setup/firestore.before.rules`와 `firestore.after.rules`의 차이를 검토한 후 `--apply`로 적용합니다. 작업 중 다른 관리자가 규칙을 변경하면 다시 검토해야 합니다.

`--apply`는 캘린더 공간을 보호한 다음 새 family 공간을 만들고, Secret Manager에 VAPID 개인 키를 준비합니다. 기존 키는 회전하지 않습니다. `.env.PROJECT`와 `.cloud-setup/config.production.js`가 생성됩니다. 비밀·계정 정보 파일은 Git과 배포 ZIP에 포함하지 않습니다.

    node tools/prepare-cloud.mjs --project my-system-25497 --owner-uid OWNER_UID --apply
    firebase deploy --only functions:dalnim-calendar --project my-system-25497

배포 API 인증/권한 검증 후 생성된 공개 설정 파일을 src/config.js로 게시합니다. 실제 함수 URL도 배포 결과와 대조합니다. Google 로그인은 Firebase Authentication에서 제공자가 켜져 있어야 하며 앱 호스팅 도메인이 승인되어 있어야 합니다. 로컬 체험에는 운영 설정을 자동 적용하지 않습니다.

아래는 수동 설정 참고입니다.

## 1. 별도 테스트 공간

기존 프로젝트의 Firebase Authentication에서 이메일/비밀번호 로그인을 설정하고 본인·초대한 가족 계정을 생성합니다. 초기에는 본인 계정만 등록해 검증합니다.

Firestore 문서 dalnimSpaces/family:

    {
      "members": {
        "본인_인증_UID": "owner",
        "초대된_가족_UID": "editor"
      }
    }

viewer는 보기 전용입니다. 공개 가입과 스스로 가족 권한을 부여하는 경로는 없습니다. 공간 ID는 비밀이 아니며 UID 기반 권한 검사로 보호합니다.

## 2. 규칙과 비밀

기존 Firestore 규칙을 먼저 확인합니다. server/firestore.rules.fragment는 새로운 컬렉션에 대한 직접 접근 차단 조각입니다. 기존에 모든 경로를 허용하는 규칙이 있다면 이 조각만 추가해도 보호되지 않습니다. 기존 앱 권한을 검토한 뒤 병합해야 합니다.

pnpm install --frozen-lockfile 후 web-push 도구로 VAPID 키 쌍을 생성합니다. 개인 키는 저장소에 올리지 않고 Firebase Secret Manager의 DALNIM_VAPID_PRIVATE_KEY에 저장합니다. 공개 키만 클라이언트에 둡니다.

Firebase CLI 로그인 후 대상 프로젝트를 명시해 배포합니다. 운영 프로젝트 변경 전에 함수 이름, 비용, 접근 규칙을 검토합니다.

    firebase functions:secrets:set DALNIM_VAPID_PRIVATE_KEY --project my-system-25497

server/.env.example을 참고해 프로젝트 루트의 .env.my-system-25497을 작성합니다.
DALNIM_ALLOWED_ORIGINS에 실제 앱 출처만 쉼표로 구분해 넣습니다.
DALNIM_PUSH_SUBJECT는 운영자 mailto 주소입니다.

## 3. 함수만 배포

    pnpm install --frozen-lockfile
    pnpm test
    firebase deploy --only functions:dalnim-calendar --project my-system-25497

기존 함수를 지우는 전체 배포 대신 이 codebase만 배포합니다. API는 asia-northeast3 리전, 예약 함수는 매분 실행됩니다. 공개 API도 Firebase ID token과 공간 권한이 없으면 데이터를 반환하지 않습니다.

이 저장소의 firebase.json에는 기존 Hosting/Firestore 설정을 덮어쓰는 항목을 넣지 않았습니다.

## 4. 클라이언트 연결

src/config.js의 firebase에 공개 웹 앱 설정을 넣습니다. apiBase에 실제 배포 결과의 calendarApi URL, vapidPublicKey에 공개 VAPID 키, workspaceId에 family를 설정합니다. 서비스 계정 키와 VAPID 개인 키는 절대 넣지 않습니다.

웹 파일을 HTTPS로 호스팅합니다. 기존 GitHub Pages의 새 /dalnim-calendar/ 폴더로 배포할 수 있습니다. 처음에는 config.apiBase를 비워 체험 버전으로 검증할 수 있습니다.

앱 설정 → 클라우드 연결 → Google 계정 또는 이메일/비밀번호 로그인.
체험 일정은 자동으로 업로드되지 않습니다.
알림함 → 이 기기에 알림 연결.
아이폰은 지원되는 iOS에서 홈 화면 설치 후 권한을 허용합니다.

## 4.1. 0.3.0 재배포 필요

가족 초대 라우트(/invites, /invites/accept 등)와 미확인 알림 재발송 로직은 기존 calendarApi/calendarReminderSweep 함수 안에 추가되었습니다. 새 컬렉션·규칙 변경은 없지만(기존 dalnimSpaces catch-all 차단 규칙이 invites도 이미 포함), 함수 코드 자체가 바뀌었으므로 아래 배포 명령을 다시 실행해야 실제로 반영됩니다.

    pnpm install --frozen-lockfile
    pnpm test
    firebase deploy --only functions:dalnim-calendar --project my-system-25497

## 5. 실사용 전 필수 검증

- 두 기기에서 같은 일정의 생성·변경·삭제·복원.
- 동시에 수정하면 오래된 버전이 거부되는지 확인.
- 가족 계정으로 개인 일정이 조회되지 않는지 확인.
- 초대받지 않은 계정과 viewer의 수정 요청 거부.
- 알림 2~3분 뒤 일정 생성, PC 종료 상태에서 실제 휴대폰 수신.
- 일정 시간 변경/삭제/완료 후 이전 예약이 발송되지 않는지 확인.
- 매일/매주/월말/윤년 반복과 종일 일정의 한국 시간 오전 9시 기준 알림.
- 만료된 구독 정리, 네트워크 실패 재시도, 서버 로그 점검.
- PC 앱을 닫은 상태에서 예약 함수가 실행되는지 확인.
- 발송 서비스 접수와 사용자 수신·확인을 구분해 기록.
- (0.3) 알림을 열어보지 않고 10분, 20분 뒤 재발송이 실제로 오는지, 확인 후에는 재발송이 멈추는지.
- (0.3) 가족 초대: 실제 초대 이메일로 링크를 보내고, 그 계정으로 로그인해 여는지, 다른 계정으로 열면 거부되는지, 만료(7일) 후 거부되는지.
- (0.3) 저장 중 네트워크를 끊었다가 다시 연결해 오프라인 대기열이 자동으로 재전송되는지, 그 사이 다른 기기가 같은 일정을 수정했을 때 충돌로 안내되는지.
- (0.3) 반복 일정에서 "이 날짜만" 저장/삭제가 다른 날짜에 영향을 주지 않는지, 예약 알림도 그 날짜만 반영하는지.
- (0.4) 투자 기록보관실의 실제 기록·할 일이 캘린더에 "투자 노트"로 보이는지, 클릭했을 때 수정 폼이 아니라 보기 전용 화면이 뜨는지, 가족(editor/viewer) 계정에는 보이지 않는지.

예약 알림은 분 단위 처리이며 통신·OS 설정에 따라 지연될 수 있습니다. 0.2는 테스트 발송·서비스 접수·알림 링크 열기 확인을 구분합니다. 미확인 재알림과 문자 대체는 후속 구현입니다. 실제 휴대폰에서 수신 검증하기 전 ‘알림 완료’라고 표시하지 않습니다.

## 6. 기존 워크로그의 실시간 연결

현재 가져오기 어댑터는 복사만 수행합니다. 기존 워크로그의 저장/수정/삭제 함수와 공통 API를 연결하는 별도 어댑터를 추가해야 합니다. 기존 원본 ID를 유지하고, 누가 날짜를 소유하는지 정한 뒤 데이터 복사본으로 검증합니다. 이 작업 전에 기존 구글 연동을 끄거나 데이터를 이관하지 않습니다.




## 7. 확인한 공식 자료

- [Firebase Google 로그인](https://firebase.google.com/docs/auth/web/google-signin)
- [SDK CDN 구성](https://firebase.google.com/docs/web/alt-setup)
- [보안 규칙 Release 갱신](https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/patch)
- [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)
