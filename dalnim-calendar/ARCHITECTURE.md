# 달님 캘린더 — 블록 계약 v1

이 캘린더는 기존 워크로그의 별도 확장 앱입니다. 기존 worklog.html/worklog.js와 실데이터는 수정하지 않았습니다.

## 경계

- core/model.js: 일정 계약·검증·반복 발생 계산.
- core/store.js: 이 기기 체험 저장소. IndexedDB 트랜잭션에서 버전을 비교하므로 다른 탭의 오래된 수정은 거부합니다.
- cloud.js: 같은 저장소 인터페이스를 구현하는 서버 연결. 앱은 저장소의 구체적 구현에 의존하지 않습니다.
- core/registry.js: 선택 블록을 동적으로 로드합니다. 파일이 사라지거나 로드 실패해도 다른 블록을 로드합니다.
- modules/: 워크로그·투자·가족의 개별 상세 필드. 블록끼리 import하지 않습니다.
- adapters/: 기존 프로그램 데이터를 공통 계약으로 변환합니다.
- server/: 인증·초대된 공간·버전 검사·기록 저장과 독립된 예약 알림 처리.
- vendor/: FullCalendar Standard 6.1.19, MIT. 캘린더 시간표·드래그·보기 기능을 검증된 라이브러리로 재사용합니다.

블록을 끄는 것은 기능을 비활성화하는 것입니다. 일정 삭제·원본 삭제와 다릅니다. 블록이 없어도 공통 제목·시간·메모를 열고 편집할 수 있으며 details는 그대로 보존합니다. 한 블록의 오류가 다른 블록으로 전파되지 않도록 로드 경계를 격리했습니다. 공통 저장소·인증·브라우저 자체 장애까지 없애는 구조는 아닙니다. 그런 장애는 명시적으로 표시하고 백업으로 복구합니다.

## 데이터 계약

Event: schemaVersion, id, title, start, end, allDay, timeZone, category, module, status, repeat, reminder, visibility, notes, location, details, source, revision, deletedAt.

- 시간 일정: start/end는 UTC ISO 시각. timeZone은 IANA 시간대.
- 종일 일정: YYYY-MM-DD. end는 마지막 날 다음 날(배타적 종료).
- 반복: none/daily/weekly/monthly/yearly. 월말 없는 날짜는 건너뜁니다.
- 0.1에서는 반복 수정·삭제가 전체에 적용됩니다. 개별 발생 예외·종료일 UI는 후속 범위입니다.
- 삭제: deletedAt으로 보관. 다른 프로그램에도 삭제 사실을 전달할 수 있습니다.
- source: 출처 프로그램과 안정된 원본 recordId. titles를 ID로 쓰지 않습니다.
- details: 블록 고유 자료. 블록 비활성화 때 삭제하지 않습니다.
- 외부 사실 일정(readOnly)은 향후 어댑터에서 원본과 사용자 검토 일정을 구분해야 합니다.

## 저장 계약

list(), save(event, expectedRevision), remove(event), import(events), subscribe(listener).

모든 프로그램이 공통 API를 사용하면 같은 ID의 동일 기록을 수정하게 됩니다. 서버는 expectedRevision으로 오래된 덮어쓰기를 거부하고 수정 이력을 기록합니다. 동시 동일 필드 수정은 사용자가 최신 내용을 다시 열도록 안내합니다. 자동 필드 병합은 아직 구현하지 않았습니다.

## 연결 수준을 혼동하지 않기

현재 worklog 어댑터는 JSON 가져오기만 지원합니다. 기존 워크로그로 다시 쓰거나 원본 변경을 실시간 구독하지 않습니다. 양방향 연동을 완성하려면 기존 프로그램의 저장 경로에서 공통 API를 호출하도록 어댑터를 추가하고, 삭제·동시 수정·원본 변경을 실제 데이터 복사본에서 검증해야 합니다.

iframe src="./dalnim-calendar/?embed=1"로 화면 삽입이 가능합니다. 공통 API를 사용하는 새 프로그램은 독립된 계정 세션에서 같은 공간에 접근합니다. iframe만 넣는 것으로 양방향 데이터 연동이 완성되지는 않습니다.

## 서버

새 이름공간 dalnimSpaces/{spaceId}만 사용합니다. 기존 워크로그 컬렉션을 읽거나 수정하지 않습니다.

- events: 공통 일정 및 history 하위 컬렉션.
- members: 계정별 푸시 구독.
- my_system_search: 동일 접근 범위를 갖는 검색 인덱스. 기존 공개 검색 인덱스에 개인 내용을 복제하지 않습니다.
- dalnimReminderJobs: 예약 작업, 수정 버전, 발생 시각, 재시도·발송 처리 기록.
- 공간 문서의 members 맵에 초대된 UID와 owner/editor/viewer 역할을 저장합니다.
- 개인 일정은 소유자만 읽고 씁니다. 가족 공유 일정은 초대된 계정이 볼 수 있고 owner/editor가 수정할 수 있습니다.
- 서버가 인증·권한·원본 버전을 검사합니다. 클라이언트 직접 Firestore 접근은 차단합니다.

예약 처리는 앱과 분리되어 클라우드에서 매분 실행됩니다. 저장 시 같은 트랜잭션에서 알림 작업을 기록합니다. 수정/삭제 후 이전 revision 작업은 취소됩니다. 실패는 지수 간격 재시도, 기기별 성공 체크포인트, 알림 tag로 중복을 줄입니다. 네트워크의 불확실성 때문에 exactly-once 전달을 보장하지 않습니다.

현재 발송 상태 sent는 푸시 서비스 접수입니다. 실제 화면 표시나 사용자 읽음이 아닙니다. 확인 회신·미확인 재알림·대체 채널은 아직 구현하지 않았습니다.

## 배포 전 검증

API 권한과 예약 계산 단위 검사는 포함하지만 실제 Firebase 계정/함수·Firestore·휴대폰 푸시 통합 검사는 미실시입니다. DEPLOYMENT.md 순서로 테스트 공간에 배포하고 검증한 뒤 실사용을 전환합니다. 서버 기능을 올리기 전에 기존 보안 규칙에 광범위한 allow가 있는지 반드시 확인합니다.

