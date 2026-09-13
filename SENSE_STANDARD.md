# SENSE_STANDARD v0.1 — 감각기관 공통 신호 표준

> 상태: Draft v0.1 / 실제 매크로 연결 테스트 후 수정
>
> 목적: 뉴스·유튜브·공시·매크로·시장/수급·향후 추가 모듈의 서로 다른 표현을 종합추론 시스템이 이해할 수 있는 최소 공통 언어로 변환한다.

## 0. 설계 원칙

1. 각 감각 프로그램의 내부 구조를 억지로 통일하지 않는다.
2. 기존 프로그램은 독립적으로 계속 작동한다.
3. 프로그램 밖의 Adapter가 원본 출력을 이 표준으로 번역한다.
4. 모든 감각이 모든 필드를 채울 필요는 없다.
5. 모르는 값은 추측하지 않고 `null` 또는 `unknown`으로 둔다.
6. AI 없이 생성 가능한 구조를 기본으로 한다.
7. AI가 만든 해석은 AI 생성임을 표시하고 원자료와 분리한다.
8. 사실·관찰·가설·판정을 섞지 않는다.
9. 원자료를 반드시 역추적할 수 있어야 한다.
10. v0.1은 최소 표준이다. 실제 연결 테스트에서 필요성이 확인된 필드만 추가한다.

---

## 1. 신호의 기본 단위

종합추론 시스템으로 들어오는 최소 단위를 `SenseSignal`이라 부른다.

하나의 SenseSignal은 "어느 감각이, 언제, 무엇에 대해, 무엇을 관찰했고, 어느 방향의 변화이며, 어떤 근거를 가지고 있는가"를 표현한다.

### 필수 8개 Core 필드

| 필드 | 의미 | 규칙 |
|---|---|---|
| `signal_id` | 신호 고유 ID | 중복 제거 및 역추적용 |
| `topic` | 무엇에 관한 신호인가 | CPI, 반도체, NVIDIA, USDKRW 등 |
| `source_module` | 어느 감각에서 왔나 | macro/news/market/youtube/filing 등 |
| `observed_at` | 실제 관찰/발생 시각 | ISO-8601 권장 |
| `observation` | 무엇을 관찰했나 | 사실 중심 짧은 문장 |
| `direction` | 어느 방향인가 | up/down/positive/negative/mixed/neutral/unknown |
| `evidence` | 판단 근거 | 값·변화·원문 핵심 등 |
| `provenance` | 원자료 위치 | URL, 파일 ID, 공시번호, 데이터 series ID 등 |

이 8개가 없으면 다른 감각과 연결하기 어렵다. 단, 실제로 방향 개념이 없는 원자료는 `direction=unknown`을 허용한다.

---

## 2. 권장 확장 필드

필요한 감각만 사용한다.

### 시간
- `published_at`: 기사/공시/영상 공개 시각
- `collected_at`: 시스템 수집 시각
- `period`: 2026-08, 2026Q2 등 데이터 대상기간
- `event_date`: 예정된 발표/이벤트 시각

`observed_at`, `published_at`, `collected_at`, `event_date`를 혼용하지 않는다.

### 변화
- `value`: 현재값
- `previous`: 이전값
- `consensus`: 시장 예상값
- `change`: 이전 대비 변화
- `surprise`: actual - consensus 등 사전 정의 방식
- `velocity`: 변화 속도
- `acceleration`: accelerating / slowing / stable / unknown

### 분류
- `signal_type`: fact / observation / calculation / interpretation / hypothesis
- `topic_type`: event / trend / hybrid / unknown
- `stage`: seed / spreading / price_confirmation / saturation / official_confirmation / post_event / unknown
- `country`: US / KR / CN / GLOBAL 등
- `asset_class`: equity / bond / fx / commodity / cash / credit 등

### 신뢰와 품질
- `source_tier`: 1~5
- `confidence`: 계산 규칙이 있을 때만 사용
- `data_status`: confirmed / provisional / estimated / missing / stale / error
- `freshness_seconds`: 현재 시각 대비 데이터 경과시간

### 연결
- `related_topics`: 관련 사건/주제 ID
- `related_assets`: 관련 국가/시장/섹터/종목
- `supports`: 지지하는 가설 ID
- `contradicts`: 반대하는 가설 ID

---

## 3. Source Tier — 출처 신뢰 등급

출처 등급은 '내용이 항상 맞다'는 뜻이 아니라 사실 확인에서의 우선순위다.

### Tier 1 — 1차 공식자료
정부 통계, 중앙은행, 거래소, 기업 공시, SEC/DART, 공식 실적/IR 등.

### Tier 2 — 직접 측정 시장데이터
가격, 거래량, 금리, 환율, ETF, 가능한 공식/검증된 수급 데이터 등.

### Tier 3 — 신뢰 가능한 2차 자료
주요 데이터 제공자, 검증된 리서치 데이터 등. 라이선스와 출처 확인.

### Tier 4 — 뉴스/전문가 발언
사건 발견·확산·시장 내러티브 파악에 중요하나 원자료와 구분.

### Tier 5 — 의견/유튜브/커뮤니티/AI 해석
초기 아이디어·내러티브·가설 탐색에 유용하지만 사실 확인에는 상위 Tier 교차검증 필요.

낮은 Tier를 무시하지 않는다. 초기 신호는 오히려 낮은 Tier에서 먼저 나타날 수 있다. 단, 사실 확정과 가설 탐색을 구분한다.

---

## 4. AI 독립성

`SenseSignal` 생성의 핵심 필드는 가능한 한 프로그램 규칙과 원자료로 생성한다.

AI는 선택적 보조기능이다.

AI가 없어도 가능한 것:
- 값과 변화 계산
- 이전/예상/실제 비교
- 상대강도 계산
- 가격/거래량/수급 변화
- 공식 이벤트 일정 연결
- 규칙 기반 stage 후보
- 데이터 누락/오래됨 판정

AI가 보조할 수 있는 것:
- 긴 공시/뉴스/영상에서 의미 추출
- topic 후보 매핑
- 인과관계 후보 제시
- 2차 파급경로 후보 제시
- 가설/반대가설 문장화

AI 결과는 `signal_type=interpretation` 또는 `hypothesis`로 표시하고 공식 사실처럼 승격하지 않는다.

---

## 5. Missing Sense 원칙

어떤 감각이 없어도 전체 시스템은 멈추지 않는다.

예:
- 뉴스 없음 → 시장·매크로·공시로 판단 지속
- 유튜브 없음 → 선행 의견 감각 부족 표시
- 공시 없음 → 공식 기업확인 부족 표시
- AI 없음 → 규칙/통계 기반 판단 지속
- 시장데이터 없음 → 실제 돈의 행동 확인 불가 표시

종합추론은 누락된 감각을 숨기지 않고 `missing_senses`로 표시한다.

신뢰도는 누락 감각 때문에 자동으로 임의 숫자를 낮추지 않는다. 사전에 정의된 평가규칙이 있을 때만 수치화한다.

---

## 6. 동일 사건 중복 처리

같은 사실을 뉴스 30건이 반복해도 증거 30개로 계산하지 않는다.

Adapter/Bridge 단계에서 가능하면:
1. 원사건 후보를 묶는다.
2. 최초 출처를 보존한다.
3. 반복 보도량은 `spread` 신호로 별도 계산한다.
4. 새로운 사실이 추가된 기사만 `novelty` 신호 후보로 본다.

따라서 `정보의 새로움`과 `정보의 확산`은 다른 데이터다.

---

## 7. 자본흐름 표현

시장/수급 감각은 가능하면 다음 계층을 사용한다.

`asset_class → country → market → style → sector → industry → company`

자금흐름 신호는 최소한:
- `from_node`
- `to_node`
- `flow_evidence`
- `flow_strength` (계산 규칙 있을 때)
- `duration`

을 확장 필드로 사용할 수 있다.

'다음 수혜'는 사실 신호가 아니다. 근거가 충분하지 않으면 `hypothesis`로만 전달한다.

---

## 8. v0.1 JSON 예시 — 매크로

```json
{
  "signal_id": "macro_us_cpi_2026-10",
  "topic": "US_CPI",
  "source_module": "macro",
  "observed_at": "2026-10-XXT08:30:00-04:00",
  "observation": "미국 CPI 발표값이 업데이트됨",
  "direction": "unknown",
  "evidence": {
    "actual": null,
    "previous": null,
    "consensus": null
  },
  "provenance": {
    "source": "official",
    "series_id": "TBD"
  },
  "signal_type": "fact",
  "topic_type": "event",
  "country": "US",
  "data_status": "confirmed"
}
```

값을 모르면 예시를 채우지 않는다.

---

## 9. v0.1 JSON 예시 — 시장

```json
{
  "signal_id": "market_kr_semiconductor_rs_YYYYMMDD",
  "topic": "KR_SEMICONDUCTOR",
  "source_module": "market",
  "observed_at": "YYYY-MM-DDTHH:MM:SS+09:00",
  "observation": "한국 반도체 섹터 상대강도 변화",
  "direction": "unknown",
  "evidence": {
    "relative_strength": null,
    "volume_change": null,
    "foreign_flow": null
  },
  "provenance": {
    "source": "market_data",
    "dataset": "TBD"
  },
  "signal_type": "calculation",
  "topic_type": "trend",
  "country": "KR"
}
```

---

## 10. Bridge 구조

기존 앱을 직접 표준에 맞춰 뜯어고치는 것을 기본으로 하지 않는다.

```text
기존 뉴스레이더 ─ news_adapter ─┐
유튜브 분석기 ─ youtube_adapter ─┤
매크로 관측실 ─ macro_adapter ──┤
시장/수급 ─ market_adapter ─────┤
공시 ─ filing_adapter ──────────┤
                                ↓
                         SenseSignal Stream
                                ↓
                         종합추론 엔진
```

Adapter가 고장 나도 원래 프로그램은 계속 작동해야 한다.

---

## 11. 종합추론기가 받아야 하는 묶음

머리는 단일 신호뿐 아니라 특정 시점의 `ReasoningSnapshot`을 만든다.

```json
{
  "snapshot_at": "YYYY-MM-DDTHH:MM:SS+09:00",
  "topic": "TOPIC_ID",
  "signals": [],
  "missing_senses": [],
  "facts": [],
  "observations": [],
  "calculations": [],
  "hypotheses": [],
  "counter_hypotheses": [],
  "unconfirmed": [],
  "next_checks": []
}
```

과거 Snapshot은 결과가 나온 뒤 수정하지 않는다. 새 판단은 새 Snapshot으로 저장한다. 이는 후견지명 편향 방지와 성능평가에 필요하다.

---

## 12. v0.1 완료 검증 항목

다음 5개 샘플을 실제로 표준화해본 뒤 v0.1을 확정한다.

- [ ] 미국 매크로 지표 1개
- [ ] 한국 매크로 지표 1개
- [ ] 시장 가격/자금흐름 신호 1개
- [ ] 뉴스 사건 신호 1개
- [ ] 공시 또는 유튜브 신호 1개

검증 질문:
- [ ] 원자료로 역추적 가능한가?
- [ ] AI 없이 핵심 필드 생성 가능한가?
- [ ] 사실과 해석이 섞이지 않는가?
- [ ] 프로그램 하나가 빠져도 Snapshot 생성 가능한가?
- [ ] 서로 다른 감각을 topic 기준으로 묶을 수 있는가?
- [ ] 시간 선후를 비교할 수 있는가?
- [ ] 중복 보도가 증거를 부풀리지 않는가?
- [ ] 미래 성능평가에 필요한 과거 Snapshot을 보존할 수 있는가?

---

## 13. v0.1에서 일부러 정하지 않는 것

아래는 데이터 없이 지금 확정하면 임의 규칙이 될 가능성이 높으므로 후속 단계로 미룬다.

- 감각별 가중치
- 종합 신뢰도 공식
- 매수/매도 점수
- 뉴스 sentiment 점수
- 자금흐름 강도 임계값
- 이벤트 stage 자동판정 임계값
- 미국/한국 상대매력 종합점수

이 값들은 실제 데이터와 결과를 축적한 뒤 `EVALUATION_PROTOCOL`을 통해 검증하여 정한다.

---

# 한 문장 표준

> **각 감각은 자기 방식으로 세상을 관찰하되, 머리에는 언제·무엇을·어디서·어떻게 관찰했으며 그 근거가 무엇인지 최소 공통언어로 전달한다. 모르는 것은 만들지 않고, 사실과 해석을 분리하며, 어느 감각 하나가 없어도 전체 판단은 계속된다.**
