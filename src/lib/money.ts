// 이자·혜택 손실과 변경으로 생기는 절감 계산. 전부 연 단위. 순수 함수.

import { compareISO, daysBetween } from './dates';
import { formatRate, formatWonCompact } from './format';
import type { Effect, ISODate, MappedCondition, Product, ProductFacts, Saving, Tagged } from './types';
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

/** spend_rate 의 월 결제액. target 상품의 facts.monthlyAmount */
function spendBase(cond: MappedCondition, target: Product | undefined): number {
  const amount = target?.facts.monthlyAmount;
  if (amount === undefined) throw new Error(`${cond.id}: target 에 monthlyAmount 가 없어 spend_rate 를 계산할 수 없다`);
  return amount;
}

/**
 * 연간 손실. rate_delta: 원금 × |금리차|, monthly_benefit: 월 금액 × 12,
 * spend_rate: target 의 월 결제액 × 적립률 × 12
 */
export function annualLossOf(cond: MappedCondition, holder: Product, target?: Product): number {
  const { effect } = cond.binds;
  switch (effect.kind) {
    case 'rate_delta': {
      const principal = principalOf(holder);
      if (!principal) throw new Error(`${cond.id}: ${holder.id} 에 원금이 없어 rate_delta 를 계산할 수 없다`);
      return Math.round(principal.value * Math.abs(effect.value));
    }
    case 'monthly_benefit':
      return Math.round(effect.value * 12);
    case 'spend_rate':
      return Math.round(spendBase(cond, target) * effect.value * 12);
  }
}

export function formatRateDelta(value: number): string {
  const sign = value < 0 ? '−' : '+';
  const pct = Math.round(Math.abs(value) * 100 * 10000) / 10000;
  return `${sign}${pct}%p`;
}

/** "우대금리 0.25%p" · "월 2,000원 할인" — 조건이 주는 혜택 한 덩어리. 부호 없음 */
export function perkLabel(cond: MappedCondition): string {
  const { effect } = cond.binds;
  switch (effect.kind) {
    case 'rate_delta':
      return `우대금리 ${formatRateDelta(effect.value).replace(/^[−+]/, '')}`;
    case 'monthly_benefit':
      return `월 ${effect.value.toLocaleString('ko-KR')}원 할인`;
    case 'spend_rate':
      return `적립 ${formatRate(effect.value)}`;
  }
}

export function basisLabel(cond: MappedCondition, holder: Product, target?: Product): string {
  const { effect } = cond.binds;
  if (effect.kind === 'spend_rate') {
    return `${perkLabel(cond)} 중단 · 월 ${spendBase(cond, target).toLocaleString('ko-KR')}원 결제분`;
  }
  if (effect.kind === 'rate_delta') {
    const principal = principalOf(holder);
    const head = `${perkLabel(cond)} 소멸`;
    if (!principal) return head;
    const noun = holder.type === 'loan' ? '잔액' : '원금';
    return `${head} · ${noun} ${formatWonCompact(principal.value)}`;
  }
  return `${perkLabel(cond)} 중단`;
}

/** 혜택 관점 문구. 같은 조건을 "지금 받고 있는 것"으로 읽을 때 쓴다. */
/** active=false 면 실적 미달로 지금 못 받는 우대 — "적용 중" 이라고 쓰지 않는다 */
export function benefitLabel(cond: MappedCondition, holder: Product, active = true): string {
  const { effect } = cond.binds;
  if (effect.kind === 'rate_delta') {
    const principal = principalOf(holder);
    const head = `${perkLabel(cond)} ${active ? '적용 중' : '미적용'}`;
    if (!principal) return head;
    const noun = holder.type === 'loan' ? '잔액' : '원금';
    return `${head} · ${noun} ${formatWonCompact(principal.value)}`;
  }
  return active ? `${perkLabel(cond)} 중` : `${perkLabel(cond)} 미적용`;
}

export function lossBreakdown(cond: MappedCondition, holder: Product, target?: Product): LossBreakdown {
  return {
    conditionId: cond.id,
    productId: holder.id,
    annualLoss: tag(annualLossOf(cond, holder, target), 'calc'),
    principal: cond.binds.effect.kind === 'rate_delta' ? principalOf(holder) : null,
    effect: tag(cond.binds.effect, cond.provenance?.effect ?? 'doc'),
    basisLabel: basisLabel(cond, holder, target),
    periodNote: holder.type === 'loan' ? '첫해 기준' : null,
  };
}

export function sumAnnual(losses: number[]): Tagged<number> {
  return tag(losses.reduce((a, b) => a + b, 0), 'calc');
}

// ── 절감 ──────────────────────────────────────────────────────────────
// 변경을 실행하면 안 내게 되는 비용. 금액은 대상 상품의 facts 에서 읽는다.

export interface SavingItem {
  /** 한 화면 안에서 겹치지 않는 키 */
  key: string;
  kind: Saving['kind'];
  label: string;
  note: string;
  /** 연 단위 절감액 (양수) */
  annualAmount: Tagged<number>;
  /** "연 1회 30,000원", "월 68,000원 × 12" */
  basisLabel: string;
  /**
   * annual  해마다 한 번 나가는 비용이 없어지는 것(연회비) — m개월 유지 비교에서 ceil(m/12) 번
   * monthly 달마다 쌓이는 것(보험료·이자 절감) — m개월이면 m/12 만큼
   */
  accrual: 'annual' | 'monthly';
}

/** facts 만 읽는다 — 보유 상품이든 갈아탈 후보든 같은 규칙으로 비용을 낸다 */
type HasFacts = { facts: ProductFacts };

/** 절감 한 건의 연 단위 금액. facts 에 근거가 없으면 null. */
export function savingAmountOf(saving: Saving, product: HasFacts): number | null {
  switch (saving.kind) {
    case 'annual_fee':
      return product.facts.annualFee ?? null;
    case 'monthly_premium':
      return product.facts.monthlyPremium === undefined ? null : product.facts.monthlyPremium * 12;
    case 'rate_gain':
    case 'reward_diff':
    case 'new_card_fee':
      // 조건·사용액에서 계산한다(gainItem · derive 의 나눠 쓰기). 상품 facts 만으로는 낼 수 없다
      return null;
  }
}

function savingBasis(saving: Saving, product: HasFacts): string {
  switch (saving.kind) {
    case 'annual_fee':
      return `연 1회 ${(product.facts.annualFee ?? 0).toLocaleString('ko-KR')}원`;
    case 'monthly_premium':
      return `월 ${(product.facts.monthlyPremium ?? 0).toLocaleString('ko-KR')}원 × 12개월`;
    case 'rate_gain':
    case 'reward_diff':
    case 'new_card_fee':
      return '';
  }
}

/** 트리거의 savings 목록 → 화면이 그대로 그리는 배열. 근거 없는 항목은 빠진다. */
export function savingItems(savings: Saving[], product: HasFacts): SavingItem[] {
  const items: SavingItem[] = [];
  for (const s of savings) {
    const amount = savingAmountOf(s, product);
    if (amount === null) continue;
    items.push({
      key: s.kind,
      kind: s.kind,
      label: s.label,
      note: s.note,
      annualAmount: tag(amount, 'calc'),
      basisLabel: savingBasis(s, product),
      // 보험료는 달마다 내는 돈이지만, 기존 규칙(연 단위로 한 번씩 더해진다)을 그대로 둔다 — 연회비와 같은 줄
      accrual: 'annual',
    });
  }
  return items;
}

/**
 * 변경 후 새로 충족되는 조건이 주는 절감. rate_delta 만 다룬다 — 원금 × |금리차|, 달마다 쌓인다.
 * 원금이 없으면 null. requirement 는 "대출 자동납부 출금 2건 이상" 같은 충족 가정 문구.
 */
export function gainItem(cond: MappedCondition, holder: Product, requirement: string): SavingItem | null {
  if (cond.binds.effect.kind !== 'rate_delta') return null;
  const principal = principalOf(holder);
  if (!principal) return null;
  const noun = holder.type === 'loan' ? '대출 이자 절감' : '이자 증가';
  const name = holder.shortName ?? holder.name;
  return {
    key: `gain-${cond.id}`,
    kind: 'rate_gain',
    label: noun,
    note: `${name} ${perkLabel(cond)} 추가`,
    annualAmount: tag(Math.round(principal.value * Math.abs(cond.binds.effect.value)), 'calc'),
    basisLabel: `잔액 ${formatWonCompact(principal.value)} · ${requirement} 충족 시`,
    accrual: 'monthly',
  };
}

// ── 중도해지 이자 ──────────────────────────────────────────────────────
// 정기예금을 만기 전에 깨면 약정이율 대신 중도해지이율이 예치기간에 적용된다.
// 이건 해지 시점에 한 번 확정되는 금액이라 연 단위 합계(netAnnual)에 더하지 않는다 —
// 상품마다 만기가 달라 더할 수 없다는 규칙이 여기에도 그대로 걸린다. 화면이 따로 그린다.

export interface EarlyTermination {
  productId: string;
  principal: Tagged<number>;
  appliedRate: Tagged<number>;
  earlyRate: Tagged<number>;
  /** 가입일 → 만기 (일) */
  fullDays: number;
  /** 가입일 → 오늘 (일) */
  elapsedDays: number;
  /** 만기까지 두면 받는 약정이자 */
  fullInterest: Tagged<number>;
  /** 오늘 깨면 받는 이자 */
  earlyInterest: Tagged<number>;
  /** 일회성 손실 = 약정이자 − 중도해지이자 */
  loss: Tagged<number>;
  /** "약정 3.4% → 중도해지 0.8% · 172일 예치 / 365일" */
  basisLabel: string;
}

const DAYS_IN_YEAR = 365;

/** 일할 단리. 만기이자·중도해지이자를 같은 식으로 낸다. */
export function interestFor(principal: number, rate: number, days: number): number {
  return Math.round((principal * rate * days) / DAYS_IN_YEAR);
}

/**
 * 오늘 중도해지할 때의 이자 손실. 근거가 하나라도 없으면 null —
 * 값을 지어내지 않는다. 만기가 지났으면 중도해지가 아니므로 null.
 */
export function earlyTermination(product: Product, today: ISODate): EarlyTermination | null {
  const f = product.facts;
  if (product.type !== 'term_deposit') return null;
  if (
    f.principal === undefined ||
    f.openedAt === undefined ||
    f.maturity === undefined ||
    f.appliedRate === undefined ||
    f.earlyTerminationRate === undefined
  ) {
    return null;
  }
  if (compareISO(today, f.maturity) >= 0) return null;

  const fullDays = daysBetween(f.openedAt, f.maturity);
  const elapsedDays = Math.max(0, daysBetween(f.openedAt, today));
  const fullInterest = interestFor(f.principal, f.appliedRate, fullDays);
  const earlyInterest = interestFor(f.principal, f.earlyTerminationRate, elapsedDays);

  return {
    productId: product.id,
    principal: tag(f.principal, 'holding'),
    appliedRate: tag(f.appliedRate, 'holding'),
    earlyRate: tag(f.earlyTerminationRate, 'holding'),
    fullDays,
    elapsedDays,
    fullInterest: tag(fullInterest, 'calc'),
    earlyInterest: tag(earlyInterest, 'calc'),
    loss: tag(fullInterest - earlyInterest, 'calc'),
    basisLabel: `약정 ${formatRate(f.appliedRate)} → 중도해지 ${formatRate(
      f.earlyTerminationRate,
    )} · ${elapsedDays}일 예치 / ${fullDays}일`,
  };
}

// ── 우대 상한 ──────────────────────────────────────────────────────────
// 대출에 우대 합계 상한(facts.preferentialCap)이 있으면, 조건마다 따로 곱한 명목 금액과
// 실제로 바뀌는 금리가 다르다. 명목 1.3%p 중 1.0%p만 적용 중인 대출에서 카드 우대 0.4%p 가 빠져도
// 실제 금리는 0.1%p 만 오른다. 항목 행은 명목 그대로 두고, 차이를 "상한 조정" 한 줄로 따로 낸다.

export interface CapAdjustment {
  productId: string;
  cap: Tagged<number>;
  /** 변경 전 명목 우대 합 (고정 우대 포함) */
  nominalBefore: number;
  /** 명목 변화 = 잃는 우대 − 얻는 우대 (양수면 금리가 오르는 쪽) */
  nominalDelta: number;
  /** 상한을 적용한 실제 변화 */
  actualDelta: number;
  /** (명목 − 실제) × 원금. 양수면 손실을 줄이고, 음수면 얻는 쪽을 깎는다 */
  amount: Tagged<number>;
}

/**
 * 상한 조정. 상한·원금이 없거나 명목과 실제가 같으면 null.
 *   실제 변화 = min(변경 전 합, 상한) − min(변경 전 합 − 잃는 우대 + 얻는 우대, 상한)
 */
export function capAdjustment(
  holder: Product,
  activeNominal: number,
  lost: number,
  gained: number,
): CapAdjustment | null {
  const cap = holder.facts.preferentialCap;
  const principal = principalOf(holder);
  if (cap === undefined || !principal) return null;
  const before = activeNominal + (holder.facts.fixedPreferential ?? 0);
  const after = before - lost + gained;
  const actualDelta = Math.min(before, cap) - Math.min(after, cap);
  const nominalDelta = lost - gained;
  const amount = Math.round((nominalDelta - actualDelta) * principal.value);
  if (amount === 0) return null;
  return {
    productId: holder.id,
    cap: tag(cap, 'holding'),
    nominalBefore: before,
    nominalDelta,
    actualDelta,
    amount: tag(amount, 'calc'),
  };
}
