import { describe, expect, it } from 'vitest';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, EXPECTED, SALARY, TRIGGER_IDS } from './fixture.test-helpers';
import { formatWonCompact, formatWonShort } from './format';
import { annualLossOf, formatRateDelta, lossBreakdown, savingAmountOf } from './money';
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
      const byProduct = Object.fromEntries(
        d.items.filter((i) => i.effectiveLoss.value > 0).map((i) => [i.product.id, i.effectiveLoss.value]),
      );
      expect(byProduct).toEqual(e.annualLossByProduct);
      expect(d.items.every((i) => i.loss.annualLoss.source === 'calc')).toBe(true);
    });

    it(`${triggerId}: 합계 ${e.annualLossTotal.toLocaleString()} · 절감 ${e.savingsTotal.toLocaleString()} · 순손익 ${e.netAnnual.toLocaleString()}`, () => {
      expect(d.total.value).toBe(e.annualLossTotal);
      expect(d.total.source).toBe('calc');
      expect(d.savingsTotal.value).toBe(e.savingsTotal);
      expect(d.netAnnual.value).toBe(e.netAnnual);
      expect(d.affectedCount).toBe(Object.keys(e.annualLossByProduct).length);
    });

    it(`${triggerId}: 금액 큰 순으로 정렬된다`, () => {
      const values = d.items.map((i) => i.effectiveLoss.value);
      expect(values).toEqual([...values].sort((a, b) => b - a));
    });
  }
});

describe('계산 규칙', () => {
  it('rate_delta = 원금 × |금리차|, 부호 무관', () => {
    expect(annualLossOf(cond('c1'), product('loan_nuri_mortgage'))).toBe(60_000_000 * 0.003);
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
  it('카드 실적 우대를 0.5%p 로 올리면 주담대 손실이 300,000 이 되고 태그가 user 로 바뀐다', () => {
    const d = derive(applyEdits(BASE, { k1: { effectValue: -0.005 } }), CARD);
    const loan = d.items.find((i) => i.product.id === 'loan_nuri_mortgage')!;
    expect(loan.loss.annualLoss.value).toBe(300_000);
    expect(loan.loss.effect.source).toBe('user');
    expect(d.total.value).toBe(EXPECTED.triggers[CARD].annualLossTotal - 120_000 + 300_000);
  });

  it('시연 장면: 카드 실적 기준 30만 → 90만이면 주담대 손실이 빠지고 안전 시점이 9/30 으로 남는다', () => {
    const before = derive(scenario, CARD);
    const after = derive(applyEdits(BASE, { k1: { threshold: 900_000 } }), CARD);
    expect(before.total.value).toBe(194_000);
    expect(after.total.value).toBe(194_000 - 120_000);
    expect(after.affectedCount).toBe(2);
    expect(after.inactive.map((i) => i.condition.id)).toEqual(['k1']);
    const loan = after.items.find((i) => i.product.id === 'loan_nuri_mortgage')!;
    expect(loan.effectiveLoss.value).toBe(0);
    expect(loan.loss.annualLoss.value).toBe(120_000);
    // k1(9/15) 이 빠져도 k3(9/30) 이 남아 안전 시점은 그대로
    expect(before.timing.safeAfter.value).toBe('2026-09-30');
    expect(after.timing.safeAfter.value).toBe('2026-09-30');
  });

  it('급여통장 시연 장면: 카드 실적 기준 30만 → 70만이면 합계 510,000 → 270,000, 안전 시점 9/30 → 9/15', () => {
    const before = derive(scenario, SALARY);
    const after = derive(applyEdits(BASE, { c2: { threshold: 700_000 } }), SALARY);
    expect(before.total.value).toBe(510_000);
    expect(after.total.value).toBe(270_000);
    expect(after.affectedCount).toBe(3);
    expect(before.timing.safeAfter.value).toBe('2026-09-30');
    expect(after.timing.safeAfter.value).toBe('2026-09-15');
    expect(after.inactive.map((i) => i.condition.id)).toEqual(['c2']);
  });

  it('되돌리면 원래 값 (같은 조작 두 번 = 같은 숫자)', () => {
    const a = derive(applyEdits(BASE, { c2: { threshold: 700_000 } }), SALARY);
    const b = derive(applyEdits(BASE, { c2: { threshold: 700_000 } }), SALARY);
    expect(a.total.value).toBe(b.total.value);
    expect(derive(applyEdits(BASE, {}), SALARY).total.value).toBe(510_000);
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
