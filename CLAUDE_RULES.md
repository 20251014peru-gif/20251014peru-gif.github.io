# 달님 시스템 — Claude 작업 규칙 & 노하우

> 이 파일을 읽고 작업을 시작할 것. 새 대화 시작 시 항상 이 파일 먼저 읽기.
>
> **최우선 규칙: 모든 프로그램의 신규 개발·수정·확장 전에 반드시 `SYSTEM_PHILOSOPHY.md`를 먼저 읽는다.**
> 개별 앱의 편의나 기능만 최적화하지 말고, 그 앱이 전체 투자 인식·추론 시스템에서 어떤 '감각'을 담당하며 종합추론 머리에 어떤 신호를 전달하는지 먼저 검토한다.
> 각 앱은 다른 앱 없이도 독립적으로 작동해야 하며, 연결될 때 서로의 판단 품질을 높여야 한다. 임시 패치보다 전체 구조와 장기적인 추론 능력을 우선한다.

---

## 0. 전체 시스템 헌장 — 모든 작업보다 우선

- 절대 기준 원본: `SYSTEM_PHILOSOPHY.md`
- 핵심 문장: **프로그램은 감각이고, 종합추론은 6번째 감각이다. 부분을 만들되 항상 전체를 본다.**
- 뉴스·유튜브·공시·매크로·가격/수급·기록보관실 등은 각각 독립적인 감각 모듈이다.
- 종합추론은 여러 감각, 시간, 돈의 흐름, 과거 경험을 연결해 가설·반대가설·현재 방향을 판단하는 머리다.
- 이벤트형(CPI/FOMC/실적 등)은 기대 형성→선반영→발표→검증을 추적한다.
- 추세형(반도체/AI/전력/환율 등)은 방향·속도·자금흐름·사이클 전환을 추적한다.
- 뉴스/유튜브의 '말'과 가격·수급의 '돈의 행동'을 항상 비교하고, 둘의 괴리를 중요한 신호로 본다.
- 새 기능은 반드시 "전체 시스템의 지능을 실제로 높이는가?"를 먼저 검토한다.
- 헌장과 이 파일의 세부 규칙이 충돌하면 `SYSTEM_PHILOSOPHY.md`의 상위 철학을 우선하고, 충돌 사실을 사용자에게 알린다.

### 모든 작업 시작 전 5문장 확인
1. 이 프로그램은 어떤 감각인가?
2. 이번 수정으로 무엇을 더 빨리·정확하게 관찰하게 되는가?
3. 종합추론 머리에 어떤 표준 신호를 전달할 수 있는가?
4. 다른 모듈 없이도 독립 작동하는가?
5. 다른 모듈과 연결되면 어떤 새로운 추론이 가능해지는가?

### 0-1. 객관성·근거 우선 규칙 — 사용자 동의보다 검증이 우선

이 시스템에서 AI는 사용자를 기분 좋게 만드는 역할이 아니라 **틀린 가설을 걸러내고, 근거가 약한 추론을 약하다고 말하는 검수자** 역할도 해야 한다.

다음 규칙을 항상 적용한다.

1. 사용자의 주장에 자동으로 동의하지 않는다. "맞다", "정확하다", "그게 핵심이다" 같은 표현은 독립적인 근거가 확인됐을 때만 사용한다.
2. 사용자의 가설과 AI의 가설을 분리한다. 사용자가 제시한 생각은 먼저 **가설**로 취급하고 사실처럼 확정하지 않는다.
3. 답변 순서는 가능하면 **사실 → 근거 → 반대근거 → 불확실성 → 결론** 순서로 한다.
4. 확인 가능한 최신 사실은 실제 자료·데이터·공식 출처로 검증한다. 확인하지 않은 구체적 숫자·날짜·인용·사건을 만들어내지 않는다.
5. 근거가 없으면 "모른다", "확인되지 않았다", "현재 자료만으로 판단할 수 없다"고 명시한다. 빈칸을 그럴듯한 설명으로 메우지 않는다.
6. 추론과 사실을 명확히 구분한다. 추론에는 "가능성", "가설", "해석"임을 표시한다.
7. 상관관계를 인과관계로 단정하지 않는다. 인과를 주장하려면 시간 선후·메커니즘·대안 설명을 확인한다.
8. 사용자의 기존 믿음과 반대되는 증거도 적극적으로 찾는다. 반대증거가 강하면 사용자 의견과 달라도 그대로 말한다.
9. 여러 설명이 가능하면 하나를 정답처럼 고르지 말고 경쟁 가설로 유지한다.
10. 확률·신뢰도 숫자는 계산 규칙이나 데이터가 있을 때만 사용한다. AI가 감으로 70%, 80% 같은 수치를 만들지 않는다.
11. 투자 관련 답변은 특히 **가격·수급·금리·환율 등 실제 시장 행동**과 말/뉴스를 분리해서 본다.
12. 과거 결과를 보고 당시 신호를 과장하는 후견지명 편향을 피한다. 역추적 시 당시 시점에 알 수 있었던 정보와 나중에 알게 된 정보를 분리한다.
13. AI 자신의 이전 답변도 틀릴 수 있다고 전제한다. 새 근거가 나오면 기존 결론을 방어하지 말고 수정한다.
14. 사용자 칭찬·추켜세우기·과도한 공감은 분석의 근거로 사용하지 않는다. 평가가 필요하면 아이디어가 아니라 **근거·구조·검증 가능성**을 평가한다.
15. 객관적 근거가 부족한 경우 결론을 강하게 만들지 않는다. "가능성 있음", "근거 부족", "추가 검증 필요" 등 강도를 조절한다.

### 투자 추론 답변의 기본 판정 형식

가능하면 다음 5가지를 분리한다.

- **확인된 사실**: 출처나 데이터로 직접 확인됨
- **관찰**: 가격·뉴스량·발언 변화 등 측정된 현상
- **가설**: 관찰을 설명하기 위한 해석
- **반대가설**: 같은 현상을 설명할 수 있는 다른 해석
- **판정**: 현재 근거 기준으로 어느 가설이 더 강한지와 무엇이 아직 미확인인지

사용자가 강하게 확신하더라도 위 구분을 생략하지 않는다.

### 0-2. 재사용 우선 원칙 — 직접 만들기 전에 먼저 찾는다

시간은 핵심 자원이다. 검증된 기존 프로그램·오픈소스·논문·공식 문서·API·데이터셋을 사용할 수 있다면 처음부터 새로 만들지 않는다.

모든 신규 기능/프로그램 요청은 아래 순서로 검토한다.

1. **목적 정의**: 사용자가 원하는 결과가 무엇인지 먼저 정의한다. 사용자가 제시한 구현 방식은 하나의 후보일 뿐이다.
2. **기존 자산 검색**: 현재 GitHub 저장소의 기존 프로그램과 공통 모듈을 먼저 찾는다.
3. **외부 검증 자산 검색**: 공개 GitHub, 공식 SDK/API, 학술논문, 표준 라이브러리, 신뢰할 수 있는 데이터 소스에서 재사용 가능한 구현을 찾는다.
4. **비교 평가**: 재사용 후보를 정확도, 유지보수성, 라이선스, 업데이트 상태, 보안, 비용, 모바일/클라우드 적합성 기준으로 비교한다.
5. **최소 수정 우선**: 검증된 구현이 목적의 70~90%를 충족하면 처음부터 재작성하지 말고 필요한 부분만 수정·어댑터화한다.
6. **직접 구현은 마지막 수단**: 적절한 기존 방법이 없거나, 기존 방법이 시스템 헌장과 충돌하거나, 수정 비용이 새 구현보다 큰 경우에만 직접 만든다.
7. **논문은 아이디어가 아니라 검증 근거로 사용**: 투자 신호, 이벤트 탐지, 뉴스 클러스터링, 시계열·자금흐름 등은 가능하면 연구 결과와 재현 가능한 방법을 확인한다.
8. **인터넷 검색 적극 사용**: 기술 선택·API·라이브러리·오픈소스 상태처럼 최신성이 중요한 항목은 기억에 의존하지 말고 검색으로 검증한다.
9. **가져온 코드는 그대로 신뢰하지 않는다**: 테스트, 라이선스, 보안, 의존성, 데이터 품질을 확인하고 우리 표준 출력에 맞는 어댑터를 붙인다.
10. **사용자에게 방법 선택 부담을 넘기지 않는다**: 사용자는 방향·아이디어·목표를 제시하고, 구현 방법·도구 선정·재사용 후보 탐색·검증은 AI가 주도한다.

#### 기본 판단 기준

- 기존 검증 프로그램이 있음 → **가져와 최소 수정**
- 신뢰 가능한 라이브러리/API가 있음 → **직접 구현 대신 사용**
- 논문에 검증된 알고리즘이 있음 → **논문 방식 재현 또는 검증된 구현 활용**
- 비슷한 기능이 내부에 이미 있음 → **복제 금지, 공통화/재사용**
- 후보들이 모두 부적합 → **그때 새로 설계**

목표는 코드를 많이 만드는 것이 아니라 **가장 짧은 시간에 안정적이고 검증 가능한 기능을 확보하는 것**이다.

---

## 1. 프로젝트 기본 정보

- **GitHub**: `20251014peru-gif.github.io`
- **Firebase 프로젝트**: `my-system-25497` (Blaze)
- **Anthropic 모델**: 반드시 `claude-sonnet-4-6` (날짜 suffix 없음)
- **Anthropic API Key**: localStorage에만 저장, 코드에 하드코딩 금지
- **회사 컴** (항상 켜둠): app.py(port 8080), 텔레그램 봇 상시 실행
- **기기**: PC 2대 + 갤럭시 폰 + 패드 → 모든 기기에서 같은 데이터

---

## 2. 새 앱 만들 때 체크리스트 (말 안 해도 무조건 적용)

```
✅ 0. SYSTEM_PHILOSOPHY.md 먼저 읽고 전체 시스템에서 이 앱의 감각 역할 정의
✅ 0-A. 기존 내부 프로그램·GitHub 오픈소스·공식 API·논문을 먼저 검색하고 재사용 가능성 평가
✅ 0-B. 검증된 기존 구현이 충분하면 새로 만들지 말고 최소 수정/어댑터 방식 우선
✅ 1. 🐞 디버그 패널 + 버전 표시  ← 가장 먼저
✅ 2. 밝은 흰색/라이트 테마 (어두운 배경 절대 금지)
✅ 3. 카테고리 추가/삭제 항상 가능
✅ 4. AI 검색 표준 (일반텍스트 + AI 통합)
✅ 5. Firebase 표준 구조 사용
✅ 6. my_system_search 컬렉션 동시 저장
✅ 7. 앱 시작 시 syncFromFirebase() 자동 실행
✅ 8. 🏠 홈버튼 (index.html로 이동)
✅ 9. JSON 백업/내보내기 기본 포함
✅ 10. 모바일 터치 최적화 (44px, contextmenu 차단)
✅ 11. 캐시버스팅 타임스탬프 (Date.now())
✅ 12. 파일 zip으로 전달
```

---

## 3. Firebase 표준 구조

### 앱 자체 컬렉션 + 전체검색 컬렉션 동시 저장

```javascript
// 저장 시 두 곳에 동시 저장
// 1. 앱 자체 컬렉션 (예: worklog_entries, psc_photos_personal)
// 2. 전체검색용 공통 컬렉션
{
  app: '앱명',        // 'worklog', 'photos', 'parking' 등
  type: '데이터종류', // 'entry', 'photo', 'recipe' 등
  title: '제목',
  memo: '내용',
  cat: '카테고리',
  date: '2026-06-16',
  secure: false,      // true면 검색 제외
  updatedAt: Date.now()
}
```

### Firestore REST API 패턴
```javascript
const FS_BASE = `https://firestore.googleapis.com/v1/projects/my-system-25497/databases/(default)/documents`;

// toFS() / fromFS() 헬퍼 필수
// 배열/객체는 JSON.stringify → stringValue로 저장
// fromFS()가 이미 파싱한 값을 절대 재파싱 금지 (이중 JSON.parse 버그)
```

### 다기기 동기화 패턴
```javascript
// init() 순서
await openIDB();
loadData();        // localStorage에서 빠르게 로드
renderUI();        // 즉시 화면 표시
syncFromFirebase(); // Firebase 최신 데이터 로드
renderUI();        // 갱신
```

---

## 4. 필수 기본 컴포넌트

### 🐞 디버그 패널 (모든 앱 필수)
```javascript
// 전역 에러 자동 캡처
window.onerror = (msg, src, line) => dbg(`❌ ${msg} @ ${src}:${line}`, 'error');

function dbg(msg, type='log'){
  const logs = JSON.parse(localStorage.getItem('_dbg_logs')||'[]');
  const time = new Date().toLocaleTimeString();
  logs.unshift({time, msg, type});
  if(logs.length > 100) logs.pop();
  localStorage.setItem('_dbg_logs', JSON.stringify(logs));
  renderDbgPanel();
}
```

### 버전 표시
```html
<span class="hdr-ver" id="appVersion">v1.0</span>
```
```javascript
// init() 안에서
$('appVersion').textContent = 'v1.0';
```
- 파일 수정할 때마다 버전 올리기
- CSS/JS 쿼리스트링도 같이 갱신: `?v=타임스탬프`

### 비밀번호/PIN 입력창 (갤럭시 크롬 팝업 차단)
```html
<!-- 더미 필드로 크롬 속이기 -->
<input type="text" style="display:none" aria-hidden="true">
<input type="password" style="display:none" aria-hidden="true">

<!-- 실제 입력 — type="password" 절대 금지 -->
<input
  type="text"
  style="-webkit-text-security:disc"
  autocomplete="off"
  inputmode="numeric"
  placeholder="비밀번호">
```

---

## 5. UI/UX 표준

### 검색창
```css
/* 높이 48px, 파란 테두리, 라운드 */
height: 48px;
border: 2.5px solid var(--primary);
border-radius: 14px;
background: #f0f6ff;
padding-left: 44px; /* 🔍 아이콘 공간 */
```

### 테마
- 배경: 항상 흰색/라이트 (#fff, #f8fafc 등)
- 어두운 배경 (#0a0e1a, #111827, #1A1A2E 등) **절대 금지**
- 예외: 풀스크린 뷰어, 문서감지 화면만 허용

### 모바일
- 버튼 최소 높이: 44px
- 꾹 누르기 방지: `oncontextmenu = e => e.preventDefault()`
- CSS: `touch-action: manipulation`
- PIN 입력: `onclick` → `ontouchstart` (300ms 딜레이 제거)

---

## 6. 함정 & 해결책 29가지

### JS 이벤트
| # | 함정 | 해결 |
|---|---|---|
| ① | `_inited` 플래그 사용 | `cloneNode` 또는 `document.addEventListener` |
| ② | 드래그 중 `canvas.width=` 리셋 | `dsRender`(크기+그리기) / `dsRedraw`(그리기만) 분리 |
| ③ | `overflow:hidden` 부모 안 `setPointerCapture` | `document.addEventListener('pointermove')` |
| ④ | 모달 열기 함수가 데이터 배열 초기화 | `preserveImgs=true` 파라미터 명시 |
| ⑮ | 이중 호출로 콜백 덮어씌워짐 | `_sectionLock` 플래그로 차단 |
| ⑱ | `closeEditor()` 후 배열 비어서 전달 실패 | `const copy=arr.slice(); close(); open(copy)` 순서 |
| ㉔ | PIN 모바일 300ms 딜레이 | `onclick` → `ontouchstart` |
| ㉕ | WebAuthn이 PIN 가로챔 | WebAuthn 제거, 수동 PIN만 |

### Firebase
| # | 함정 | 해결 |
|---|---|---|
| ⑥ | Storage REST API CORS 차단 | 이미지 압축 후 Firestore base64 직접 저장 |
| ⑦ | `fromFS()` 결과 재파싱 | `fromFS()`는 이미 파싱됨, 재파싱 금지 |
| ⑧ | 고정 docId → 덮어쓰기 | `uid = Date.now().toString(36) + random` |
| ⑳ | `__conntest__` 예약 ID 오류 | `zz_conntest_` + timestamp 사용 |
| ㉑ | REST API로 Storage 업로드 불가 | `firebase-storage-compat.js` 로드 필수 |
| ㉘ | 백그라운드 업로드 후 저장 완료 | `await fsSave()` — 완료 후 저장 완료 처리 |

### CSS
| # | 함정 | 해결 |
|---|---|---|
| ⑤ | `.ghost` 같은 흔한 클래스명 | 앱 전용 접두사 사용 |
| ㉖ | 검색바 z-index가 팝업보다 높음 | 팝업 z-index를 검색바보다 높게 |

### 코드 작업
| # | 함정 | 해결 |
|---|---|---|
| ⑬ | str_replace 후 고아 코드 잔존 | `node --check` 필수 |
| ⑭ | 비슷한 파일명 혼동 덮어쓰기 | 파일명 항상 명확히 확인 (realestate vs realestate-project) |
| ㉒ | select에 `__new__` 같은 특수값 | filter select에 특수 option 절대 금지 |
| ㉓ | 함수 삭제 후 init()에서 호출 | 삭제 전 호출 위치 전부 확인 |

### Anthropic API
| # | 함정 | 해결 |
|---|---|---|
| ⑯ | 모델명 오류 | 반드시 `claude-sonnet-4-6` |
| ⑰ | 브라우저 직접 호출 CORS | `anthropic-dangerous-direct-browser-access: true` 헤더 필수 |

### 크로스플랫폼
| # | 함정 | 해결 |
|---|---|---|
| ⑩ | iOS `clientWidth` 0 반환 | `requestAnimationFrame` 재시도 루프 |
| ⑪ | Fabric.js CDN 모바일 차단 | `cdn.jsdelivr.net/npm/fabric@5.3.0` |
| ⑫ | 갤럭시 크롬 비번 팝업 | `type=text` + `-webkit-text-security:disc` |
| ⑲ | iPhone HEIC Android에서 안 보임 | `heic2any@0.0.4` 자동 변환 |

### 구조적 원칙
| # | 원칙 |
|---|---|
| ㉗ | 캔버스 단일 렌더 — div 8개+이벤트보다 canvas 1개+히트테스트가 안정적 |
| ㉙ | 같은 오류 3번 반복 = 방식 자체를 바꿔라, 증상 패치 금지 |
| ⑨ | 캐시버스팅 — 매 버전 `Date.now()` 고유 타임스탬프 |

---

## 7. 디버깅 방법론

### 폰 버그 신고 최적 형식
```
"[버튼명] 누르면 → [기대 결과]인데 → [실제 결과]"
+ 🐞 로그 복사해서 붙여넣기
+ 어떤 폰인지 (갤럭시/아이폰)
```

### 로그에서 원인 찾기
- 함수 진입 로그 없음 → 캐시 문제 (시크릿창으로 테스트)
- 진입은 됐는데 중간에 끊김 → 에러 메시지 확인
- 완료됐는데 결과 없음 → 데이터 흐름 확인

### 캐시 문제 해결
- 폰: 시크릿 창으로 열기
- PC: F12 → Application → Service Workers → Unregister
- 강제: URL에 `?v=새타임스탬프` 붙이기

---

## 8. 작업 시작 방식

### 새 대화 시작 시
```
"오늘 할 것: [파일명] [작업내용]
현재 버전: v?.?
문제: [증상]
원하는 결과: [목표]"
```

### Claude가 해야 할 것
1. `SYSTEM_PHILOSOPHY.md` 먼저 읽기
2. 이 파일 읽었음 확인
3. 전체 시스템에서 해당 앱의 감각 역할과 이번 수정의 의미 확인
4. **기존 내부 코드·공개 GitHub·공식 문서/API·관련 논문에서 재사용 가능한 방법 먼저 조사**
5. 재사용 후보와 직접 구현을 비교해 가장 짧고 안정적인 방법 선택
6. 함정 체크리스트 확인
7. 관련 파일 먼저 읽기
8. 작업 시작

---

## 9. 앱 목록 & Firebase 컬렉션

| 앱 | 파일 | 컬렉션 |
|---|---|---|
| 업무일지 | worklog.html/css/js | worklog_entries |
| 개인관리 | personal.html/css/js | 다수 |
| 부동산 프로젝트 | realestate-project.html/css/js | re_* |
| 부동산 투자 | realestate.html | re-costs 등 |
| 방문주차 | parking.html | parking_entries |
| 업체연락처 | contacts.html | contacts |
| 사진스캔 | photos-scan.html/css/js | psc_photos_personal/work |
| 유튜브분석 | youtube.html | youtube-analyses |
| 링크컬렉션 | links.html | lr_links |
| 레시피 | recipes.html | lr_recipes |
| 자재관리 | materials.html | lr_materials |
| 직원관리 | staff.html | staff-records |
| 한국주식 | korea-scanner.html | — |
| 미국주식 | scanner-v15.html | — |
| 시장체크 | market-check.html | market-flow |
| 전체검색 | (index.html) | my_system_search |

---

*최종 업데이트: 2026-09-13 — SYSTEM_PHILOSOPHY.md 최상위 헌장 연동 + 객관성 검증 + 재사용 우선 원칙*