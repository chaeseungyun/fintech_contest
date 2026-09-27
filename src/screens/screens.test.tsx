// 화면 렌더 스모크. 계산은 lib 테스트가 본다 — 여기는 "그려지다 터지지 않는가" 만 본다.
// 발표 중 흰 화면이 뜨는 사고를 막는 최소한의 그물이다. jsdom 없이 문자열로 그린다.
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionPlan } from './ActionPlan';
import { Analyzing } from './Analyzing';
import { Assets } from './Assets';
import { Benefits } from './Benefits';
import { Connections } from './Connections';
import { Evidence } from './Evidence';
import { Home } from './Home';
import { Hub } from './Hub';
import { Impact } from './Impact';
import { More } from './More';
import { Timeline } from './Timeline';
import { Verdict } from './Verdict';
import { Term, TermSheet } from '../components/Term';
import { derive } from '../lib/derive';
import type { Scenario } from '../lib/types';
import { BASE_SCENARIO } from '../state/store';
import { initialState, reducer, select, StoreContext, type Action, type AppState } from '../state/store';

function draw(node: ReactElement, actions: Action[] = []): string {
  let state: AppState = initialState();
  for (const a of actions) state = reducer(state, a);
  const { scenario, derived } = select(state);
  return renderToString(
    <StoreContext.Provider value={{ state, scenario, derived, dispatch: () => {} }}>
      {node}
    </StoreContext.Provider>,
  );
}

/** 픽스처를 바꾼 시나리오로 그린다 (featured 같은 선택 필드를 시험할 때) */
function drawWith(scenario: Scenario, node: ReactElement): string {
  const derived = derive(scenario, scenario.defaultTriggerId);
  return renderToString(
    <StoreContext.Provider value={{ state: initialState(), scenario, derived, dispatch: () => {} }}>
      {node}
    </StoreContext.Provider>,
  );
}

const TRIGGERS = BASE_SCENARIO.triggers.map((t) => t.id);

describe('화면 스모크', () => {
  it('홈 — 상단은 은행, 배너는 서비스, 샘플·기준일 표시', () => {
    const html = draw(<Home />);
    expect(html).toContain(`<span class="logo">${BASE_SCENARIO.brand.bank}</span>`);
    expect(html).toContain('FinStay AI');
    expect(html).toContain('샘플 데이터 · 기준일');
    expect(html).toContain('상시 분석 중');
    expect(html).toContain('이번 달 점검');
    expect(html).not.toContain('SwitchPoint');
  });

  it('탭 화면들', () => {
    for (const node of [<Assets key="a" />, <Benefits key="b" />, <More key="m" />]) {
      const html = draw(node);
      expect(html.length).toBeGreaterThan(200);
      expect(html).not.toContain('SwitchPoint');
    }
    expect(draw(<More />)).toContain('FinStay AI');
    expect(draw(<Benefits />)).toContain('더하면 이득인 상품');
  });

  it('허브 — 항목마다 한 행, 금액은 미리 보여주지 않는다', () => {
    const html = draw(<Hub />);
    // "상시 분석 중" 은 홈이 말한다 — 허브는 되풀이하지 않고 입력으로만 언급한다
    expect(html).toContain('미리 볼 수 있습니다');
    expect(html).toContain('상시 분석이 찾아 둔');
    expect(html).not.toContain('상시 분석 중');
    expect(html).not.toContain('계속 보고 있습니다');
    expect(html).toContain('다른 경우도 미리 보기');
    expect((html.match(/triggerrow/g) ?? []).length).toBe(BASE_SCENARIO.triggers.length);
    // 내부 용어 대신 쉬운 말 — 영향받는 상품 수는 holder 를 센 값
    expect(html).not.toContain('연결 혜택');
    expect(html.split('<!-- -->').join('')).toContain('영향받는 상품 4개'); // card_cancel: 주담대·신용대출·정기예금·건강보험
    // 사전 계산된 순손익(−16.4만원 등)을 허브에 적지 않는다
    expect(html).not.toContain('class="amt');
    expect(html).toContain('확인 필요');
  });

  it('허브 — 행 제목은 사용자의 질문, 기능 이름은 보조 줄', () => {
    const html = draw(<Hub />);
    for (const t of BASE_SCENARIO.triggers) {
      expect(t.question).toBeTruthy();
      expect(html).toContain(`<b>${t.question}</b>`);
      expect(html.split('<!-- -->').join('')).toContain(`${t.label} · 영향받는 상품`);
    }
    // 관리비 사례가 featured 라 섹션 제목이 있다. 배지는 두지 않는다
    expect(html).toContain('다른 경우도 미리 보기');
    expect(html).not.toContain('class="badge"');
  });

  it('허브 — featured 트리거는 맨 위 따로, 나머지는 "다른 경우도 미리 보기" 아래', () => {
    // 관리비 계좌 납부만 featured — 다른 트리거를 하나 더 올려도 두 행이 맨 위에 온다
    const scenario: Scenario = {
      ...BASE_SCENARIO,
      triggers: BASE_SCENARIO.triggers.map((t) =>
        t.id === 'insurance_cancel' ? { ...t, featured: true } : t,
      ),
    };
    expect((drawWith(scenario, <Hub />).match(/triggerrow featured/g) ?? []).length).toBe(2);
    const html = draw(<Hub />);
    const featured = html.indexOf('triggerrow featured');
    expect(featured).toBeGreaterThan(-1);
    const section = html.indexOf('다른 경우도 미리 보기');
    const firstQ = BASE_SCENARIO.triggers.find((t) => t.id === 'card_cancel')!.question!;
    // 순서: featured 행 → 섹션 제목 → 나머지 행
    expect(featured).toBeLessThan(section);
    expect(section).toBeLessThan(html.indexOf(firstQ));
    expect((html.match(/triggerrow featured/g) ?? []).length).toBe(1);
    expect(html).not.toContain('바꿔 볼 항목을 고르세요');
  });

  it('홈 배너 — 질문 한 줄과 쉬운 말 상시 분석 줄', () => {
    const html = draw(<Home />);
    expect(html).toContain(BASE_SCENARIO.home.bannerQuestion!);
    expect(html).not.toContain(BASE_SCENARIO.brand.serviceTagline);
    expect(html).toMatch(/혜택 조건 <!-- -->\d+<!-- -->건 상시 분석 중/);
    expect(html).not.toContain('우대 조건');
  });

  it('용어 풀이 — 점선 버튼을 누르면 시트가 열리고 닫힌다', () => {
    const glossary = BASE_SCENARIO.glossary!;
    for (const k of ['우대금리', '실적', '우대 확인일', '변경 가능 구간', '손익분기']) expect(glossary[k]).toBeTruthy();
    // 진입 화면에 버튼으로 붙는다
    expect(draw(<Hub />)).toContain('aria-haspopup="dialog">우대금리</button>');
    expect(draw(<Home />)).toContain('aria-haspopup="dialog">우대 확인일</button>');
    const tl = draw(<Timeline />, [{ type: 'push', route: { name: 'timeline', triggerId: 'card_cancel' } }]);
    expect(tl).toContain('aria-haspopup="dialog">우대 확인일</button>');
    expect(tl).toContain('aria-haspopup="dialog">변경 가능 구간</button>');
    // 풀이가 없는 용어는 버튼이 아니라 글자
    expect(draw(<Term term="없는 용어" />)).toBe('없는 용어');

    expect(draw(<TermSheet />)).toBe('');
    const open = draw(<TermSheet />, [{ type: 'openTerm', term: '우대금리' }]);
    expect(open).toContain('role="dialog"');
    expect(open).toContain('aria-modal="true"');
    expect(open).toContain(glossary['우대금리']);
    expect(draw(<TermSheet />, [{ type: 'openTerm', term: '우대금리' }, { type: 'closeTerm' }])).toBe('');
  });

  it('분석 중 — 샘플 조건으로 계산한다고 적는다', () => {
    const html = draw(<Analyzing triggerId="card_cancel" />, [
      { type: 'push', route: { name: 'analyzing', triggerId: 'card_cancel' } },
    ]);
    expect(html).toContain('실시간 약관 추출·AI 호출 없음');
    expect(html).toContain('추출해 둔 조건');
  });

  for (const triggerId of TRIGGERS) {
    it(`분석 흐름 — ${triggerId}`, () => {
      const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId } }];
      const impact = draw(<Impact triggerId={triggerId} />, open);
      const verdict = draw(<Verdict triggerId={triggerId} />, open);
      const plan = draw(<ActionPlan triggerId={triggerId} />, open);
      const timeline = draw(<Timeline />, open);
      const conn = draw(<Connections triggerId={triggerId} />, open);
      for (const html of [impact, verdict, plan, timeline, conn]) {
        expect(html.length).toBeGreaterThan(300);
      }
      expect(plan).toContain('실행 안내');
      expect(plan).toContain('기준 안');
      // 결론 먼저 — 비교 결과는 결론·차트까지만, 이유·후보·절차 진입은 결과 상세에
      expect(verdict).toContain('비교 결과');
      expect(verdict).toContain('분석 과정 보기');
      expect(verdict).not.toContain('최종 판단');
      expect(verdict).not.toContain('해지합니다');
      expect(verdict).not.toContain('유지를 택한다면');
      expect(verdict).not.toContain('꼭 확인하세요');
      expect(impact).toContain('결과 상세');
      expect(impact).toMatch(/절차 (보기|안내받기)/);
      expect(impact).toContain('꼭 확인하세요');
      // 비교 기준 스트립은 영향·비교 결과 양쪽에
      expect(impact).toContain('basisstrip');
      expect(verdict).toContain('basisstrip');
      // 영향 화면은 세 묶음
      expect(impact).toContain('상품 자체 변화');
      expect(impact).toContain('연결된 상품에 미치는 영향');
    });
  }

  it('보류 판정 — 소계 라벨과 보류 문구', () => {
    const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'loan_change' } }];
    const impact = draw(<Impact triggerId="loan_change" />, open);
    const verdict = draw(<Verdict triggerId="loan_change" />, open);
    expect(impact).toContain('확인된 항목의 변화 소계');
    expect(impact).toContain('전체 비교 보류');
    expect(impact).not.toContain('연간 예상 손익');
    expect(verdict).toContain('verdictcard pending');
    expect(verdict).toContain('전체 손익을 비교할 수 없습니다');
    expect(verdict).not.toContain('유지하는 것이');
  });

  it('유지 조건 목록은 결과 상세에 있고 절차 화면에는 없다', () => {
    const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'card_cancel' } }];
    expect(draw(<Impact triggerId="card_cancel" />, open)).toContain('유지를 택한다면 지킬 조건');
    expect(draw(<ActionPlan triggerId="card_cancel" />, open)).not.toContain('유지를 택한다면');
  });

  it('절차의 기준 안은 고른 것을 따른다 — 고르기 전에는 새 상품 없이', () => {
    const base: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'card_cancel' } }];
    const before = draw(<ActionPlan triggerId="card_cancel" />, base);
    expect(before).toContain('새 상품 없이 해지');
    expect(before).not.toContain('스마트카드 발급 가능 여부');

    const after = draw(<ActionPlan triggerId="card_cancel" />, [
      ...base,
      { type: 'chooseCandidate', triggerId: 'card_cancel', candidateId: 'card_nuri_smart' },
      { type: 'push', route: { name: 'actionplan', triggerId: 'card_cancel' } },
    ]);
    expect(after).toContain('스마트카드로 갈아타기');
    expect(after).toContain('스마트카드 발급 가능 여부');
    expect(after).toContain('다른 안 고르기');
    // 후보 카드(결과 상세)에는 고르는 버튼이 있고, 추천 배지는 "이득" 이다
    const impact = draw(<Impact triggerId="card_cancel" />, [
      ...base,
      { type: 'toggleCandidate', candidateId: 'card_nuri_smart' },
    ]);
    expect(impact).toContain('이 안으로 절차 보기');
    expect(impact).toContain('>이득<');
    expect(impact).not.toContain('>추천<');
  });

  it('차트 아래 문구는 추천 이유를 따른다', () => {
    const at = (triggerId: string) =>
      draw(<Verdict triggerId={triggerId} />, [{ type: 'push', route: { name: 'verdict', triggerId } }]);
    const card = at('card_cancel');
    // 상품·혜택·만기·결과를 전부 적는다 — "우대의 만기" 같은 내부 표현은 쓰지 않는다
    expect(card).toContain('정기예금의 우대금리 0.25%p는 톡톡카드를 보유한 조건으로 가입 때 확정된 것이라');
    expect(card).toContain('만기(2027년 3월 20일)까지 이 우대 없이 이어지고 톡톡카드를 다시 만들어도 되돌아오지 않습니다');
    expect(card).toContain('차트에서는 9개월 구간부터입니다');
    expect(card).not.toContain('우대의 만기');
    // 첫 양수 구간을 "최적 시점" 이라 부르지 않는다 — 손익분기다
    expect(at('loan_change')).toContain('유지 기간이 길수록 지켜지는 혜택이 커집니다');
    // 절감이 없으면 손익분기도 없다 — 강조 막대·배지를 그리지 않는다
    expect(at('loan_change')).not.toContain('>손익분기<');
    expect(at('loan_change')).not.toContain('col rec');
    expect(at('loan_change')).not.toContain('이익으로 돌아섭니다');
    expect(at('insurance_cancel')).toContain('지금 해지해도 연 기준으로 손해가 아닙니다');
    expect(at('card_cancel')).not.toContain('한 바퀴');
  });

  it('근거 화면', () => {
    const triggerId = 'card_cancel';
    const productId = 'loan_nuri_mortgage';
    const html = draw(<Evidence triggerId={triggerId} productId={productId} />, [
      { type: 'push', route: { name: 'evidence', triggerId, productId } },
    ]);
    expect(html.length).toBeGreaterThan(300);
  });

  it('제안·추천 후보의 "신청 경로 보기"는 창구 정보를 펼칠 뿐 신청을 실행하지 않는다', () => {
    // 혜택 탭: 연계 가입 제안
    const addonId = BASE_SCENARIO.candidates!.find((c) => c.mode === 'add')!.id;
    const benefits = draw(<Benefits />, [
      { type: 'toggleCandidate', candidateId: addonId },
      { type: 'toggleStep', stepKey: `addon:${addonId}` },
    ]);
    expect(benefits).toContain('신청 경로 보기');
    expect(benefits).toContain('공식 채널에서 직접 합니다');
    expect(benefits).toContain('창구에서 꼭 물어볼 것');
    expect(benefits).not.toMatch(/신청하기|신청 완료|가입 완료/);

    // 결과 상세: 갈아타기 후보
    const open: Action[] = [
      { type: 'push', route: { name: 'verdict', triggerId: 'card_cancel' } },
      { type: 'toggleCandidate', candidateId: 'card_nuri_smart' },
      { type: 'toggleStep', stepKey: 'cand:card_nuri_smart' },
    ];
    const impact = draw(<Impact triggerId="card_cancel" />, open);
    expect(impact).toContain('신청 경로 보기');
    expect(impact).toContain('공식 채널에서 직접 합니다');
    expect(impact).toContain('시연용 샘플 창구 정보');
    expect(impact).not.toMatch(/신청하기|신청 완료|가입 완료/);
  });

  it('펼친 항목 첫 줄은 쉬운 말 한 문장 — 무엇을 바꾸면 어느 상품의 어떤 우대가 빠져 얼마가 달라지는지', () => {
    const open: Action[] = [
      { type: 'push', route: { name: 'verdict', triggerId: 'card_cancel' } },
      { type: 'toggleExpanded', conditionId: 'k1' },
    ];
    const html = draw(<Impact triggerId="card_cancel" />, open);
    expect(html).toContain('톡톡카드를 해지하면 주담대의 우대금리 0.1%p가 빠져 대출 이자가 연 38,000원 늘어납니다.');
  });

  it('예·적금 해지는 중도해지 이자를 영향 화면과 실행 안내에서만 보여준다', () => {
    const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'deposit_cancel' } }];
    expect(draw(<Impact triggerId="deposit_cancel" />, open)).toContain('중도해지 이자 손실');
    expect(draw(<ActionPlan triggerId="deposit_cancel" />, open)).toContain('중도해지 이자 손실');
    // 판단 화면에는 별도 카드가 없다 (트리거 caveat 문장은 데이터라 남는다)
    expect(draw(<Verdict triggerId="deposit_cancel" />, open)).not.toContain('만기까지 두면');
  });
});
