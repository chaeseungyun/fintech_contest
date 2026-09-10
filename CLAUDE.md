# 급여통장 변경 — 연쇄 영향 분석 (핀테크 공모전 데모)

Vite + React + TypeScript 정적 웹 앱. 서버·API·LLM 호출 없음. 상태는 React state만.
유일한 데이터 소스는 `src/fixtures/scenario.json`. 오늘 날짜는 `meta.today`.

- `npm run dev` 개발 서버 · `npm test` 테스트 · `npm run build` 정적 빌드(`dist/`)
- 계산 로직은 `src/lib/` 순수 함수. 화면은 `src/screens/`, 단일 상태는 `src/state/store.ts`.

## 계산 규칙 — 여기가 이 프로젝트의 본체다

**날짜 (`dates.ts`)**
- 타임존 `Asia/Seoul` 고정. 시각 없이 날짜만 다룬다. `Date` 객체의 시분초를 절대 쓰지 않는다.
- 구간은 반열림 `[start, end)`로 통일한다.
- 월 오프셋은 말일 clamping을 한다. 1/31에 `+1M`은 2/28(29)이다.
- 년·월·일 오프셋이 섞이면 년 → 월 → 일 순서로 적용한다. 순서를 바꾸면 결과가 달라진다.
- 오늘은 `scenario.json`의 `meta.today`를 쓴다. **`new Date()`를 호출하지 않는다.** 발표 당일 타임라인이 깨진다.

**연산자 평가 (`interpreter.ts`)**

각 조건의 `expr.op`에 따라 "다음 판정일"과 "회복 가능 여부"를 낸다.

- `RECUR` — `params.from.dayOfMonth` 기준으로 오늘 이후 첫 판정일. 오늘이 그 날이면 오늘로 본다.
- `ROLLING` — `params.settleOn`이 `month_end`면 이번 달 말일.
- `COUNT` — `params.checkOn.dayOfMonth` 기준 다음 확인일.
- `PERMANENT` — 판정일 없음(`null`). 회복 불가로 표시하고 `params.until` 앵커를 상품의 `facts.maturity`로 바인딩해 회복 시점을 낸다.

전체 안전 시점은 회복 가능한 조건들의 판정일 중 **이번 달 안에 남은 것 가운데 가장 늦은 날**이다
(팀 확정 2026-09-10: 이미 지난 이번 달 판정은 제외. 그래서 c3의 10/5는 빠지고 `safeAfter`는 9/30).
그 날이 지나면 이번 달 판정이 모두 끝난 상태가 된다.

`metric.currentValue`가 있고 `threshold`보다 작으면 그 혜택은 **이미 미적용** 상태다 — 손실 0원으로 두고
안전 시점 계산에서도 제외한다. 화면 4에서 실적 기준을 올리면 이 경로로 화면 2·3이 바뀐다.

**금액 (`money.ts`)**
- `effect.kind === "rate_delta"` — 원금 × |금리차| = 연간 손실. 대출은 첫해 기준이므로 그렇게 라벨링한다.
- `effect.kind === "monthly_benefit"` — 월 금액 × 12.
- 모든 금액은 연 단위로 통일한다. 상품마다 만기가 달라 총액으로는 더할 수 없다.
- 순수 함수로 작성한다. 같은 입력에 항상 같은 값이 나와야 한다.

**연쇄 (`graph.ts`)**
- `binds.target`이 변경 대상 상품을 가리키는 조건을 전부 찾는다.
- 각 조건의 `binds.holder`가 영향받는 상품이다.
- 관계도의 선은 이 배열을 순회해 그린다. **SVG를 손으로 박아두지 않는다.** 조건이 늘면 선도 늘어야 한다.

## 출처 태그 — 반드시 지킬 것

화면에 뜨는 모든 수치에 네 종류 중 하나의 태그가 붙는다.

| 태그 | 색 | 무엇 |
|---|---|---|
| 약관에서 추출 | `#5B4BB8` / 배경 `#EDE9FB` | 조건의 `expr`, `binds`, `effect` |
| 계산 결과 | `#0F766E` / 배경 `#DCF2EF` | 판정일, 손실 금액, 안전 시점 |
| 보유 상품 정보 | `#6B7280` / 배경 `#EDEFF2` | `products[].facts` |
| 사용자 확인 | `#B45309` / 배경 `#FBEEDC` | 사용자가 수정한 값 |

태그는 **값과 같은 객체에 담는다** (`Tagged<T> = { value, source }`). 화면에서 조건문으로 붙이지 않는다.
값을 만드는 함수가 출처를 함께 반환하는 구조로 만든다.

## 절대 하지 말 것

- 금액이나 날짜를 문자열로 하드코딩하지 않는다. `800,000`이나 `2026-09-30`을 JSX에 직접 쓰면 수정 기능이 무의미해진다. `scenario.json`의 `expected` 블록은 테스트용이지 표시용이 아니다.
- `new Date()`를 호출하지 않는다.
- localStorage, sessionStorage를 쓰지 않는다.
- 네 화면이 각자 값을 복사해 갖지 않는다. 단일 상태 객체를 공유한다.
