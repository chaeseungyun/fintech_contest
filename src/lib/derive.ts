// 화면들이 공유하는 파생 값. 시나리오 하나 + 트리거 하나에서 전부 계산한다.
// 화면은 이 결과만 읽는다. 값을 복사해 갖지 않는다.

import { addOffset, daysBetween, maxISO } from './dates';
import { formatKoMD, formatKoYMD, formatMonths, formatWonShort, withJosa } from './format';
import { buildGraph, incomingConditions, productById, unsupportedForDocs, type Graph } from './graph';
import { horizonProjection, type Horizon } from './horizon';
import { computeSafeTiming, evaluateCondition, latestRecoverAt, type Judgment, type SafeTiming } from './interpreter';
import { lossBreakdown, savingItems, sumAnnual, type LossBreakdown, type SavingItem } from './money';
import type { Condition, ISODate, MappedCondition, Product, Scenario, Source, Tagged, Trigger } from './types';
import { defaultTrigger, tag, triggerById } from './types';

export interface ImpactItem {
  condition: MappedCondition;
  product: Product;
  loss: LossBreakdown;
  judgment: Judgment;
  /** 실제 손실. 조건이 이미 미적용이면 0 */
  effectiveLoss: Tagged<number>;
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

export type VerdictKind = 'keep' | 'switch';

export interface Verdict {
  kind: VerdictKind;
  /** 화면은 highlight 부분만 색을 바꿔 그린다. 문장을 화면에 쓰지 않는다. */
  lead: string;
  highlight: string;
  tail: string;
  body: string;
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
  /** 금액 큰 순 */
  items: ImpactItem[];
  /** 손실이 실제로 발생하는 건수 */
  affectedCount: number;
  total: Tagged<number>;
  savings: SavingItem[];
  savingsTotal: Tagged<number>;
  /** 지금 실행 시 연 기준 순손익. 양수면 이득 */
  netAnnual: Tagged<number>;
  horizon: Horizon;
  verdict: Verdict;
  checklist: ChecklistItem[];
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

export function derive(scenario: Scenario, triggerId?: string): Derived {
  const today = scenario.meta.today;
  const trigger = triggerId ? triggerById(scenario, triggerId) : defaultTrigger(scenario);
  const centerId = trigger.productId;
  const center = productById(scenario, centerId);
  const conditions = incomingConditions(scenario, centerId);

  const items: ImpactItem[] = conditions.map((condition) => {
    const product = productById(scenario, condition.binds.holder);
    const loss = lossBreakdown(condition, product);
    const judgment = evaluateCondition(condition, today, scenario.products);
    return {
      condition,
      product,
      loss,
      judgment,
      effectiveLoss: tag(judgment.active ? loss.annualLoss.value : 0, 'calc'),
    };
  });
  items.sort((a, b) => b.effectiveLoss.value - a.effectiveLoss.value);

  const judgments = items.map((i) => i.judgment);
  const timing = computeSafeTiming(judgments, today);

  const active = items.filter((i) => i.judgment.active);
  const recoverable = active.filter((i) => i.judgment.recoverable);
  const unrecoverable = active.filter((i) => !i.judgment.recoverable);
  const inactive = items.filter((i) => !i.judgment.active);
  const deferredNextMonth = recoverable.filter((i) => !i.judgment.countsForSafeAfter);

  const total = sumAnnual(items.map((i) => i.effectiveLoss.value));
  const savings = savingItems(trigger.savings, center);
  const savingsTotal = sumAnnual(savings.map((s) => s.annualAmount.value));
  const recoverBy = latestRecoverAt(unrecoverable.map((i) => i.judgment));

  const horizon = horizonProjection({
    today,
    annualLoss: total.value,
    savings: savingsTotal.value,
    recoverBy,
    verb: trigger.verb,
  });

  const unsupported = unsupportedForDocs(
    scenario,
    conditions.map((c) => c.sourceDoc),
  );

  const verdict = buildVerdict({ trigger, center, items: active, horizon, savings });

  return {
    today,
    trigger,
    center,
    graph: buildGraph(scenario, centerId),
    items,
    affectedCount: items.filter((i) => i.effectiveLoss.value > 0).length,
    total,
    savings,
    savingsTotal,
    netAnnual: horizon.netAnnual,
    horizon,
    verdict,
    checklist: buildChecklist({
      trigger,
      center,
      items: active,
      total,
      savings,
      savingsTotal,
      horizon,
      timing,
      unrecoverable,
    }),
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

function productNames(items: ImpactItem[]): string {
  const seen: string[] = [];
  for (const i of items) {
    const name = shortName(i.product);
    if (!seen.includes(name)) seen.push(name);
  }
  return seen.join('·');
}

// ── 최종 판단 ──────────────────────────────────────────────────────────

function buildVerdict(ctx: {
  trigger: Trigger;
  center: Product;
  items: ImpactItem[];
  horizon: Horizon;
  savings: SavingItem[];
}): Verdict {
  const { trigger, center, items, horizon, savings } = ctx;
  const name = shortName(center);
  const net = horizon.netAnnual.value;

  if (net < 0) {
    return {
      kind: 'keep',
      lead: '지금은',
      highlight: `${withJosa(name, '을/를')} 유지하는 것이`,
      tail: '유리합니다.',
      body:
        items.length > 0
          ? `연결된 ${productNames(items)}의 우대 혜택 손실이 더 커, 현재 ${withJosa(name, '을/를')} 유지하는 것이 유리합니다.`
          : `${trigger.verb} 후 줄어드는 비용보다 잃는 것이 커 유지하는 것이 유리합니다.`,
    };
  }

  const savingLabel = savings.length > 0 ? savings.map((s) => s.label).join('·') : '비용';
  return {
    kind: 'switch',
    lead: '지금',
    highlight: `${withJosa(name, '을/를')} ${trigger.verb}해도`,
    tail: '금액상 손해는 없습니다.',
    body:
      items.length > 0
        ? `${savingLabel} 절감이 연결된 ${productNames(items)}의 혜택 손실보다 커, 금액만 보면 지금 ${trigger.verb}해도 손해가 아닙니다.`
        : `${withJosa(name, '과/와')} 연결된 우대 조건이 없어 ${trigger.verb} 시 사라지는 혜택이 없습니다.`,
  };
}

function buildChecklist(ctx: {
  trigger: Trigger;
  center: Product;
  items: ImpactItem[];
  total: Tagged<number>;
  savings: SavingItem[];
  savingsTotal: Tagged<number>;
  horizon: Horizon;
  timing: SafeTiming;
  unrecoverable: ImpactItem[];
}): ChecklistItem[] {
  const { trigger, center, items, total, savings, savingsTotal, horizon, timing, unrecoverable } = ctx;
  const name = shortName(center);
  const list: ChecklistItem[] = [];

  if (savingsTotal.value > 0) {
    const label = savings.map((s) => s.label).join('·');
    list.push({
      key: 'compare',
      text:
        total.value > savingsTotal.value
          ? `${label} ${formatWonShort(savingsTotal.value)} 절감보다 연결된 금융 혜택 손실 ${formatWonShort(total.value)}이 더 큽니다.`
          : `${label} ${formatWonShort(savingsTotal.value)} 절감이 연결된 혜택 손실 ${formatWonShort(total.value)}보다 큽니다.`,
      source: 'calc',
    });
  } else if (total.value > 0) {
    list.push({
      key: 'compare',
      text: `${trigger.verb} 시 줄어드는 비용은 없고, 연결된 혜택 ${formatWonShort(total.value)}이 사라집니다.`,
      source: 'calc',
    });
  }

  const rec = horizon.recommended;
  if (rec.months > 0) {
    list.push({
      key: 'horizon',
      text: `${formatMonths(rec.months)} 유지 시 약 ${formatWonShort(rec.value.value)}의 이익이 예상됩니다.`,
      source: rec.value.source,
    });
  }

  if (items.length > 0) {
    list.push({
      key: 'links',
      text: `현재 ${withJosa(name, '은/는')} ${productNames(items)} ${items.length}개 상품의 우대 조건과 연결되어 있습니다.`,
      source: 'doc',
    });
  }

  for (const u of unrecoverable) {
    list.push({
      key: `perm-${u.condition.id}`,
      text: `${shortName(u.product)} 우대는 가입 시 확정된 조건이라 만기 ${formatKoYMD(u.judgment.recoverAt!.value)}까지 되돌릴 수 없습니다.`,
      source: u.judgment.recoverAt!.source,
    });
  }

  if (!timing.alreadySafe) {
    list.push({
      key: 'safe',
      text: `이번 달 판정은 ${formatKoMD(timing.safeAfter.value)}에 끝납니다. 그 이후에 실행하면 이번 달 혜택은 지킵니다.`,
      source: timing.safeAfter.source,
    });
  }

  if (trigger.caveat) list.push({ key: 'caveat', text: trigger.caveat, source: 'doc' });

  return list;
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
      label: '약관 원문에서 조건 추출',
      detail: `${conditions.length + unsupported.length}개 문장 중 ${conditions.length}건 매핑`,
    },
    {
      key: 'link',
      label: '연결된 금융상품 탐색',
      detail: `${new Set(items.map((i) => i.product.id)).size}개 상품이 이 변경에 걸려 있음`,
    },
    {
      key: 'judge',
      label: '판정일·회복 가능 여부 계산',
      detail: perm > 0 ? `판정일 ${dated}건 · 회복 불가 ${perm}건` : `판정일 ${dated}건 확정`,
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
