// 갈아타기 추천. 독립 기능이 아니라 "이미 계산한 손실을 넘어서는 후보" 만 고른다.
// 전부 순수 함수. 후보 데이터는 scenario.candidates 에서만 온다.
//
// 계산 규칙
//   문턱(hurdle)      = max(0, −netAnnual). 지금 실행이 이미 이득이면 0
//   유지되는 연결      = 살아있는 조건 중 후보의 satisfies.kinds 에 metric.kind 가 있고 PERMANENT 가 아닌 것
//                       (PERMANENT 는 가입 시점에 확정된 조건이라 상품을 바꿔도 못 살린다)
//   갈아탄 뒤 순손익   = netAnnual + 유지되는 연결의 손실 합 + 후보 자체 혜택(연) − 후보 비용(연)
//   후보 비용          = 트리거의 savings[].kind 를 후보 facts 에 그대로 적용 (연회비 → 연회비, 보험료 → 보험료)
//   추천               = 갈아탄 뒤 순손익 > 0 이고 자격 미충족이 아닌 것. 순손익 큰 순으로 정렬
//
// satisfies 가 UNSUPPORTED 면 아무 연결도 유지되지 않는다고 보수적으로 계산하고 linkUnknown 을 켠다.

import { formatWonShort, withJosa } from './format';
import type { Judgment } from './interpreter';
import { principalOf, savingItems } from './money';
import type { Candidate, MappedCondition, Product, Tagged, Trigger } from './types';
import { tag } from './types';

/** derive 의 ImpactItem 이 그대로 들어온다. 순환 import 를 피하려고 필요한 필드만 적는다. */
export interface ChainLink {
  condition: MappedCondition;
  product: Product;
  judgment: Judgment;
  effectiveLoss: Tagged<number>;
}

export type EligibilityState = 'ok' | 'unknown' | 'unmet';

export interface CandidateResult {
  candidate: Candidate;
  /** 갈아타도 유지되는 연결 */
  preserved: ChainLink[];
  /** 끊기는 연결 (회복 불가 포함) */
  broken: ChainLink[];
  /** 유지되는 연결의 연간 손실 합 — 갈아타면 지켜지는 금액 */
  preservedLoss: Tagged<number>;
  /** 끊기는 연결의 연간 손실 합 — 갈아타도 그대로 잃는 금액 */
  brokenLoss: Tagged<number>;
  /** 후보 자체 혜택 연 합계 */
  ownBenefit: Tagged<number>;
  /** 후보의 연 비용 (연회비·보험료) */
  ownCost: Tagged<number>;
  /** 갈아탄 뒤 연 순손익. 양수면 지금보다 이득 */
  netAfter: Tagged<number>;
  clearsHurdle: boolean;
  /** satisfies 가 UNSUPPORTED — 연결 유지 여부를 확인해야 한다 */
  linkUnknown: boolean;
  eligibility: EligibilityState;
  recommended: boolean;
  /** "연결 2/3 유지 · 연회비 1.5만원" */
  basisLabel: string;
}

export interface RecommendationHeadline {
  title: string;
  body: string;
}

export interface Recommendation {
  /** 갈아타기가 손해가 아니려면 후보가 넘어야 할 연 금액 */
  hurdle: Tagged<number>;
  /** 갈아탄 뒤 순손익 큰 순 */
  results: CandidateResult[];
  /** 추천 중 첫 번째. 없으면 null */
  best: CandidateResult | null;
  /** 살아있는 연결 수. "n/m 유지" 의 m */
  linkCount: number;
  /** 살릴 수 있는 연결 수 (PERMANENT 제외) */
  preservableCount: number;
  /** 후보 비용의 이름: "연회비", "보험료". 트리거의 절감 항목에서 온다 */
  costLabel: string;
  /** 화면은 이 문장을 그대로 쓴다. 숫자는 전부 위 값에서 나온다 */
  headline: RecommendationHeadline;
}

export interface RecommendInput {
  trigger: Trigger;
  /** 변경 대상 상품. rate_delta 혜택의 원금과 실적 이전의 기준 */
  center: Product;
  /** derive 가 평가한 연쇄 항목 전부 (미적용 포함) */
  links: ChainLink[];
  /** 지금 실행 시 연 기준 순손익 (horizon.netAnnual) */
  netAnnual: number;
  candidates: Candidate[];
}

export function hurdleOf(netAnnual: number): number {
  return Math.max(0, -netAnnual);
}

/** 이 조건을 후보가 살릴 수 있는가. 살아있고, PERMANENT 가 아니고, 후보가 그 실적을 유지시켜야 한다 */
export function isPreserved(link: ChainLink, candidate: Candidate): boolean {
  if (!link.judgment.active) return false;
  if (link.condition.expr.op === 'PERMANENT') return false;
  if (candidate.satisfies.status !== 'MAPPED') return false;
  return candidate.satisfies.kinds.includes(link.condition.metric.kind);
}

/** 후보 자체 혜택의 연 합계. rate_delta 는 변경 대상 상품의 원금이 그대로 옮겨간다고 본다 */
export function ownBenefitOf(candidate: Candidate, center: Product): number {
  let sum = 0;
  for (const b of candidate.ownBenefits) {
    switch (b.effect.kind) {
      case 'monthly_benefit':
        sum += b.effect.value * 12;
        break;
      case 'rate_delta': {
        const principal = principalOf(center);
        if (principal) sum += principal.value * Math.abs(b.effect.value);
        break;
      }
    }
  }
  return Math.round(sum);
}

/** 후보의 연 비용. 트리거가 절감으로 세는 항목을 후보 facts 에 같은 규칙으로 적용한다 */
export function ownCostOf(candidate: Candidate, trigger: Trigger): number {
  return savingItems(trigger.savings, candidate).reduce((a, s) => a + s.annualAmount.value, 0);
}

export function eligibilityOf(candidate: Candidate): EligibilityState {
  const e = candidate.eligibility;
  if (!e || e.status !== 'MAPPED' || e.met === undefined) return 'unknown';
  return e.met ? 'ok' : 'unmet';
}

function costNoun(trigger: Trigger): string {
  return trigger.savings[0]?.label ?? '비용';
}

function basisLabelOf(r: Omit<CandidateResult, 'basisLabel'>, linkCount: number, trigger: Trigger): string {
  const parts: string[] = [];
  if (linkCount > 0) {
    parts.push(r.linkUnknown ? '연결 유지 확인 필요' : `연결 ${r.preserved.length}/${linkCount} 유지`);
  }
  if (trigger.savings.length > 0) {
    parts.push(
      r.ownCost.value === 0
        ? `${costNoun(trigger)} 없음`
        : `${costNoun(trigger)} ${formatWonShort(r.ownCost.value)}`,
    );
  }
  if (r.ownBenefit.value > 0) parts.push(`자체 혜택 연 ${formatWonShort(r.ownBenefit.value)}`);
  return parts.join(' · ');
}

export function evaluateCandidate(
  candidate: Candidate,
  input: RecommendInput,
  linkCount: number,
): CandidateResult {
  const { trigger, center, links, netAnnual } = input;
  const alive = links.filter((l) => l.judgment.active);
  const preserved = alive.filter((l) => isPreserved(l, candidate));
  const broken = alive.filter((l) => !isPreserved(l, candidate));
  const preservedLoss = preserved.reduce((a, l) => a + l.effectiveLoss.value, 0);
  const brokenLoss = broken.reduce((a, l) => a + l.effectiveLoss.value, 0);
  const ownBenefit = ownBenefitOf(candidate, center);
  const ownCost = ownCostOf(candidate, trigger);
  const netAfter = Math.round(netAnnual + preservedLoss + ownBenefit - ownCost);
  const eligibility = eligibilityOf(candidate);
  const clearsHurdle = netAfter > 0;

  const partial = {
    candidate,
    preserved,
    broken,
    preservedLoss: tag(preservedLoss, 'calc'),
    brokenLoss: tag(brokenLoss, 'calc'),
    ownBenefit: tag(ownBenefit, 'calc'),
    ownCost: tag(ownCost, 'calc'),
    netAfter: tag(netAfter, 'calc'),
    clearsHurdle,
    linkUnknown: candidate.satisfies.status !== 'MAPPED',
    eligibility,
    recommended: clearsHurdle && eligibility !== 'unmet',
  };
  return { ...partial, basisLabel: basisLabelOf(partial, linkCount, trigger) };
}

const shortName = (c: Candidate) => c.shortName ?? c.name;

function buildHeadline(ctx: {
  trigger: Trigger;
  hurdle: number;
  results: CandidateResult[];
  best: CandidateResult | null;
  linkCount: number;
}): RecommendationHeadline {
  const { trigger, hurdle, results, best, linkCount } = ctx;

  if (best === null) {
    return {
      title: '지금은 갈아탈 만한 상품이 없습니다',
      body:
        results.length > 0
          ? `후보 ${results.length}개 모두 연 ${formatWonShort(hurdle)}의 손실을 넘지 못합니다.`
          : '등록된 후보 상품이 없습니다.',
    };
  }

  const name = shortName(best.candidate);
  const gain = formatWonShort(best.netAfter.value);
  if (hurdle > 0) {
    const links =
      linkCount > 0 && !best.linkUnknown ? ` 연결 ${best.preserved.length}/${linkCount}이 유지돼` : '';
    return {
      title: '그래도 갈아탄다면',
      body: `연 ${formatWonShort(hurdle)} 이상 이득인 상품만 추천합니다. ${withJosa(name, '으로/로')} 옮기면${links} 연 ${gain} 이득입니다.`,
    };
  }
  return {
    title: `${trigger.verb} 후 대체한다면`,
    body: `${name}에 가입해도 연 ${gain} 이득이 유지됩니다.`,
  };
}

export function recommend(input: RecommendInput): Recommendation {
  const { trigger, links, netAnnual, candidates } = input;
  const alive = links.filter((l) => l.judgment.active);
  const linkCount = alive.length;
  const preservableCount = alive.filter((l) => l.condition.expr.op !== 'PERMANENT').length;
  const hurdle = hurdleOf(netAnnual);

  const results = candidates.map((c) => evaluateCandidate(c, input, linkCount));
  results.sort((a, b) => b.netAfter.value - a.netAfter.value);
  const best = results.find((r) => r.recommended) ?? null;

  return {
    hurdle: tag(hurdle, 'calc'),
    results,
    best,
    linkCount,
    preservableCount,
    costLabel: costNoun(trigger),
    headline: buildHeadline({ trigger, hurdle, results, best, linkCount }),
  };
}
