# 급여통장 변경 — 연쇄 영향 분석 (핀테크 공모전 데모, 1차 초안)

급여통장을 다른 은행으로 옮기려 할 때, 그 통장에 걸린 다른 상품들의 우대 혜택이 **함께 깨진다**는 것을
사전에 보여주고, **언제 옮기면 이번 달 혜택을 지킬 수 있는지** 계산하는 정적 웹 앱.
서버·API·LLM 호출 없음. 데이터는 `src/fixtures/scenario.json` 하나.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 계산 규칙 테스트 (expected 블록 재현)
npm run build      # dist/ 에 정적 빌드 → 그대로 배포
```

## 시연 흐름

1. **내 금융 연결** — 급여통장 중심 관계도. 선을 누르면 약관 원문이 뜬다 (그림이 아니라 데이터).
2. **변경 영향** — 합계 연 800,000원. 상품별 내역 금액순. 회복 가능 3건 / 회복 불가 1건.
3. **시점** — 9/15 · 9/30 · 10/5 판정일과 안전 구간(9/30 이후). 정기예금은 만기까지 회복 불가.
4. **근거** — 약관 원문 하이라이트 + 추출값. `감면 폭` `판정 주기` `실적 기준` 수정 가능.

**핵심 장면**: 화면 4에서 신용카드 칩 → 실적 기준 `300,000` → `600,000` 으로 수정하면
화면 2 합계가 800,000 → 560,000, 화면 3 안전 시점이 9/30 → 9/15 로 즉시 바뀐다.
(현재 카드 실적 42만원 < 기준 60만원 → 이미 미적용 → 손실 0, 시점 계산 제외)

상단 **4화면 나란히** 로 네 화면을 동시에 띄우면 수정 → 재계산이 한눈에 보인다.
**데모 초기화** 로 언제든 처음 상태로 돌아간다.

## 구조

```
src/
  fixtures/scenario.json   유일한 데이터 소스 (오늘 = meta.today, 2026-09-08 고정)
  lib/
    dates.ts        날짜 산술 — Date 객체 없이 정수 산술. 말일 clamping, 년→월→일 순서
    interpreter.ts  RECUR / ROLLING / COUNT / PERMANENT → 판정일, 회복 가능 여부, 안전 시점
    money.ts        rate_delta = 원금 × |금리차|, monthly_benefit = 월 × 12 (전부 연 단위)
    graph.ts        binds.target 역방향 조회 → 관계도 선
    edits.ts        사용자 수정을 시나리오에 입히고 출처를 'user' 로 바꿈
    derive.ts       위를 합쳐 네 화면이 읽는 파생값 하나로
    evidence.ts     화면 4 값 목록 (태그·수정 가능 여부 포함)
  state/store.ts    단일 상태 (기본 시나리오 + 수정 + 화면 위치). localStorage 없음
  screens/          Connections · Impact · Timing · Evidence
  components/       PhoneFrame · SourceTag · Highlight
```

모든 수치는 `Tagged<T> = { value, source }` 로 출처(약관/계산/보유정보/사용자)를 함께 들고 다닌다.
계산 규칙과 금지 사항은 `CLAUDE.md` 참고.
