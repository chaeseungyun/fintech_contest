# FinStay AI — 보유 금융상품 상시 분석 에이전트 (핀테크 공모전 데모)

보유한 금융상품 사이의 **연결(우대 조건)** 을 약관에서 추출해 두고, 하나를 유지·변경·해지할 때
다른 상품의 혜택이 어떻게 움직이는지 계산하는 모바일 금융앱 데모. 은행 앱 안의 한 메뉴로 동작한다.
서버·API·LLM 호출 없음. 데이터는 `src/fixtures/scenario.json` 하나이고 오늘 날짜는 `meta.today` 로 고정.

**갈아타기 추천 서비스가 아니다.** 흐름은 `상시 분석 → 손익 판정 → 비교 결과 → 실행 안내` 이고,
대체·연계 상품 제안은 그 판정을 통과했을 때만 따라붙는다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 계산 규칙 테스트 (scenario.json 의 expected 블록 재현) + 화면 스모크
npm run build      # dist/ 에 정적 빌드 → 그대로 배포
```

## 시연 흐름

1. **홈(은행 홈)** — 총자산 · 퀵메뉴 · 서비스 배너("상품 n개 · 우대 조건 m건 상시 분석 중") · 이번 달 점검.
   상단에 "샘플 데이터 · 기준일" 칩. 점검 행은 혜택 탭으로 간다.
2. **바꿔 볼 항목 (바텀시트)** — 배너·퀵메뉴에서 홈 위로 올라온다. 트리거마다 연결 건수·영향 상품·확인 필요 입력만 보여주고,
   **손익 금액은 분석 전에 보여주지 않는다.**
3. **분석 중** — 진행률 링과 4단계. 미리 추출해 둔 샘플 조건으로 계산한다(실시간 약관 추출·AI 호출 없음).
4. **비교 결과** — "확인된 조건에서는 …" 결론 한 줄, 연 순손익 하나, 비교 기준, 유지 기간별 손익 차트.
   시점 스트립에서 우대 확인일 화면으로 바로 들어간다. 핵심 입력이 빠진 트리거는 **보류**로 소계만 낸다.
5. **결과 상세** — ① 상품 자체 변화(절감) ② 연결된 상품 영향 ③ 변경 비용(일회성) · 합계 근거 · 유지 조건 ·
   갈아타기 후보 · 체크리스트. 항목을 펼치면 쉬운 말 한 문장, 확인 주기, 약관 원문(추출 구간 표시).
   후보에서 **"이 안으로 절차 보기"** 를 누른 것이 실행 안내의 기준 안이 된다.
6. **실행 안내** — 빠진 입력 확인 → 발급 가능 여부·우대 인정 조건 확인 → 자동납부·결제계좌 이전 →
   이번 달 우대 확인 종료까지 대기 → 되돌릴 수 없는 손실 확인 → 기존 상품 정리 신청. 창구·기한·물어볼 질문.
   해지·가입을 대신 실행하지 않는다.

상세 화면: **우대 확인일 · 변경 가능 구간**(타임라인) · **연결 관계도**(선을 누르면 약관 원문) · **근거 원문**(값 수정).

**핵심 장면**: 근거 화면에서 실적 기준을 올려 조건이 "이미 미적용" 이 되면 영향 합계·변경 가능 구간·
실행 안내·혜택 탭이 한 번에 다시 계산된다. `전체` 탭의 **데모 초기화** 로 처음 상태로 돌아간다.

## 구조

```
src/
  fixtures/scenario.json   유일한 데이터 소스
  lib/
    dates.ts        날짜 산술 — Date 객체 없이. 말일 clamping, 년→월→일 순서
    interpreter.ts  RECUR / ROLLING / COUNT / PERMANENT → 우대 확인일, 회복 가능 여부, 변경 가능 시점
    money.ts        연 단위 손실·절감, 중도해지 이자(일회성)
    horizon.ts      유지 기간별 손익(0·3·6·9·12개월)과 강조 구간·이유
    graph.ts        binds.target 역방향 조회 → 관계도 선
    recommend.ts    손실을 넘어서는 갈아타기 후보
    addon.ts        보유 상품을 그대로 두고 더하면 이득인 후보
    watch.ts        트리거 없이 보는 상시 요약 (홈·혜택 탭)
    actionplan.ts   판단 결과를 실행 순서로 엮음 — 새로 계산하지 않음
    derive.ts       위를 합쳐 화면이 읽는 파생값 하나로
    edits.ts        사용자 수정을 시나리오에 입히고 출처를 'user' 로
    evidence.ts · portfolio.ts · format.ts · types.ts
  state/store.ts    단일 상태 (수정 + 탭 + 화면 스택 + 고른 안). localStorage 없음
  screens/          Home · Hub · Analyzing · Verdict · Impact · ActionPlan · Timeline · Connections · Evidence · Assets · Benefits · More
  components/       AppShell · Amount · BasisStrip · Clause · ContactSheet · HorizonChart · RecommendCard · AddonCard
                    · QuickMenu · SourceTag · EditBadge · Highlight · Glyph
  styles.css        토큰(:root)과 전체 스타일 — 화면은 클래스만 쓴다
docs/
  design/           UI 시안(정적 HTML)과 사양 spec.md · tokens.css — 앱이 읽지 않음
  archive/          초기 시안과 착수 프롬프트 (보관용)
```

모든 수치는 `Tagged<T> = { value, source }` 로 출처(약관/계산/보유 정보/사용자)를 함께 들고 다닌다.
계산 규칙·시각 규칙·금지 사항은 `CLAUDE.md`, 화면 시안의 의도는 `docs/design/spec.md` 참고.
