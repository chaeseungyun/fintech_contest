import { describe, expect, it } from 'vitest';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, DEPOSIT, EXPECTED, SALARY, TRIGGER_IDS } from './fixture.test-helpers';
import { formatWonCompact, formatWonShort } from './format';
import { annualLossOf, capAdjustment, earlyTermination, formatRateDelta, interestFor, lossBreakdown, savingAmountOf } from './money';
import { totalAssets } from './portfolio';
import type { MappedCondition } from './types';

const scenario = applyEdits(BASE, {});
const cond = (id: string) => scenario.conditions.find((c) => c.id === id) as MappedCondition;
const product = (id: string) => scenario.products.find((p) => p.id === id)!;

describe('expected.annualLossByProduct 재현 — 트리거 전부', () => {
  for (const triggerId of TRIGGER_IDS) {
    const e = EXPECTED.triggers[triggerId];
    const d = derive(scenario, triggerId);

    it(`${triggerId}: 상품별 손실`, () => {
      // 같은 상품에 조건이 여럿 걸릴 수 있다(카드 실적 구간 k1·k1b) — 상품별로 더한다
      const byProduct: Record<string, number> = {};
      for (const i of d.items.filter((x) => x.effectiveLoss.value > 0)) {
        byProduct[i.product.id] = (byProduct[i.product.id] ?? 0) + i.effectiveLoss.value;
      }
      expect(byProduct).toEqual(e.annualLossByProduct);
      expect(d.items.every((i) => i.loss.annualLoss.source === 'calc')).toBe(true);
    });

    it(`${triggerId}: 합계 ${e.annualLossTotal.toLocaleString()} · 절감 ${e.savingsTotal.toLocaleString()} · 순손익 ${e.netAnnual.toLocaleString()}`, () => {
      expect(d.total.value).toBe(e.annualLossTotal);
      expect(d.total.source).toBe('calc');
      expect(d.savingsTotal.value).toBe(e.savingsTotal);
      expect(d.netAnnual.value).toBe(e.netAnnual);
      expect(d.affectedCount).toBeGreaterThanOrEqual(Object.keys(e.annualLossByProduct).length);
    });

    it(`${triggerId}: 금액 큰 순으로 정렬된다`, () => {
      const values = d.items.map((i) => i.effectiveLoss.value);
      expect(values).toEqual([...values].sort((a, b) => b - a));
    });
  }
});

describe('계산 규칙', () => {
  it('rate_delta = 원금 × |금리차|, 부호 무관', () => {
    expect(annualLossOf(cond('c1'), product('loan_nuri_mortgage'))).toBe(38_000_000 * 0.003);
    expect(annualLossOf(cond('k2'), product('dep_nuri_term'))).toBe(20_000_000 * 0.0025);
  });
  it('monthly_benefit = 월 금액 × 12', () => {
    expect(annualLossOf(cond('c2'), product('card_nuri_tok'))).toBe(20_000 * 12);
    expect(annualLossOf(cond('k3'), product('ins_nuri_care'))).toBe(2_000 * 12);
  });
  it('대출만 첫해 기준 라벨', () => {
    expect(lossBreakdown(cond('c1'), product('loan_nuri_mortgage')).periodNote).toBe('첫해 기준');
    expect(lossBreakdown(cond('k2'), product('dep_nuri_term')).periodNote).toBeNull();
  });
  it('원금 출처는 보유 상품 정보', () => {
    expect(lossBreakdown(cond('c1'), product('loan_nuri_mortgage')).principal?.source).toBe('holding');
    expect(lossBreakdown(cond('c2'), product('card_nuri_tok')).principal).toBeNull();
  });
  it('순수 함수: 두 번 계산해도 같은 값', () => {
    expect(derive(scenario, CARD).total.value).toBe(derive(scenario, CARD).total.value);
  });
});

describe('절감은 상품 facts 에서 나온다', () => {
  it('연회비는 카드 facts.annualFee', () => {
    expect(savingAmountOf({ kind: 'annual_fee', label: '연회비', note: '' }, product('card_nuri_tok'))).toBe(
      30_000,
    );
  });
  it('보험료는 월 보험료 × 12', () => {
    expect(
      savingAmountOf({ kind: 'monthly_premium', label: '보험료', note: '' }, product('ins_nuri_care')),
    ).toBe(68_000 * 12);
  });
  it('근거가 없는 상품이면 절감 항목이 빠진다', () => {
    expect(savingAmountOf({ kind: 'annual_fee', label: '연회비', note: '' }, product('dep_nuri_term'))).toBeNull();
    expect(derive(scenario, SALARY).savings).toHaveLength(0);
  });
});

describe('보유 현황', () => {
  it('총 자산은 예적금·투자 잔액의 합', () => {
    const assets = totalAssets(scenario);
    expect(assets.value).toBe(EXPECTED.totalAssets);
    expect(assets.source).toBe('calc');
  });
});

describe('수정 → 재계산', () => {
  it('카드 실적 우대(30만 구간)를 0.5%p 로 올리면 그 행 손실이 190,000 이 되고 태그가 user 로 바뀐다', () => {
    const d = derive(applyEdits(BASE, { k1: { effectValue: -0.005 } }), CARD);
    const row = d.items.find((i) => i.condition.id === 'k1')!;
    expect(row.loss.annualLoss.value).toBe(190_000);
    expect(row.loss.effect.source).toBe('user');
    expect(d.total.value).toBe(EXPECTED.triggers[CARD].annualLossTotal - 38_000 + 190_000);
  });

  it('시연 장면: 60만 구간 기준을 90만으로 올리면 그 0.1%p 가 이미 미적용이 되고 안전 시점은 9/30 으로 남는다', () => {
    const before = derive(scenario, CARD);
    const after = derive(applyEdits(BASE, { k1b: { threshold: 900_000 } }), CARD);
    expect(before.total.value).toBe(188_000);
    expect(after.total.value).toBe(188_000 - 38_000);
    expect(after.affectedCount).toBe(4);
    expect(after.inactive.map((i) => i.condition.id)).toEqual(['k1b']);
    const tier = after.items.find((i) => i.condition.id === 'k1b')!;
    expect(tier.effectiveLoss.value).toBe(0);
    expect(tier.loss.annualLoss.value).toBe(38_000);
    // k1b(9/15) 가 빠져도 k3(9/30) 이 남아 안전 시점은 그대로
    expect(before.timing.safeAfter.value).toBe('2026-09-30');
    expect(after.timing.safeAfter.value).toBe('2026-09-30');
  });

  it('급여통장 시연 장면: 카드 실적 기준 30만 → 90만이면 합계 558,000 → 318,000, 안전 시점 9/30 → 9/15', () => {
    const before = derive(scenario, SALARY);
    const after = derive(applyEdits(BASE, { c2: { threshold: 900_000 } }), SALARY);
    expect(before.total.value).toBe(558_000);
    expect(after.total.value).toBe(318_000);
    expect(after.affectedCount).toBe(4);
    expect(before.timing.safeAfter.value).toBe('2026-09-30');
    expect(after.timing.safeAfter.value).toBe('2026-09-15');
    expect(after.inactive.map((i) => i.condition.id)).toEqual(['c2']);
  });

  it('되돌리면 원래 값 (같은 조작 두 번 = 같은 숫자)', () => {
    const a = derive(applyEdits(BASE, { c2: { threshold: 900_000 } }), SALARY);
    const b = derive(applyEdits(BASE, { c2: { threshold: 900_000 } }), SALARY);
    expect(a.total.value).toBe(b.total.value);
    expect(derive(applyEdits(BASE, {}), SALARY).total.value).toBe(558_000);
  });
});

describe('포맷', () => {
  it('formatRateDelta', () => {
    expect(formatRateDelta(-0.003)).toBe('−0.3%p');
    expect(formatRateDelta(0.0025)).toBe('+0.25%p');
  });
  it('formatWonCompact', () => {
    expect(formatWonCompact(150_000_000)).toBe('1.5억');
    expect(formatWonCompact(20_000_000)).toBe('2,000만원');
    expect(formatWonCompact(5_000)).toBe('5,000원');
  });
  it('formatWonShort', () => {
    expect(formatWonShort(125_400_000)).toBe('1억 2,540만원');
    expect(formatWonShort(194_000)).toBe('19.4만원');
    expect(formatWonShort(-164_000)).toBe('−16.4만원');
    expect(formatWonShort(0)).toBe('0원');
  });
});

describe('중도해지 이자 — expected.earlyTermination 재현', () => {
  const e = EXPECTED.earlyTermination.dep_nuri_term;
  const term = product('dep_nuri_term');
  const et = earlyTermination(term, scenario.meta.today)!;

  it(`예치 ${e.elapsedDays}일 / 약정 ${e.fullDays}일`, () => {
    expect(et).not.toBeNull();
    expect(et.fullDays).toBe(e.fullDays);
    expect(et.elapsedDays).toBe(e.elapsedDays);
  });

  it(`약정이자 ${e.fullInterest.toLocaleString()} · 중도해지이자 ${e.earlyInterest.toLocaleString()} · 손실 ${e.loss.toLocaleString()}`, () => {
    expect(et.fullInterest.value).toBe(e.fullInterest);
    expect(et.earlyInterest.value).toBe(e.earlyInterest);
    expect(et.loss.value).toBe(e.loss);
    expect(et.loss.value).toBe(et.fullInterest.value - et.earlyInterest.value);
  });

  it('원금·이율은 보유 상품 정보, 이자와 손실은 계산 결과로 태그된다', () => {
    expect(et.principal.source).toBe('holding');
    expect(et.appliedRate.source).toBe('holding');
    expect(et.earlyRate.source).toBe('holding');
    expect(et.fullInterest.source).toBe('calc');
    expect(et.loss.source).toBe('calc');
  });

  it('일할 단리 — 원금 × 이율 × 일수 / 365', () => {
    expect(interestFor(20_000_000, 0.034, 365)).toBe(680_000);
    expect(interestFor(20_000_000, 0.008, 172)).toBe(Math.round((20_000_000 * 0.008 * 172) / 365));
  });

  it('연 단위 합계에는 더하지 않는다 — 따로 들고 다닌다', () => {
    const d = derive(scenario, DEPOSIT);
    expect(d.earlyTermination!.loss.value).toBe(e.loss);
    expect(d.total.value).toBe(EXPECTED.triggers[DEPOSIT].annualLossTotal);
    expect(d.netAnnual.value).toBe(EXPECTED.triggers[DEPOSIT].netAnnual);
  });

  it('정기예금이 아니거나 근거가 없으면 null', () => {
    expect(earlyTermination(product('card_nuri_tok'), scenario.meta.today)).toBeNull();
    expect(earlyTermination(product('acct_nuri_salary'), scenario.meta.today)).toBeNull();
    const noRate = { ...term, facts: { ...term.facts, earlyTerminationRate: undefined } };
    expect(earlyTermination(noRate, scenario.meta.today)).toBeNull();
  });

  it('만기 당일부터는 중도해지가 아니다', () => {
    expect(earlyTermination(term, '2027-03-20')).toBeNull();
    expect(earlyTermination(term, '2027-03-19')).not.toBeNull();
  });

  it('카드 해지 시나리오에는 중도해지 손실이 없다', () => {
    expect(derive(scenario, CARD).earlyTermination).toBeNull();
  });
});

describe('우대 상한 — 명목 우대폭과 실제 바뀌는 금리', () => {
  const loan = product('loan_nuri_worker'); // 잔액 3,800만 · 상한 1.0%p · 고정 우대 0.3%p
  const noCap = { ...loan, facts: { ...loan.facts, preferentialCap: undefined } };

  it('상한 위(명목 1.3%p)에서 0.4%p 가 빠지면 실제로는 0.1%p 만 오른다 → 조정 +60,000', () => {
    const adj = capAdjustment(loan, 0.01, 0.004, 0)!;
    expect(adj.actualDelta).toBeCloseTo(0.001, 10);
    expect(adj.amount.value).toBe(114_000);
    expect(adj.cap.source).toBe('holding');
  });
  it('상한 아래로 충분히 내려가면 명목 그대로 — 급여 0.6%p 는 실제 0.3%p', () => {
    expect(capAdjustment(loan, 0.01, 0.006, 0)!.amount.value).toBe(114_000);
    expect(capAdjustment(loan, 0.0, 0.0, 0)).toBeNull();
  });
  it('상한에 딱 맞는 대출에 우대가 더해져도 금리는 그대로 — 얻는 쪽을 깎는다(음수 조정)', () => {
    // 명목 0.7 + 고정 0.3 = 1.0%p(상한) 에서 0.1%p 를 더 얻는다
    const adj = capAdjustment(loan, 0.007, 0, 0.001)!;
    expect(adj.actualDelta).toBeCloseTo(0, 10);
    expect(adj.amount.value).toBe(-38_000);
  });
  it('상한이 없으면 조정 없음', () => {
    expect(capAdjustment(noCap, 0.01, 0.004, 0)).toBeNull();
  });
  it('카드 해지: 신용대출 행은 명목 80,000 으로 두고 합계는 상한 조정 60,000 을 뺀 값', () => {
    const d = derive(scenario, CARD);
    expect(d.items.find((i) => i.condition.id === 'w1')!.effectiveLoss.value).toBe(152_000);
    expect(d.capAdjustments.map((c) => [c.productId, c.amount.value])).toEqual([['loan_nuri_worker', 114_000]]);
    expect(d.total.value).toBe(d.items.reduce((a, i) => a + i.effectiveLoss.value, 0) - 114_000);
  });
});
