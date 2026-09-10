import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/scenario.json';
import { derive } from './derive';
import { applyEdits } from './edits';
import { annualLossOf, formatRateDelta, formatWonShort, lossBreakdown } from './money';
import type { MappedCondition, Scenario } from './types';

const base = fixture as unknown as Scenario;
const scenario = applyEdits(base, {});
const expected = (fixture as unknown as {
  expected: { annualLossByProduct: Record<string, number>; annualLossTotal: number };
}).expected;

const cond = (id: string) => scenario.conditions.find((c) => c.id === id) as MappedCondition;
const product = (id: string) => scenario.products.find((p) => p.id === id)!;

describe('expected.annualLossByProduct 재현', () => {
  const d = derive(scenario);
  for (const [productId, loss] of Object.entries(expected.annualLossByProduct)) {
    it(`${productId} → ${loss.toLocaleString()}`, () => {
      const item = d.items.find((i) => i.product.id === productId)!;
      expect(item.loss.annualLoss.value).toBe(loss);
      expect(item.effectiveLoss.value).toBe(loss);
      expect(item.loss.annualLoss.source).toBe('calc');
    });
  }
  it(`합계 → ${expected.annualLossTotal.toLocaleString()}`, () => {
    expect(d.total.value).toBe(expected.annualLossTotal);
    expect(d.total.source).toBe('calc');
    expect(d.affectedCount).toBe(Object.keys(expected.annualLossByProduct).length);
  });
  it('금액 큰 순으로 정렬된다', () => {
    const values = d.items.map((i) => i.effectiveLoss.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });
});

describe('계산 규칙', () => {
  it('rate_delta = 원금 × |금리차|, 부호 무관', () => {
    expect(annualLossOf(cond('c1'), product('loan_hana_mortgage'))).toBe(150_000_000 * 0.003);
    expect(annualLossOf(cond('c4'), product('dep_hana_term'))).toBe(20_000_000 * 0.0025);
  });
  it('monthly_benefit = 월 금액 × 12', () => {
    expect(annualLossOf(cond('c2'), product('card_hana_1q'))).toBe(20_000 * 12);
  });
  it('대출만 첫해 기준 라벨', () => {
    expect(lossBreakdown(cond('c1'), product('loan_hana_mortgage')).periodNote).toBe('첫해 기준');
    expect(lossBreakdown(cond('c4'), product('dep_hana_term')).periodNote).toBeNull();
  });
  it('원금 출처는 보유 상품 정보', () => {
    expect(lossBreakdown(cond('c1'), product('loan_hana_mortgage')).principal?.source).toBe('holding');
    expect(lossBreakdown(cond('c2'), product('card_hana_1q')).principal).toBeNull();
  });
  it('순수 함수: 두 번 계산해도 같은 값', () => {
    expect(derive(scenario).total.value).toBe(derive(scenario).total.value);
  });
});

describe('수정 → 재계산', () => {
  it('감면 폭을 0.5%p 로 올리면 주담대 손실이 750,000 이 되고 태그가 user 로 바뀐다', () => {
    const d = derive(applyEdits(base, { c1: { effectValue: -0.005 } }));
    const loan = d.items.find((i) => i.product.id === 'loan_hana_mortgage')!;
    expect(loan.loss.annualLoss.value).toBe(750_000);
    expect(loan.loss.effect.source).toBe('user');
    expect(d.total.value).toBe(expected.annualLossTotal - 450_000 + 750_000);
  });
  it('시연 장면: 카드 실적 기준 30만 → 60만이면 합계 800,000 → 560,000, 안전 시점 9/30 → 9/15', () => {
    const before = derive(scenario);
    const after = derive(applyEdits(base, { c2: { threshold: 600_000 } }));
    expect(before.total.value).toBe(800_000);
    expect(after.total.value).toBe(560_000);
    expect(after.affectedCount).toBe(3);
    expect(before.timing.safeAfter.value).toBe('2026-09-30');
    expect(after.timing.safeAfter.value).toBe('2026-09-15');
    const card = after.items.find((i) => i.product.id === 'card_hana_1q')!;
    expect(card.effectiveLoss.value).toBe(0);
    expect(card.loss.annualLoss.value).toBe(240_000);
    expect(after.inactive.map((i) => i.condition.id)).toEqual(['c2']);
  });
  it('되돌리면 원래 값 (같은 조작 두 번 = 같은 숫자)', () => {
    const a = derive(applyEdits(base, { c2: { threshold: 600_000 } }));
    const b = derive(applyEdits(base, { c2: { threshold: 600_000 } }));
    expect(a.total.value).toBe(b.total.value);
    expect(derive(applyEdits(base, {})).total.value).toBe(800_000);
  });
});

describe('포맷', () => {
  it('formatRateDelta', () => {
    expect(formatRateDelta(-0.003)).toBe('−0.3%p');
    expect(formatRateDelta(0.0025)).toBe('+0.25%p');
  });
  it('formatWonShort', () => {
    expect(formatWonShort(150_000_000)).toBe('1.5억');
    expect(formatWonShort(20_000_000)).toBe('2,000만원');
    expect(formatWonShort(5_000)).toBe('5,000원');
  });
});
