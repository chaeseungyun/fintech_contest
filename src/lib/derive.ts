// 화면들이 공유하는 파생 값. 시나리오 하나 + 트리거 하나에서 전부 계산한다.
// 화면은 이 결과만 읽는다. 값을 복사해 갖지 않는다.

import { buildActionPlan, type ActionPlan, type PlanDue, type PlanLink } from './actionplan';
import { addonProposals, type AddonProposal } from './addon';
import { addOffset, daysBetween, maxISO } from './dates';
import { formatKoMD, formatKoYMD, formatRate, formatWonShort, withJosa } from './format';
import { buildGraph, incomingConditions, productById, unsupportedForDocs, type Graph } from './graph';
import { horizonProjection, type Horizon } from './horizon';
import {
  computeSafeTiming,
  evaluateCondition,
  isMetricMet,
  latestRecoverAt,
  requirementLabel,
  type Judgment,
  type SafeTiming,
} from './interpreter';
import {
  capAdjustment,
  earlyTermination,
  gainItem,
  type CapAdjustment,
  lossBreakdown,
  perkLabel,
  savingItems,
  sumAnnual,
  type EarlyTermination,
  type LossBreakdown,
  type SavingItem,
} from './money';
import { recommend, type CandidateResult, type Recommendation } from './recommend';
import type { Condition, ISODate, MappedCondition, Product, Scenario, Source, Tagged, Trigger } from './types';
import { candidatesFor, defaultTrigger, isMapped, tag, triggerById } from './types';

export interface ImpactItem {
  condition: MappedCondition;
  product: Product;
  loss: LossBreakdown;
  judgment: Judgment;
  /** 실제 손실. 조건이 이미 미적용이면 0 */
  effectiveLoss: Tagged<number>;
  /**
   * 카드 이용금액이 옮겨 가서 다시 판정한 조건(trigger.spendShift). 변경 대상을 target 으로 갖지 않지만
   * 같은 카드 실적에 기대는 조건이다. kept 면 옮긴 뒤에도 기준 이상이라 손실 0.
   */
  shift?: { before: number; after: number; kept: boolean };
}

export interface AxisPoint {
  date: ISODate;
  /** 0–100, 축 위 위치 */
  pct: number;
  kind: 'today' | 'judgment' | 'safe' | 'inactive';
  conditionId?: string;
}

export interface Axis {
  start: ISODate;
  end: ISODate;
  points: AxisPoint[];
  /** 안전 구간 시작 위치 (0–100) */
  safeFromPct: number;
}

/**
 * keep    확인된 조건에서는 유지가 유리
 * switch  확인된 조건에서는 지금 바꿔도 금액상 손해 없음
 * pending 핵심 입력이 빠져 전체 유불리를 판정하지 않음 — 확인된 항목의 소계만 낸다
 */
export type VerdictKind = 'keep' | 'switch' | 'pending';

export interface Verdict {
  kind: VerdictKind;
  /** 화면은 highlight 부분만 색을 바꿔 그린다. 문장을 화면에 쓰지 않는다. */
  lead: string;
  highlight: string;
  tail: string;
  body: string;
}

/**
 * 금액 옆에 항상 붙는 비교 기준. "무엇을 무엇과, 어떤 기간으로, 언제 기준으로, 무슨 가정으로"
 * 비교했는지 — 화면이 문장을 지어내지 않고 이 값을 그대로 그린다.
 */
export interface ComparisonBasis {
  /** "톡톡카드 해지" */
  change: string;
  /** "그대로 유지" */
  versus: string;
  /** "연 기준" */
  period: string;
  asOf: ISODate;
  /** "실적·금리 현행 유지" */
  assumption: string;
}

export interface ChecklistItem {
  key: string;
  text: string;
  source: Source;
}

export interface AnalysisStep {
  key: string;
  label: string;
  detail: string;
}

export interface Derived {
  today: ISODate;
  trigger: Trigger;
  center: Product;
  graph: Graph;
  /** 비교에 빠진 핵심 입력. 비어 있지 않으면 verdict.kind 가 pending */
  missing: string[];
  /** 나눠 쓰기 트리거일 때만. 화면의 배분 선택기가 이 값을 그린다 */
  split: SplitResult | null;
  basis: ComparisonBasis;
  /** 금액 큰 순 */
  items: ImpactItem[];
  /** 손실이 실제로 발생하는 건수 */
  affectedCount: number;
  /** 연간 손실 합계. 우대 상한 조정(capAdjustments)을 반영한 값 */
  total: Tagged<number>;
  /** 우대 상한 때문에 명목 금액과 실제가 다른 대출. ② 묶음에 "상한 조정" 한 줄로 그린다 */
  capAdjustments: CapAdjustment[];
  savings: SavingItem[];
  savingsTotal: Tagged<number>;
  /** 지금 실행 시 연 기준 순손익. 양수면 이득 */
  netAnnual: Tagged<number>;
  horizon: Horizon;
  verdict: Verdict;
  /** 손실을 넘어서는 갈아타기 후보. 후보가 없으면 results 가 빈 배열 */
  recommendation: Recommendation;
  /** 사용자가 절차의 기준으로 고른 후보. 고르지 않았으면 null (새 상품 없이) */
  chosen: CandidateResult | null;
  /** 보유 상품을 그대로 두고 더하면 이득인 후보. 변경 대상과 같은 종류는 뺀다 */
  addons: AddonProposal;
  /** 판단 이후 실제로 밟을 순서. 계산을 새로 하지 않고 위 값들을 엮는다 */
  actionPlan: ActionPlan;
  /** 변경 대상이 정기예금일 때의 일회성 중도해지 이자 손실. 연 단위 합계에 더하지 않는다 */
  earlyTermination: EarlyTermination | null;
  checklist: ChecklistItem[];
  /** 유지를 택할 때 지켜야 할 조건. 절차가 아니라 조건 목록이다 */
  maintain: ChecklistItem[];
  steps: AnalysisStep[];
  timing: SafeTiming;
  /** 회복 불가 조건의 회복 시점 중 가장 늦은 날 */
  recoverBy: ISODate | null;
  recoverable: ImpactItem[];
  unrecoverable: ImpactItem[];
  inactive: ImpactItem[];
  /** 살아있고 회복 가능하지만 판정일이 다음 달이라 안전 시점 계산에서 빠진 것 */
  deferredNextMonth: ImpactItem[];
  axis: Axis;
  unsupported: Condition[];
}

export interface DeriveOptions {
  /** 사용자가 절차의 기준으로 고른 후보 id. 없거나 null 이면 "새 상품 없이" */
  chosenCandidateId?: string | null;
  /** 나눠 쓰기(trigger.split): 얼마를 남기고 어느 카드로 옮길지. 없으면 "필요한 만큼만 남기기" · 카드 미선택 */
  split?: SplitChoice;
  /** 사용자가 직접 입력한 카드(타행 등). 나눠 쓰기의 옮겨 갈 카드 후보에 들어간다 */
  customCard?: CustomCard | null;
}

/** 남길 금액: 필요한 만큼(지금 충족 중인 카드 실적 기준 중 가장 큰 값) · 전부 옮김(0) · 직접 입력(원) */
export type KeepChoice = 'needed' | 'all' | number;

export interface SplitChoice {
  keep: KeepChoice;
  toCardId: string | null;
}

export interface CustomCard {
  name: string;
  /** 0.012 = 1.2% */
  rewardRate: number;
  annualFee: number;
}

export const CUSTOM_CARD_ID = 'custom_card';

/** 옮겨 갈 수 있는 카드 하나. 후보 상품은 상품설명서, 직접 입력은 사용자 확인 */
export interface SplitDestination {
  id: string;
  institution: string;
  name: string;
  rewardRate: Tagged<number>;
  annualFee: Tagged<number>;
}

export interface SplitResult {
  /** 지금 이 카드 월 사용액 */
  before: Tagged<number>;
  /** 조건을 지키려면 남겨야 하는 최소 금액. 걸린 실적 조건이 없으면 0 */
  needed: Tagged<number>;
  keep: KeepChoice;
  /** 실제로 남기는 금액 */
  kept: Tagged<number>;
  /** 옮기는 금액 */
  moved: Tagged<number>;
  destinations: SplitDestination[];
  /** 사용자가 고른 옮겨 갈 카드. 고르기 전에는 null — 앱이 대신 고르지 않는다 */
  dest: SplitDestination | null;
}

export function derive(scenario: Scenario, triggerId?: string, options: DeriveOptions = {}): Derived {
  const today = scenario.meta.today;
  const trigger = triggerId ? triggerById(scenario, triggerId) : defaultTrigger(scenario);
  const centerId = trigger.productId;
  const center = productById(scenario, centerId);
  const conditions = incomingConditions(scenario, centerId);
  const split = trigger.split ? buildSplit(scenario, center, options) : null;
  // 옮겨 갈 카드를 고르기 전에는 얻는 쪽을 모른다 — 반대편 숫자 없이 결론을 내지 않는다
  const missing = [...(trigger.missing ?? []), ...(split && !split.dest ? ['옮겨 갈 카드'] : [])];

  const gainIds = new Set(trigger.gains ?? []);
  // 나눠 쓰기는 카드를 해지하지 않는다 — 카드에 걸린 조건은 사용액으로만 다시 판정한다(shiftItems)
  const items: ImpactItem[] = (split ? [] : conditions)
    .filter((c) => !gainIds.has(c.id))
    .map((condition) => {
      const product = productById(scenario, condition.binds.holder);
      const loss = lossBreakdown(condition, product, center);
      const judgment = evaluateCondition(condition, today, scenario.products);
      return {
        condition,
        product,
        loss,
        judgment,
        effectiveLoss: tag(judgment.active ? loss.annualLoss.value : 0, 'calc'),
      };
    });
  if (split) items.push(...shiftItems(scenario, centerId, split.moved.value, today));
  else if (trigger.spendShift) {
    const amount = shiftAmount(scenario, trigger);
    if (amount !== null) items.push(...shiftItems(scenario, trigger.spendShift.cardId, amount, today));
  }
  items.sort((a, b) => b.effectiveLoss.value - a.effectiveLoss.value);

  const judgments = items.map((i) => i.judgment);
  const timing = computeSafeTiming(judgments, today);

  const active = items.filter((i) => i.judgment.active);
  const recoverable = active.filter((i) => i.judgment.recoverable);
  const unrecoverable = active.filter((i) => !i.judgment.recoverable);
  const inactive = items.filter((i) => !i.judgment.active);
  const deferredNextMonth = recoverable.filter((i) => !i.judgment.countsForSafeAfter);

  const savings = [
    ...savingItems(trigger.savings, center),
    ...gainItems(scenario, trigger),
    ...(split ? splitSavings(center, split) : []),
  ];
  const capAdjustments = buildCapAdjustments(scenario, trigger, items);
  // 양수 조정은 손실을 줄이고, 음수 조정은 얻는 우대가 상한에 막힌 몫이라 절감을 깎는다
  const lossAdj = capAdjustments.reduce((a, c) => a + Math.max(0, c.amount.value), 0);
  const gainAdj = capAdjustments.reduce((a, c) => a + Math.min(0, c.amount.value), 0);
  const total = sumAnnual([...items.map((i) => i.effectiveLoss.value), -lossAdj]);
  const savingsTotal = sumAnnual([...savings.map((s) => s.annualAmount.value), gainAdj]);
  const recoverBy = latestRecoverAt(unrecoverable.map((i) => i.judgment));

  const sumBy = (accrual: 'annual' | 'monthly') =>
    savings.filter((s) => s.accrual === accrual).reduce((a, s) => a + s.annualAmount.value, 0);
  const horizon = horizonProjection({
    today,
    annualLoss: total.value,
    savings: sumBy('annual'),
    // 얻는 우대(gains)는 달마다 쌓이는 절감이라 상한에 막힌 몫도 여기서 뺀다
    monthlySavings: sumBy('monthly') + gainAdj,
    recoverBy,
    verb: trigger.verb,
  });

  const unsupported = unsupportedForDocs(
    scenario,
    conditions.map((c) => c.sourceDoc),
  );

  // 문장에 이름을 올리는 건 실제로 잃는 연결뿐이다 — 옮긴 뒤에도 유지되는 카드 실적 조건은 빼고
  const losing = active.filter((i) => i.effectiveLoss.value > 0);
  const verdict = buildVerdict({ trigger, center, items: losing, horizon, savings, missing });

  const recommendation = recommend({
    trigger,
    center,
    links: cappedLinks(items, capAdjustments),
    netAnnual: horizon.netAnnual.value,
    candidates: candidatesFor(scenario, trigger.id),
  });
  const chosen =
    options.chosenCandidateId == null
      ? null
      : (recommendation.results.find((r) => r.candidate.id === options.chosenCandidateId) ?? null);

  const addons = addonProposals(scenario, { excludeType: center.type });
  const early = earlyTermination(center, today);

  const actionPlan = buildActionPlan({
    kind: verdict.kind,
    trigger,
    center,
    timing,
    chosen,
    unrecoverable: unrecoverable.map(toPlanLink),
    dueThisMonth: recoverable.filter((i) => i.judgment.countsForSafeAfter).map(toPlanDue),
    missing,
    earlyTermination: early,
  });

  return {
    today,
    trigger,
    center,
    graph: buildGraph(scenario, centerId),
    missing,
    split,
    basis: {
      change: split
        ? `${shortName(center)} 월 ${formatWonShort(split.moved.value)} → ${split.dest?.name ?? '다른 카드'}`
        : `${shortName(center)} ${trigger.verb}`,
      versus: '그대로 유지',
      period: '연 기준',
      asOf: today,
      assumption: '실적·금리 현행 유지',
    },
    items,
    affectedCount: items.filter((i) => i.effectiveLoss.value > 0).length,
    total,
    capAdjustments,
    savings,
    savingsTotal,
    netAnnual: horizon.netAnnual,
    horizon,
    verdict,
    recommendation,
    chosen,
    addons,
    actionPlan,
    earlyTermination: early,
    checklist: buildChecklist({
      trigger,
      center,
      timing,
      unrecoverable,
      recommendation,
      chosen,
    }),
    maintain: buildMaintain(active),
    steps: buildSteps({ conditions, unsupported, items, total, savingsTotal }),
    timing,
    recoverBy,
    recoverable,
    unrecoverable,
    inactive,
    deferredNextMonth,
    axis: buildAxis(today, items, timing),
    unsupported,
  };
}

const shortName = (p: Product) => p.shortName ?? p.name;

/** 옮겨 가는 카드 이용금액(월). spendShift 가 없으면 null */
export function shiftAmount(scenario: Scenario, trigger: Trigger): number | null {
  if (!trigger.spendShift) return null;
  return productById(scenario, trigger.spendShift.amountFrom).facts.monthlyAmount ?? null;
}

/** 이 카드 이용금액에 기대는 조건: 카드가 target 이거나(대출 카드 실적 우대) holder 인(카드 자체의 실적 혜택) card_spend */
function cardSpendConditions(scenario: Scenario, cardId: string): MappedCondition[] {
  return scenario.conditions
    .filter(isMapped)
    .filter((c) => (c.binds.target === cardId || c.binds.holder === cardId) && c.metric.kind === 'card_spend');
}

/**
 * 카드 이용금액이 amount 만큼 줄 때 그 카드의 card_spend 조건을 "옮긴 뒤 금액" 으로 다시 판정한다.
 * 지금 충족 중인데 옮긴 뒤 기준 아래로 내려가면 손실, 그대로 기준 이상이면 kept(손실 0).
 * 지금도 미충족인 조건은 이 변경과 무관하다 — 넣지 않는다.
 * 판정일은 원래 조건 그대로지만, 잃지 않는 조건은 이번 달 변경 가능 구간 계산에서 뺀다.
 */
function shiftItems(scenario: Scenario, cardId: string, amount: number, today: ISODate): ImpactItem[] {
  return cardSpendConditions(scenario, cardId)
    .filter((c) => c.metric.currentValue !== undefined && c.metric.threshold !== null && isMetricMet(c))
    .map((condition) => {
      const before = condition.metric.currentValue as number;
      const after = Math.max(0, before - amount);
      const kept = after >= (condition.metric.threshold as number);
      const product = productById(scenario, condition.binds.holder);
      const loss = lossBreakdown(condition, product);
      const base = evaluateCondition(condition, today, scenario.products);
      const judgment: Judgment = { ...base, countsForSafeAfter: base.countsForSafeAfter && !kept };
      return {
        condition,
        product,
        loss,
        judgment,
        effectiveLoss: tag(kept ? 0 : loss.annualLoss.value, 'calc'),
        shift: { before, after, kept },
      };
    });
}

/**
 * 우대 상한이 있는 대출마다 명목과 실제의 차이를 낸다.
 * 변경 전 명목 합 = 그 대출에 걸린 조건 중 지금 충족 중인 rate_delta 전부(이 변경과 무관한 것 포함).
 */
function buildCapAdjustments(scenario: Scenario, trigger: Trigger, items: ImpactItem[]): CapAdjustment[] {
  const rate = (c: MappedCondition) => (c.binds.effect.kind === 'rate_delta' ? Math.abs(c.binds.effect.value) : 0);
  const gainConds = (trigger.gains ?? [])
    .map((id) => scenario.conditions.find((c) => c.id === id))
    .filter((c): c is MappedCondition => !!c && isMapped(c) && !isMetricMet(c));
  const holderIds = new Set([
    ...items.filter((i) => i.effectiveLoss.value > 0).map((i) => i.product.id),
    ...gainConds.map((c) => c.binds.holder),
  ]);
  const out: CapAdjustment[] = [];
  for (const id of holderIds) {
    const holder = productById(scenario, id);
    const activeNominal = scenario.conditions
      .filter(isMapped)
      .filter((c) => c.binds.holder === id && isMetricMet(c))
      .reduce((a, c) => a + rate(c), 0);
    const lost = items
      .filter((i) => i.product.id === id && i.effectiveLoss.value > 0)
      .reduce((a, i) => a + rate(i.condition), 0);
    const gained = gainConds.filter((c) => c.binds.holder === id).reduce((a, c) => a + rate(c), 0);
    const adj = capAdjustment(holder, activeNominal, lost, gained);
    if (adj) out.push(adj);
  }
  return out;
}

/**
 * 갈아타기 후보가 "지켜 주는 손실" 을 셀 때 쓰는 항목. 상한이 걸린 대출의 행은 실제/명목 비율로 줄인다 —
 * 명목 8만원을 지켜 준다고 세면 후보 이득이 부풀려진다.
 * ponytail: 비율 배분이라 후보가 그 대출의 연결 일부만 살리면 근사값. 상한은 비선형이라 정확히는 후보별로 상한을 다시 계산해야 한다.
 */
function cappedLinks(items: ImpactItem[], caps: CapAdjustment[]): ImpactItem[] {
  return items.map((i) => {
    const cap = caps.find((c) => c.productId === i.product.id && c.amount.value > 0);
    if (!cap || i.effectiveLoss.value === 0 || cap.nominalDelta === 0) return i;
    const ratio = cap.actualDelta / cap.nominalDelta;
    return { ...i, effectiveLoss: tag(Math.round(i.effectiveLoss.value * ratio), 'calc') };
  });
}

/** 나눠 쓰기의 옮겨 갈 카드 목록: 후보 중 적립률이 적힌 카드 + 직접 입력한 카드 */
function splitDestinations(scenario: Scenario, custom: CustomCard | null | undefined): SplitDestination[] {
  const fromCandidates: SplitDestination[] = (scenario.candidates ?? [])
    .filter((c) => c.type === 'credit_card' && c.facts.rewardRate !== undefined)
    .map((c) => ({
      id: c.id,
      institution: c.institution,
      name: c.shortName ?? c.name,
      rewardRate: tag(c.facts.rewardRate as number, 'doc'),
      annualFee: tag(c.facts.annualFee ?? 0, 'doc'),
    }));
  if (!custom) return fromCandidates;
  return [
    ...fromCandidates,
    {
      id: CUSTOM_CARD_ID,
      institution: '직접 입력',
      name: custom.name,
      rewardRate: tag(custom.rewardRate, 'user'),
      annualFee: tag(custom.annualFee, 'user'),
    },
  ];
}

function buildSplit(scenario: Scenario, card: Product, options: DeriveOptions): SplitResult {
  const before = card.facts.monthlySpendCurrent ?? 0;
  const needed = Math.max(
    0,
    ...cardSpendConditions(scenario, card.id)
      .filter((c) => isMetricMet(c) && c.metric.threshold !== null)
      .map((c) => c.metric.threshold as number),
  );
  const keep = options.split?.keep ?? 'needed';
  const raw = keep === 'needed' ? needed : keep === 'all' ? 0 : keep;
  const kept = Math.min(before, Math.max(0, raw));
  const destinations = splitDestinations(scenario, options.customCard);
  const dest = destinations.find((d) => d.id === options.split?.toCardId) ?? null;
  return {
    before: tag(before, 'holding'),
    needed: tag(needed, 'calc'),
    keep,
    kept: tag(kept, 'calc'),
    moved: tag(before - kept, 'calc'),
    destinations,
    dest,
  };
}

/**
 * 나눠 쓰기의 얻는 쪽. 옮긴 금액 × (옮겨 갈 카드 적립률 − 지금 카드 적립률) × 12 는 달마다 쌓이고,
 * 옮겨 갈 카드 연회비는 해마다 한 번 나간다(음수 절감). 카드를 고르기 전이면 비어 있다.
 */
function splitSavings(card: Product, split: SplitResult): SavingItem[] {
  const { dest, moved } = split;
  if (!dest || moved.value === 0) return [];
  const own = card.facts.rewardRate ?? 0;
  const out: SavingItem[] = [
    {
      key: 'split-reward',
      kind: 'reward_diff',
      label: `${dest.name} 적립 차이`,
      note: `월 ${formatWonShort(moved.value)} 옮김`,
      annualAmount: tag(Math.round(moved.value * (dest.rewardRate.value - own) * 12), 'calc'),
      basisLabel: `적립 ${formatRate(own)} → ${formatRate(dest.rewardRate.value)}`,
      accrual: 'monthly',
    },
  ];
  if (dest.annualFee.value > 0) {
    out.push({
      key: 'split-fee',
      kind: 'new_card_fee',
      label: `${dest.name} 연회비`,
      note: '옮겨 갈 카드를 새로 만들 때',
      annualAmount: tag(-dest.annualFee.value, 'calc'),
      basisLabel: `연 1회 ${dest.annualFee.value.toLocaleString('ko-KR')}원`,
      accrual: 'annual',
    });
  }
  return out;
}

/** trigger.gains: 지금 미적용이고 바꾸면 켜지는 조건의 절감. 이미 받고 있는 조건은 얻는 게 없다 */
function gainItems(scenario: Scenario, trigger: Trigger): SavingItem[] {
  const out: SavingItem[] = [];
  for (const id of trigger.gains ?? []) {
    const cond = scenario.conditions.find((c) => c.id === id);
    if (!cond || !isMapped(cond) || isMetricMet(cond)) continue;
    const item = gainItem(cond, productById(scenario, cond.binds.holder), requirementLabel(cond));
    if (item) out.push(item);
  }
  return out;
}

/** ImpactItem → 실행 안내가 읽는 한 줄. actionplan 이 derive 를 import 하지 않게 여기서 만든다. */
function toPlanLink(item: ImpactItem): PlanLink {
  return {
    productName: shortName(item.product),
    perk: perkLabel(item.condition),
    recoverAt: item.judgment.recoverAt?.value ?? null,
  };
}

function toPlanDue(item: ImpactItem): PlanDue {
  return { productName: shortName(item.product), date: item.judgment.nextJudgmentDate.value as ISODate };
}

function productNames(items: ImpactItem[]): string {
  const seen: string[] = [];
  for (const i of items) {
    const name = shortName(i.product);
    if (!seen.includes(name)) seen.push(name);
  }
  return seen.join('·');
}

// ── 비교 결과 ──────────────────────────────────────────────────────────
// 헤드라인은 "확인된 조건에서는" 으로 한정한다. 계산에 넣은 조건 밖의 일(미래 금리·상품 존속)은
// 예측하지 않는다. 핵심 입력이 빠졌으면 결론 대신 보류를 적는다.

function buildVerdict(ctx: {
  trigger: Trigger;
  center: Product;
  items: ImpactItem[];
  horizon: Horizon;
  savings: SavingItem[];
  missing: string[];
}): Verdict {
  const { trigger, center, items, horizon, savings, missing } = ctx;
  const name = shortName(center);
  const net = horizon.netAnnual.value;

  if (missing.length > 0) {
    const known =
      items.length > 0 ? `연결된 ${productNames(items)}의 우대 혜택이 어떻게 달라지는지는 확인됐지만, ` : '';
    return {
      kind: 'pending',
      lead: '확인된 조건만으로는',
      highlight: '전체 손익을 비교할 수 없습니다.',
      tail: '',
      body: `${known}${withJosa(missing.join('·'), '이/가')} 없어 ${trigger.verb} 후 얻는 쪽을 계산하지 못했습니다. 그 값이 확인되면 같은 기간으로 비교합니다. 아래는 확인된 항목의 변화 소계입니다.`,
    };
  }

  if (net < 0) {
    return {
      kind: 'keep',
      lead: '확인된 조건에서는',
      // 나눠 쓰기는 카드를 없애는 게 아니라 "지금처럼 몰아 쓰기" 가 유지다
      highlight: trigger.split ? `${name}에 지금처럼 모아 쓰는 것이` : `${withJosa(name, '을/를')} 유지하는 것이`,
      tail: '유리합니다.',
      body:
        items.length > 0
          ? `연결된 ${productNames(items)}의 우대 혜택 손실이 더 커, 현재 ${withJosa(name, '을/를')} 유지하는 것이 유리합니다.`
          : `${trigger.verb} 후 줄어드는 비용보다 잃는 것이 커 유지하는 것이 유리합니다.`,
    };
  }

  // "연회비 절감" · "대출 이자 절감" — 라벨이 이미 "절감" 으로 끝나면 덧붙이지 않는다
  const savingLabel = savings.length > 0 ? savings.map((s) => s.label.replace(/ 절감$/, '')).join('·') : '비용';
  return {
    kind: 'switch',
    lead: '확인된 조건에서는',
    highlight: `${withJosa(name, '을/를')} 지금 ${trigger.verb}해도`,
    tail: '금액상 손해는 없습니다.',
    body:
      items.length > 0
        ? `${savingLabel} 절감이 연결된 ${productNames(items)}의 혜택 손실보다 커, 금액만 보면 지금 ${trigger.verb}해도 손해가 아닙니다.`
        : `${withJosa(name, '과/와')} 연결된 우대 조건이 없어 ${trigger.verb} 시 사라지는 혜택이 없습니다.`,
  };
}

/**
 * 비교 결과 화면의 "꼭 확인하세요". 같은 화면의 차트·합계와 겹치는 금액 비교는 넣지 않는다 —
 * 연결 상태·회복 불가·이번 달 판정 마감·갈아타기 순서처럼 판단을 뒤집을 수 있는 조건만 적는다.
 */
function buildChecklist(ctx: {
  trigger: Trigger;
  center: Product;
  timing: SafeTiming;
  unrecoverable: ImpactItem[];
  recommendation: Recommendation;
  chosen: CandidateResult | null;
}): ChecklistItem[] {
  const { trigger, center, timing, unrecoverable, recommendation, chosen } = ctx;
  const name = shortName(center);
  const list: ChecklistItem[] = [];

  for (const u of unrecoverable) {
    list.push({
      key: `perm-${u.condition.id}`,
      text: `${shortName(u.product)}의 ${perkLabel(u.condition)}는 ${withJosa(name, '을/를')} 보유한 조건으로 가입 때 확정된 것이라, ${trigger.verb}하면 만기(${formatKoYMD(u.judgment.recoverAt!.value)})까지 이 우대 없이 이어지고 ${withJosa(name, '을/를')} 다시 만들어도 되돌아오지 않습니다.`,
      source: u.judgment.recoverAt!.source,
    });
  }

  if (!timing.alreadySafe) {
    list.push({
      key: 'safe',
      text: `이번 달 우대 확인은 ${formatKoMD(timing.safeAfter.value)}에 끝나 이번 달 우대가 확정됩니다. 그 뒤에 실행하면 이번 달 혜택은 잃지 않습니다.`,
      source: timing.safeAfter.source,
    });
  }

  // 연결을 살리는 갈아타기는 순서가 핵심이다 — 새 상품을 먼저 만들고, 판정이 끝난 뒤 옮긴다.
  // 사용자가 고른 안이 있으면 그 안, 없으면 후보 중 하나를 "예" 로 든다 — 앱의 선택으로 적지 않는다.
  const pick = chosen ?? recommendation.best;
  if (pick && pick.preserved.length > 0) {
    const newName = pick.candidate.shortName ?? pick.candidate.name;
    const when = timing.alreadySafe ? '' : ` ${formatKoMD(timing.safeAfter.value)} 이후에`;
    const head = chosen ? `선택한 ${withJosa(newName, '을/를')}` : `예를 들어 ${withJosa(newName, '을/를')}`;
    list.push({
      key: 'switch-order',
      text: `${head} 먼저 만든 뒤${when} ${withJosa(name, '을/를')} ${trigger.verb}하면 연결 ${pick.preserved.length}건이 유지됩니다.`,
      source: pick.netAfter.source,
    });
  }

  if (trigger.caveat) list.push({ key: 'caveat', text: trigger.caveat, source: 'doc' });

  return list;
}

/**
 * 유지를 택할 때 지켜야 할 조건. 살아있는 조건의 실적 기준과 판정 주기를 그대로 옮긴다 —
 * "유지에는 절차가 없다" 는 원칙은 그대로다. 절차가 아니라 조건 목록이다.
 */
function buildMaintain(active: ImpactItem[]): ChecklistItem[] {
  // 결제 적립은 지킬 실적 조건이 아니라 결제하면 쌓이는 것이라 뺀다
  return active.filter((i) => i.condition.binds.effect.kind !== 'spend_rate').map((i) => ({
    key: `keep-${i.condition.id}`,
    text: `${shortName(i.product)} 우대 — ${requirementLabel(i.condition)} · ${i.judgment.cycleLabel.value}`,
    source: i.judgment.cycleLabel.source,
  }));
}

function buildSteps(ctx: {
  conditions: MappedCondition[];
  unsupported: Condition[];
  items: ImpactItem[];
  total: Tagged<number>;
  savingsTotal: Tagged<number>;
}): AnalysisStep[] {
  const { conditions, unsupported, items, total, savingsTotal } = ctx;
  const dated = items.filter((i) => i.judgment.nextJudgmentDate.value !== null).length;
  const perm = items.length - dated;
  return [
    {
      key: 'extract',
      label: '약관에서 추출해 둔 조건 불러오기',
      detail: `샘플 문장 ${conditions.length + unsupported.length}개 중 ${conditions.length}건 매핑 · 실시간 추출 없음`,
    },
    {
      key: 'link',
      label: '연결된 금융상품 확인',
      detail: `${new Set(items.map((i) => i.product.id)).size}개 상품이 이 변경에 걸려 있음`,
    },
    {
      key: 'judge',
      label: '우대 확인일·회복 가능 여부 계산',
      detail: perm > 0 ? `확인일 ${dated}건 · 회복 불가 ${perm}건` : `확인일 ${dated}건`,
    },
    {
      key: 'money',
      label: '시점별 예상 손익 산출',
      detail: `연 기준 손실 ${formatWonShort(total.value)} · 절감 ${formatWonShort(savingsTotal.value)}`,
    },
  ];
}

// ── 타임라인 축 ────────────────────────────────────────────────────────

// 마지막 판정일 뒤로 여유를 넉넉히 둬서 안전 구간이 "여기부터" 로 읽히게 한다
const AXIS_PAD_DAYS = 12;
const AXIS_MIN_DAYS = 28;

function buildAxis(today: ISODate, items: ImpactItem[], timing: SafeTiming): Axis {
  const dated = items.filter((i) => i.judgment.nextJudgmentDate.value !== null);
  const latest = maxISO([
    ...dated.map((i) => i.judgment.nextJudgmentDate.value as ISODate),
    timing.safeFrom.value,
  ]) ?? today;
  const spanDays = Math.max(AXIS_MIN_DAYS, daysBetween(today, latest) + AXIS_PAD_DAYS);
  const end = addOffset(today, { days: spanDays });
  const pct = (d: ISODate) => Math.round((daysBetween(today, d) / spanDays) * 1000) / 10;

  const points: AxisPoint[] = [{ date: today, pct: pct(today), kind: 'today' }];
  for (const i of dated) {
    const date = i.judgment.nextJudgmentDate.value as ISODate;
    const kind: AxisPoint['kind'] = !i.judgment.active
      ? 'inactive'
      : !timing.alreadySafe && date === timing.safeAfter.value
        ? 'safe'
        : 'judgment';
    points.push({ date, pct: pct(date), kind, conditionId: i.condition.id });
  }
  return { start: today, end, points, safeFromPct: pct(timing.safeFrom.value) };
}
