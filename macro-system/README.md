# Macro System Workspace

이 폴더는 미국·한국 매크로 감각기관, 자금흐름 연결, 매크로 Adapter, 테스트, 문서의 원본 저장 위치다.

## 원칙

- 최상위 철학: `../SYSTEM_PHILOSOPHY.md`
- 전체 구조: `../CORE_ARCHITECTURE.md`
- 감각 공통표준: `../SENSE_STANDARD.md`
- 디자인 표준: `../DESIGN_SYSTEM.md`
- 매크로 관련 신규 개발은 기본적으로 이 폴더 안에 저장한다.
- 기존 배포 파일은 링크·워크플로 의존성을 확인하기 전까지 임의로 이동하지 않는다.
- 기존 매크로 프로그램을 이 폴더로 이전할 때는 먼저 의존성 지도와 회귀 테스트를 만든다.

## 기본 구조

- `MACRO_STANDARD.md` : 미국·한국 매크로 표준
- `adapters/` : 기존 매크로 프로그램 → SenseSignal 변환
- `collectors/` : 공식 데이터 수집기
- `engine/` : AI 없이 작동하는 규칙·통계 기반 매크로 판정
- `ui/` : 매크로 관측/분석 화면
- `data/` : 스키마·샘플·캐시 규칙
- `tests/` : 단위/통합/실시간 이벤트 검증
- `docs/` : 데이터 출처·지표 사전·설계 기록

## 개발 순서

1. MACRO_STANDARD v1
2. US Core / KR Core 지표 확정
3. 공식 데이터 출처와 수집 가능성 검증
4. macro_adapter v0.1
5. AI 없는 기본 판정 엔진 v0.1
6. 미래 이벤트 실시간 Snapshot 테스트
7. US↔KR 상대시장 비교
8. 자금흐름 감각 연결

이 폴더가 매크로 시스템의 Source of Truth다.
