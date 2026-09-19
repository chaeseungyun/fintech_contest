// 연계 가입 제안. 갈아타기(recommend.ts)와 목적이 다르다 —
// 보유 상품을 그대로 두고 "더하면" 이득인 상품을 찾는다. 트리거와 무관하게 보유 조건 전체를 본다.
// 상시 분석의 결과물이라 특정 변경을 전제하지 않는다.
//
// 계산 규칙
//   되살아나는 조건 = 지금 실적 미달로 미적용 중인 MAPPED 조건 중, 후보가 그 실적을 대신 채워 주는 것
//   되살아나는 혜택 = 그 조건들의 연간 혜택 합
//   후보 자체 혜택  = ownBenefits (monthly_benefit × 12, rate_delta 는 후보 자신의 원금 기준)
//   후보 비용       = 연회비 + 월 보험료 × 12
//   연 순이득       = 되살아나는 혜택 + 자체 혜택 − 비용
//   제안            = 순이득 > 0 이고 가입 자격 미충족이 아닌 것. 순이득 큰 순으로 정렬
//
// satisfies 가 UNSUPPORTED 면 아무 조건도 되살리지 못한다고 보수적으로 본다 — recommend.ts 와 같은 태도다.

import { formatWonShort } from './format';
import { productById } from './graph';
import { isMetricMet } from './interpreter';
import { annualLossOf } from './money';
import { eligibilityOf, type EligibilityState } from './recommend';
import type { Candidate, MappedCondition, Product, ProductType, Scenario, Tagged } from './types';
import { addonCandidates, isMapped, tag } from './types';

/** 후보가 채워 주면 다시 적용되는 조건 하나 */
export interface UnlockedLink {
  condition: MappedCondition;
  /** 혜택을 받는 상품 */
  product: Product;
  annualBenefit: Tagged<number>;
}

export interface AddonResult {
  candidate: Candidate;
  unlocked: UnlockedLink[];
  /** 되살아나는 혜택의 연 합계 */
  unlockedGain: Tagged<number>;
  /** 후보 자체 혜택의 연 합계 */
  ownBenefit: Tagged<number>;
  /** 후보의 연 비용 (연회비·보험료) */
  ownCost: Tagged<number>;
  /** 더했을 때의 연 순이득. 양수면 가입이 이득 */
  netGain: Tagged<number>;
  eligibility: EligibilityState;
  recommended: boolean;
  /** "자체 혜택 연 9.6만원 · 연회비 1.2만원" */
  basisLabel: string;
}

export interface AddonProposal {
  results: AddonResult[];
  /** 제안 중 첫 번째. 없으면 null */
  best: AddonResult | null;
  /** 지금 실적 미달로 꺼져 있는 조건 수. 0 이면 되살릴 게 없다는 뜻 */
  inactiveCount: number;
}

/** 후보 자신의 facts 로 낸 연 비용. 트리거가 없으므로 비용 항목을 고정 규칙으로 읽는다. */
export function addonCostOf(candidate: Candidate): number {
  const f = candidate.facts;
  return (f.annualFee ?? 0) + (f.monthlyPremium ?? 0) * 12;
}

/** 후보 자체 혜택의 연 합계. rate_delta 는 후보 자신의 원금에 곱한다 — 남의 원금을 빌려 오지 않는다. */
export function addonOwnBenefitOf(candidate: Candidate): number {
  let sum = 0;
  for (const b of candidate.ownBenefits) {
    switch (b.effect.kind) {
      case 'monthly_benefit':
        sum += b.effect.value * 12;
        break;
      case 'rate_delta': {
        const principal = candidate.facts.principal ?? candidate.facts.balance ?? 0;
        sum += principal * Math.abs(b.effect.value);
        break;
      }
    }
  }
  return Math.round(sum);
}

/** 지금 실적 미달로 꺼져 있는 조건 전부. 이게 연계 가입이 되살릴 수 있는 후보군이다. */
export function inactiveConditions(scenario: Scenario): MappedCondition[] {
  return scenario.conditions.filter(isMapped).filter((c) => !isMetricMet(c));
}

export function evaluateAddon(candidate: Candidate, scenario: Scenario): AddonResult {
  const canSatisfy = candidate.satisfies.status === 'MAPPED';
  const unlocked: UnlockedLink[] = canSatisfy
    ? inactiveConditions(scenario)
        .filter((c) => candidate.satisfies.kinds.includes(c.metric.kind))
        .map((condition) => {
          const product = productById(scenario, condition.binds.holder);
          return { condition, product, annualBenefit: tag(annualLossOf(condition, product), 'calc') };
        })
    : [];

  const unlockedGain = unlocked.reduce((a, u) => a + u.annualBenefit.value, 0);
  const ownBenefit = addonOwnBenefitOf(candidate);
  const ownCost = addonCostOf(candidate);
  const netGain = Math.round(unlockedGain + ownBenefit - ownCost);
  const eligibility = eligibilityOf(candidate);

  return {
    candidate,
    unlocked,
    unlockedGain: tag(unlockedGain, 'calc'),
    ownBenefit: tag(ownBenefit, 'calc'),
    ownCost: tag(ownCost, 'calc'),
    netGain: tag(netGain, 'calc'),
    eligibility,
    recommended: netGain > 0 && eligibility !== 'unmet',
    basisLabel: addonBasisLabel(unlocked.length, ownBenefit, ownCost),
  };
}

function addonBasisLabel(unlockedCount: number, ownBenefit: number, ownCost: number): string {
  const parts: string[] = [];
  if (unlockedCount > 0) parts.push(`미적용 ${unlockedCount}건 되살림`);
  if (ownBenefit > 0) parts.push(`자체 혜택 연 ${formatWonShort(ownBenefit)}`);
  parts.push(ownCost === 0 ? '유지 비용 없음' : `연 비용 ${formatWonShort(ownCost)}`);
  return parts.join(' · ');
}

/**
 * 연계 가입 제안 전체.
 * excludeType 이 있으면 그 종류의 후보는 뺀다 — 지금 그 상품을 바꿀지 보고 있는데
 * 같은 종류를 하나 더 만들라고 권하면 화면이 서로 어긋난다.
 */
export function addonProposals(
  scenario: Scenario,
  opts: { excludeType?: ProductType } = {},
): AddonProposal {
  const results = addonCandidates(scenario)
    .filter((c) => opts.excludeType === undefined || c.type !== opts.excludeType)
    .map((c) => evaluateAddon(c, scenario));
  results.sort((a, b) => b.netGain.value - a.netGain.value);

  return {
    results,
    best: results.find((r) => r.recommended) ?? null,
    inactiveCount: inactiveConditions(scenario).length,
  };
}
