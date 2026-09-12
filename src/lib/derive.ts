// 네 화면이 공유하는 파생 값. 시나리오 하나에서 전부 계산한다.
// 화면은 이 결과만 읽는다. 값을 복사해 갖지 않는다.

import { addOffset, daysBetween, maxISO } from './dates';
import { buildGraph, incomingConditions, productById, unsupportedForDocs, type Graph } from './graph';
import { computeSafeTiming, evaluateCondition, type Judgment, type SafeTiming } from './interpreter';
import { lossBreakdown, sumAnnual, type LossBreakdown } from './money';
import type { Condition, ISODate, MappedCondition, Product, Scenario, Tagged } from './types';
import { tag } from './types';

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

export interface Derived {
  today: ISODate;
  trigger: Scenario['trigger'];
  center: Product;
  graph: Graph;
  /** 금액 큰 순 */
  items: ImpactItem[];
  /** 손실이 실제로 발생하는 건수 */
  affectedCount: number;
  total: Tagged<number>;
  timing: SafeTiming;
  recoverable: ImpactItem[];
  unrecoverable: ImpactItem[];
  inactive: ImpactItem[];
  /** 살아있고 회복 가능하지만 판정일이 다음 달이라 안전 시점 계산에서 빠진 것 */
  deferredNextMonth: ImpactItem[];
  axis: Axis;
  unsupported: Condition[];
}

export function derive(scenario: Scenario): Derived {
  const today = scenario.meta.today;
  const centerId = scenario.trigger.productId;
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

  return {
    today,
    trigger: scenario.trigger,
    center,
    graph: buildGraph(scenario, centerId),
    items,
    affectedCount: items.filter((i) => i.effectiveLoss.value > 0).length,
    total: sumAnnual(items.map((i) => i.effectiveLoss.value)),
    timing,
    recoverable,
    unrecoverable,
    inactive,
    deferredNextMonth,
    axis: buildAxis(today, items, timing),
    unsupported: unsupportedForDocs(
      scenario,
      conditions.map((c) => c.sourceDoc),
    ),
  };
}

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
