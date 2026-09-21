# 클라우드 활성화

현재 배포되지 않았습니다. 기존 Firebase 프로젝트는 저장소 문서상 my-system-25497(Blaze)이지만, 이 환경의 관리자 로그인과 현재 프로젝트 설정은 확인되지 않았습니다. 기존 데이터나 보안 규칙을 임의로 교체하지 않습니다.

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

앱 설정 → 클라우드 연결 → 이메일/비밀번호 로그인.
체험 일정은 자동으로 업로드되지 않습니다.
알림함 → 이 기기에 알림 연결.
아이폰은 지원되는 iOS에서 홈 화면 설치 후 권한을 허용합니다.

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

0.1 알림은 분 단위 처리이며 통신·OS 설정에 따라 지연될 수 있습니다. 읽음 확인이나 미확인 재알림은 후속 구현입니다. 실제 휴대폰에서 수신 검증하기 전 ‘알림 완료’라고 표시하지 않습니다.

## 6. 기존 워크로그의 실시간 연결

현재 가져오기 어댑터는 복사만 수행합니다. 기존 워크로그의 저장/수정/삭제 함수와 공통 API를 연결하는 별도 어댑터를 추가해야 합니다. 기존 원본 ID를 유지하고, 누가 날짜를 소유하는지 정한 뒤 데이터 복사본으로 검증합니다. 이 작업 전에 기존 구글 연동을 끄거나 데이터를 이관하지 않습니다.


