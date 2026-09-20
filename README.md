# FinStay AI — 보유 금융상품 상시 분석 에이전트 (핀테크 공모전 데모)

보유한 금융상품 사이의 **연결(우대 조건)** 을 약관에서 추출해, 하나를 유지·변경·해지할 때
다른 상품의 혜택이 어떻게 움직이는지 상시 계산하는 모바일 금융앱 데모.
서버·API·LLM 호출 없음. 데이터는 `src/fixtures/scenario.json` 하나이고 오늘 날짜는 `meta.today` 로 고정.

**갈아타기 추천 서비스가 아니다.** 흐름은 `상시 분석 → 손익 판정 → 최종 판단 → 실행 안내` 이고,
대체·연계 상품 제안은 그 판정을 통과했을 때만 따라붙는다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 계산 규칙 테스트 (scenario.json 의 expected 블록 재현)
npm run build      # dist/ 에 정적 빌드 → 그대로 배포
```

## 시연 흐름

1. **홈** — 이번 달 판정이 남은 우대 조건과 "상품 n개 · 조건 m건 상시 분석 중". 배너를 누르면 허브.
2. **허브** — 유지·변경 손익을 따져볼 항목(트리거) 목록. 지금 실행 시 연 순손익을 함께 보여준다.
3. **영향 분석** — 연결된 상품별 연간 손실, 절감액, 순손익. 각 항목을 펼치면 판정 주기·판정일·약관 원문.
4. **최종 판단** — 유지/변경 판정, 시점별 손익 차트, 손실을 넘어서는 갈아타기 후보, 확인할 것.
5. **실행 안내** — 새 상품 먼저 → 이번 달 판정 끝난 뒤 → 기존 상품 정리. 창구·기한·물어볼 질문.
   해지·가입을 대신 실행하지 않는다.

상세 화면: **판정일·안전 시점**(타임라인) · **연결 관계도**(선을 누르면 약관 원문) · **약관 근거**(값 수정).

**핵심 장면**: 근거 화면에서 실적 기준을 올려 조건이 "이미 미적용" 이 되면 영향 합계·안전 시점·
실행 안내·혜택 탭이 한 번에 다시 계산된다. `전체` 탭의 **데모 초기화** 로 처음 상태로 돌아간다.

## 구조

```
src/
  fixtures/scenario.json   유일한 데이터 소스
  lib/
    dates.ts        날짜 산술 — Date 객체 없이. 말일 clamping, 년→월→일 순서
    interpreter.ts  RECUR / ROLLING / COUNT / PERMANENT → 판정일, 회복 가능 여부, 안전 시점
    money.ts        연 단위 손실·절감, 중도해지 이자(일회성)
    horizon.ts      시점별 손익과 추천 구간
    graph.ts        binds.target 역방향 조회 → 관계도 선
    recommend.ts    손실을 넘어서는 갈아타기 후보
    addon.ts        보유 상품을 그대로 두고 더하면 이득인 후보
    watch.ts        트리거 없이 보는 상시 요약 (홈·혜택 탭)
    actionplan.ts   판단 결과를 실행 순서로 엮음 — 새로 계산하지 않음
    derive.ts       위를 합쳐 화면이 읽는 파생값 하나로
    edits.ts        사용자 수정을 시나리오에 입히고 출처를 'user' 로
  state/store.ts    단일 상태 (수정 + 탭 + 화면 스택). localStorage 없음
  screens/          Home · Hub · Analyzing · Impact · Verdict · ActionPlan · Timeline · Connections · Evidence · Assets · Benefits · More
  components/       AppShell · Amount · SourceTag · HorizonChart · RecommendCard · AddonCard · Highlight · Glyph
docs/archive/       초기 시안과 프롬프트 (참고용, 앱이 읽지 않음)
```

모든 수치는 `Tagged<T> = { value, source }` 로 출처(약관/계산/보유 정보/사용자)를 함께 들고 다닌다.
계산 규칙과 금지 사항은 `CLAUDE.md` 참고.
