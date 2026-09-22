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

Event: schemaVersion, id, title, start, end, allDay, timeZone, category, module, status, repeat, reminder, visibility, notes, location, details, exceptions, source, revision, deletedAt.

- 시간 일정: start/end는 UTC ISO 시각. timeZone은 IANA 시간대.
- 종일 일정: YYYY-MM-DD. end는 마지막 날 다음 날(배타적 종료).
- 반복: none/daily/weekly/monthly/yearly. 월말 없는 날짜는 건너뜁니다.
- 0.3부터 exceptions로 개별 발생을 다룹니다. 종료일 UI는 여전히 후속 범위입니다.
- 삭제: deletedAt으로 보관. 다른 프로그램에도 삭제 사실을 전달할 수 있습니다.
- source: 출처 프로그램과 안정된 원본 recordId. titles를 ID로 쓰지 않습니다.
- details: 블록 고유 자료. 블록 비활성화 때 삭제하지 않습니다.
- 외부 사실 일정(readOnly)은 향후 어댑터에서 원본과 사용자 검토 일정을 구분해야 합니다.

## 저장 계약

list(), save(event, expectedRevision), remove(event), import(events), subscribe(listener).

모든 프로그램이 공통 API를 사용하면 같은 ID의 동일 기록을 수정하게 됩니다. 서버는 expectedRevision으로 오래된 덮어쓰기를 거부하고 수정 이력을 기록합니다. 동시 동일 필드 수정은 사용자가 최신 내용을 다시 열도록 안내합니다. 자동 필드 병합은 아직 구현하지 않았습니다.

## 개별 발생(occurrence) 예외 — 0.3

exceptions는 반복 일정의 마스터 이벤트에 저장하는 맵입니다. 키는 그 발생의 원래 시작 시각(종일이면 YYYY-MM-DD, 아니면 UTC ISO)이며, `src/core/model.js`의 occurrenceAt이 계산하는 앵커와 같은 값입니다. 값은 { deletedAt } 또는 { title, notes, location, status, reminder } 중 저장된 필드만 포함하는 부분 재정의입니다. src/core/model.js의 sanitizeExceptions가 클라이언트·서버 양쪽에서 같은 화이트리스트로 검증합니다(최대 366개, 날짜 형식 불일치는 무시).

expandEvents(화면 표시)와 server/schedule.mjs의 nextReminder(예약 알림)가 각각 독립적으로 같은 앵커 키를 계산해 exceptions를 조회합니다. 두 계산이 다른 시간대에서 어긋날 수 있는 기존 제약(브라우저/서버 시간대 불일치, 아래 "배포 전 검증" 참고)은 exceptions 앵커에도 동일하게 적용됩니다.

현재 화면은 시간 이동 없이 제목·메모·장소·상태·알림만 발생 단위로 재정의합니다. 개별 발생의 시간 이동, 그리고 개별 삭제한 발생의 복원 화면은 후속 범위입니다.

## 오프라인 저장 대기열 — 0.3

src/core/offline-queue.js의 OfflineQueue는 클라우드 저장이 네트워크 오류(요청 자체가 서버에 닿지 못한 경우)로 실패했을 때 그 저장을 이 기기의 IndexedDB에 보관합니다. 서버가 응답했지만 거부한 경우(리비전 충돌, 권한 없음 등)는 대기열에 넣지 않고 그대로 오류로 전달합니다 — 진짜로 실패한 저장을 나중에 조용히 재적용하지 않기 위해서입니다.

src/cloud.js의 CloudStore.save는 대기열에 넣을 때도 "저장했습니다"라고 말하지 않습니다. queued 플래그가 있는 오류를 던지고, 화면은 이를 "오프라인 저장 대기" 상태로 구분해서 보여줍니다. 대기 중인 항목은 CloudStore.cache에도 pendingSync 표시와 함께 반영되어 화면에는 보이지만, 클라우드 기준본과 동기화되기 전임을 구분할 수 있습니다.

온라인 복귀는 15초 주기 폴링 성공 또는 브라우저 online 이벤트로 감지하며, flushQueue가 대기열을 순서대로 재전송합니다. 재전송 중 다시 오프라인이면 남은 항목은 그대로 두고 다음 기회를 기다립니다. 서버가 진짜로 거부하면 그 항목만 대기열에서 지우고 onConflict로 알립니다.

## 미확인 알림 재발송 — 0.3

server/index.mjs의 calendarReminderSweep은 최초 발송(sent) 후 열람 확인(openedAt)이 없으면 10분 뒤 같은 deliveryId로 재발송 작업을 예약합니다. 최대 2회까지 재발송하며(총 3회 발송), 각 재발송 시점에 이미 확인한 수신자는 제외합니다. deliveryId는 최초 발송과 모든 재발송이 공유하므로, 어느 발송을 열어도 같은 알림이 확인 처리됩니다. 일정이 수정·삭제·완료 처리되면 revision이 바뀌어 재발송 작업도 기존의 리비전 검사로 자동 취소됩니다. 다음 발생의 예약은 이 재발송 사슬이 끝난 뒤(확인됨/소진/미수신) 이어서 계산합니다.

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
- invites: 공간 아래 하위 컬렉션(0.3). owner만 POST /invites로 만들고 GET /invites로 조회·POST /invites/revoke로 취소합니다. 각 문서는 email/role/token/status(pending/accepted/revoked)/createdAt을 가지며, dalnimSpaces 전체가 클라이언트 직접 접근을 막는 기존 규칙에 이미 포함되어 별도 규칙 추가가 필요 없습니다.
- POST /invites/accept는 이 공간의 구성원이 아직 아닌 계정도 호출할 수 있는 유일한 경로입니다(그 외 모든 경로는 먼저 구성원인지 검사). 토큰이 가리키는 초대의 email이 호출자의 Firebase 인증 이메일과 정확히 같고, 아직 pending이며, 7일 이내일 때만 members 맵에 그 역할로 추가합니다.

예약 처리는 앱과 분리되어 클라우드에서 매분 실행됩니다. 저장 시 같은 트랜잭션에서 알림 작업을 기록합니다. 수정/삭제 후 이전 revision 작업은 취소됩니다. 실패는 지수 간격 재시도, 기기별 성공 체크포인트, 알림 tag로 중복을 줄입니다. 네트워크의 불확실성 때문에 exactly-once 전달을 보장하지 않습니다.

현재 발송 상태 sent는 푸시 서비스 접수입니다. 실제 화면 표시나 사용자 읽음이 아닙니다. 0.2에는 인증된 앱에서의 알림 링크 열기 확인을 추가했습니다. 미확인 재알림·대체 채널은 아직 구현하지 않았습니다.

## 배포 전 검증

API 권한과 예약 계산 단위 검사는 포함하지만 실제 Firebase 계정/함수·Firestore·휴대폰 푸시 통합 검사는 미실시입니다. DEPLOYMENT.md 순서로 테스트 공간에 배포하고 검증한 뒤 실사용을 전환합니다. 서버 기능을 올리기 전에 기존 보안 규칙에 광범위한 allow가 있는지 반드시 확인합니다.



## 0.2 공통 기록 연결

core/worklog-contract.js는 업무(work)·업무예정(schedule)의 양방향 필드 계약입니다. 이벤트와 원본 worklogRecord를 하나의 트랜잭션으로 저장합니다. src/core/store.js와 server/policy.mjs가 같은 계약을 사용합니다. 캘린더에서 수정할 때에는 저장된 원본에서 캘린더가 소유하는 필드만 투영하고 자재·첨부·추가 필드를 보존합니다. 출처 ID와 종류는 바꾸지 않습니다.

sdk/worklog-client.js의 save(record, expectedRevision)는 로컬 저장소 또는 CloudStore/CalendarClient와 함께 사용할 수 있습니다. REST /worklog는 기존 /events와 같은 문서·revision·권한 검사·이력·알림 트랜잭션을 사용합니다. 이 API는 운영 worklog_entries 컬렉션을 건드리지 않습니다.

connected.html은 위 SDK를 사용하는 독립 체험 화면입니다. 기존 워크로그 포팅 완료와 구분합니다. 직접 Firestore에 쓰는 기존 저장 창구를 전환하고 전 기기의 삭제 복구 동작을 함께 처리한 뒤에만 운영 연결을 활성화해야 합니다.

## 0.2 알림 관측

공간 아래 members/{uid}/notifications에 수신자별 발송 상태가 기록됩니다. 목록/열기 확인 API는 현재 일정의 접근 권한을 다시 검사합니다. accepted는 푸시 서비스 접수이며 휴대폰 표시가 아닙니다. openedAt은 알림 링크로 열린 앱이 로그인 후 확인 API를 호출한 시각입니다. 읽은 내용의 이해나 휴대폰 잠금 화면 표시를 보장하지 않습니다.

테스트 알림은 요청 ID로 중복 전송을 막고 계정별 30초 제한을 둡니다. 만료된 기기는 제거하며 수신 기기가 없으면 sent로 보고하지 않습니다. 실수신과 전체 Firebase 통합은 배포 후 검증 대상입니다.
