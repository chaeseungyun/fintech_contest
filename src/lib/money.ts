// 이자·혜택 손실과 변경으로 생기는 절감 계산. 전부 연 단위. 순수 함수.

import { formatWonCompact } from './format';
import type { Effect, MappedCondition, Product, Saving, Tagged } from './types';
import { tag } from './types';

export interface LossBreakdown {
  conditionId: string;
  productId: string;
  /** 조건이 살아있다고 가정했을 때의 연간 손실 */
  annualLoss: Tagged<number>;
  /** rate_delta 계산의 원금. monthly_benefit 이면 null */
  principal: Tagged<number> | null;
  effect: Tagged<Effect>;
  /** "우대금리 0.3%p 소멸 · 잔액 1.5억" */
  basisLabel: string;
  /** 대출은 첫해 기준 */
  periodNote: string | null;
}

/** rate_delta 가 곱해질 원금. 대출은 잔액, 예금은 원금. */
export function principalOf(product: Product): Tagged<number> | null {
  if (product.type === 'loan' && product.facts.balance !== undefined) {
    return tag(product.facts.balance, 'holding');
  }
  if (product.type === 'term_deposit' && product.facts.principal !== undefined) {
    return tag(product.facts.principal, 'holding');
  }
  return null;
}

export function principalLabel(product: Product): string {
  return product.type === 'loan' ? '대출 잔액' : product.type === 'term_deposit' ? '예금 원금' : '원금';
}

/** 연간 손실. rate_delta: 원금 × |금리차|, monthly_benefit: 월 금액 × 12 */
export function annualLossOf(cond: MappedCondition, holder: Product): number {
  const { effect } = cond.binds;
  switch (effect.kind) {
    case 'rate_delta': {
      const principal = principalOf(holder);
      if (!principal) throw new Error(`${cond.id}: ${holder.id} 에 원금이 없어 rate_delta 를 계산할 수 없다`);
      return Math.round(principal.value * Math.abs(effect.value));
    }
    case 'monthly_benefit':
      return Math.round(effect.value * 12);
  }
}

export function formatRateDelta(value: number): string {
  const sign = value < 0 ? '−' : '+';
  const pct = Math.round(Math.abs(value) * 100 * 10000) / 10000;
  return `${sign}${pct}%p`;
}

export function basisLabel(cond: MappedCondition, holder: Product): string {
  const { effect } = cond.binds;
  if (effect.kind === 'rate_delta') {
    const principal = principalOf(holder);
    const pct = formatRateDelta(effect.value).replace(/^[−+]/, '');
    const head = `우대금리 ${pct} 소멸`;
    if (!principal) return head;
    const noun = holder.type === 'loan' ? '잔액' : '원금';
    return `${head} · ${noun} ${formatWonCompact(principal.value)}`;
  }
  return `월 ${effect.value.toLocaleString('ko-KR')}원 할인 중단`;
}

/** 혜택 관점 문구. 같은 조건을 "지금 받고 있는 것"으로 읽을 때 쓴다. */
export function benefitLabel(cond: MappedCondition, holder: Product): string {
  const { effect } = cond.binds;
  if (effect.kind === 'rate_delta') {
    const principal = principalOf(holder);
    const pct = formatRateDelta(effect.value).replace(/^[−+]/, '');
    const head = `우대금리 ${pct} 적용 중`;
    if (!principal) return head;
    const noun = holder.type === 'loan' ? '잔액' : '원금';
    return `${head} · ${noun} ${formatWonCompact(principal.value)}`;
  }
  return `월 ${effect.value.toLocaleString('ko-KR')}원 할인 중`;
}

export function lossBreakdown(cond: MappedCondition, holder: Product): LossBreakdown {
  return {
    conditionId: cond.id,
    productId: holder.id,
    annualLoss: tag(annualLossOf(cond, holder), 'calc'),
    principal: cond.binds.effect.kind === 'rate_delta' ? principalOf(holder) : null,
    effect: tag(cond.binds.effect, cond.provenance?.effect ?? 'doc'),
    basisLabel: basisLabel(cond, holder),
    periodNote: holder.type === 'loan' ? '첫해 기준' : null,
  };
}

export function sumAnnual(losses: number[]): Tagged<number> {
  return tag(losses.reduce((a, b) => a + b, 0), 'calc');
}

// ── 절감 ──────────────────────────────────────────────────────────────
// 변경을 실행하면 안 내게 되는 비용. 금액은 대상 상품의 facts 에서 읽는다.

export interface SavingItem {
  kind: Saving['kind'];
  label: string;
  note: string;
  /** 연 단위 절감액 (양수) */
  annualAmount: Tagged<number>;
  /** "연 1회 30,000원", "월 68,000원 × 12" */
  basisLabel: string;
}

/** 절감 한 건의 연 단위 금액. facts 에 근거가 없으면 null. */
export function savingAmountOf(saving: Saving, product: Product): number | null {
  switch (saving.kind) {
    case 'annual_fee':
      return product.facts.annualFee ?? null;
    case 'monthly_premium':
      return product.facts.monthlyPremium === undefined ? null : product.facts.monthlyPremium * 12;
  }
}

function savingBasis(saving: Saving, product: Product): string {
  switch (saving.kind) {
    case 'annual_fee':
      return `연 1회 ${(product.facts.annualFee ?? 0).toLocaleString('ko-KR')}원`;
    case 'monthly_premium':
      return `월 ${(product.facts.monthlyPremium ?? 0).toLocaleString('ko-KR')}원 × 12개월`;
  }
}

/** 트리거의 savings 목록 → 화면이 그대로 그리는 배열. 근거 없는 항목은 빠진다. */
export function savingItems(savings: Saving[], product: Product): SavingItem[] {
  const items: SavingItem[] = [];
  for (const s of savings) {
    const amount = savingAmountOf(s, product);
    if (amount === null) continue;
    items.push({
      kind: s.kind,
      label: s.label,
      note: s.note,
      annualAmount: tag(amount, 'calc'),
      basisLabel: savingBasis(s, product),
    });
  }
  return items;
}
