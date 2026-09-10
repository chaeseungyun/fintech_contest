// 이자·혜택 손실 계산. 전부 연 단위. 순수 함수.

import type { Effect, MappedCondition, Product, Tagged } from './types';
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

export function formatWonShort(n: number): string {
  if (n >= 1e8) return `${trim(n / 1e8)}억`;
  if (n >= 1e4) return `${trim(n / 1e4).toLocaleString('ko-KR')}만원`;
  return `${n.toLocaleString('ko-KR')}원`;
}

const trim = (x: number) => Math.round(x * 100) / 100;

export function basisLabel(cond: MappedCondition, holder: Product): string {
  const { effect } = cond.binds;
  if (effect.kind === 'rate_delta') {
    const principal = principalOf(holder);
    const pct = formatRateDelta(effect.value).replace(/^[−+]/, '');
    const head = `우대금리 ${pct} 소멸`;
    if (!principal) return head;
    const noun = holder.type === 'loan' ? '잔액' : '원금';
    return `${head} · ${noun} ${formatWonShort(principal.value)}`;
  }
  return `월 ${effect.value.toLocaleString('ko-KR')}원 할인 중단`;
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
