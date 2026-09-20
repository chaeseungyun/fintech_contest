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
    expect(html).toContain('상시 분석');
    expect(html).toContain('손익을 따져볼 항목');
    expect(html).toContain('상품 하나를 바꾸면');
    expect((html.match(/triggerrow/g) ?? []).length).toBe(BASE_SCENARIO.triggers.length);
    expect(html).toContain('연결 혜택');
    // 사전 계산된 순손익(−16.4만원 등)을 허브에 적지 않는다
    expect(html).not.toContain('class="amt');
    expect(html).toContain('확인 필요');
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
      expect(verdict).toMatch(/절차 (보기|안내받기)/);
      expect(verdict).not.toContain('해지합니다');
      expect(verdict).toContain('비교 결과');
      expect(verdict).not.toContain('최종 판단');
      expect(impact).toContain('비교 결과 보기');
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
    expect(verdict).toContain('전체 손익을 판정할 수 없습니다');
    expect(verdict).not.toContain('유지하는 것이');
  });

  it('유지 조건 목록은 비교 결과에 있고 절차 화면에는 없다', () => {
    const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'card_cancel' } }];
    expect(draw(<Verdict triggerId="card_cancel" />, open)).toContain('유지를 택한다면 지킬 조건');
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
    // 후보 카드에는 고르는 버튼이 있고, 추천 배지는 "이득" 이다
    const verdict = draw(<Verdict triggerId="card_cancel" />, [
      ...base,
      { type: 'toggleCandidate', candidateId: 'card_nuri_smart' },
    ]);
    expect(verdict).toContain('이 안으로 절차 보기');
    expect(verdict).toContain('>이득<');
    expect(verdict).not.toContain('>추천<');
  });

  it('차트 아래 문구는 추천 이유를 따른다', () => {
    const at = (triggerId: string) =>
      draw(<Verdict triggerId={triggerId} />, [{ type: 'push', route: { name: 'verdict', triggerId } }]);
    expect(at('card_cancel')).toContain('9개월 유지하면 되돌릴 수 없는 우대의 만기(3월 20일)를 넘깁니다');
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

    // 비교 결과: 갈아타기 후보
    const open: Action[] = [
      { type: 'push', route: { name: 'verdict', triggerId: 'card_cancel' } },
      { type: 'toggleCandidate', candidateId: 'card_nuri_smart' },
      { type: 'toggleStep', stepKey: 'cand:card_nuri_smart' },
    ];
    const verdict = draw(<Verdict triggerId="card_cancel" />, open);
    expect(verdict).toContain('신청 경로 보기');
    expect(verdict).toContain('공식 채널에서 직접 합니다');
    expect(verdict).toContain('시연용 샘플 창구 정보');
    expect(verdict).not.toMatch(/신청하기|신청 완료|가입 완료/);
  });

  it('예·적금 해지는 중도해지 이자를 영향 화면과 실행 안내에서만 보여준다', () => {
    const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'deposit_cancel' } }];
    expect(draw(<Impact triggerId="deposit_cancel" />, open)).toContain('중도해지 이자 손실');
    expect(draw(<ActionPlan triggerId="deposit_cancel" />, open)).toContain('중도해지 이자 손실');
    // 판단 화면에는 별도 카드가 없다 (트리거 caveat 문장은 데이터라 남는다)
    expect(draw(<Verdict triggerId="deposit_cancel" />, open)).not.toContain('만기까지 두면');
  });
});
