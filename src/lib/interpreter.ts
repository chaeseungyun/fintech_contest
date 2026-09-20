// 연산자 평가. 각 조건의 expr.op 에 따라 "다음 판정일"과 "회복 가능 여부"를 낸다.
// 전부 순수 함수. today 는 반드시 scenario.meta.today 에서 온다.

import { addOffset, compareISO, endOfMonth, maxISO, nextDayOfMonth, startOfNextMonth } from './dates';
import type { ISODate, MappedCondition, Op, Product, Scenario, Tagged } from './types';
import { defaultTrigger, isMapped, tag } from './types';

export interface Judgment {
  conditionId: string;
  holderId: string;
  op: Op;
  /** 다음 판정일. PERMANENT 는 null. */
  nextJudgmentDate: Tagged<ISODate | null>;
  /** 판정 주기가 있어 시점을 맞추면 회복되는가 */
  recoverable: boolean;
  /** PERMANENT: until 앵커를 상품 facts 에 바인딩한 회복 시점 */
  recoverAt: Tagged<ISODate> | null;
  /** "매월 15일 재산정" 같은 주기 설명. 출처는 조건의 provenance.cycle */
  cycleLabel: Tagged<string>;
  /** 실적 기준이 현재 충족되어 혜택이 살아있는가. 미충족이면 이미 미적용 상태 */
  active: boolean;
  /** 실적 미충족 사유. active 면 null */
  inactiveReason: string | null;
  /** 안전 시점 계산에 들어가는가: 회복 가능 + 살아있음 + 이번 달 안의 판정일 */
  countsForSafeAfter: boolean;
  /** "충족" 판단이 무엇에 기대고 있는가. 실적 값이 없으면 충족으로 *가정* 한 것이라 그렇게 적는다 */
  metricStatus: MetricStatus;
}

/**
 * 실적 충족 판단의 근거 상태.
 *   verified 실적 데이터(currentValue)로 확인
 *   user     실적 값은 없지만 사용자가 충족으로 확인
 *   assumed  실적 값이 없어 충족으로 가정 — 빈 값을 조용히 충족으로 처리하지 않고 드러낸다
 *   fixed    가입 시 확정된 조건이라 재판정이 없다 (PERMANENT)
 */
export type MetricStatus = 'verified' | 'user' | 'assumed' | 'fixed';

export const METRIC_STATUS_LABEL: Record<MetricStatus, string> = {
  verified: '실적 데이터로 확인',
  user: '사용자가 충족으로 확인',
  assumed: '실적 값 없음 · 충족으로 가정',
  fixed: '가입 시 확정 · 재판정 없음',
};

export function metricStatus(cond: MappedCondition): MetricStatus {
  if (cond.expr.op === 'PERMANENT') return 'fixed';
  if (cond.metric.currentValue !== undefined) return 'verified';
  if (cond.metric.source === 'user_confirmed') return 'user';
  return 'assumed';
}

export interface SafeTiming {
  /** 이 날의 판정까지 끝나면 이번 달 판정이 모두 끝난다 */
  safeAfter: Tagged<ISODate>;
  /** 안전 구간의 시작 [safeFrom, ∞). safeAfter 다음 날 */
  safeFrom: Tagged<ISODate>;
  /** 이번 달 남은 판정이 없어 지금 옮겨도 되는 상태 */
  alreadySafe: boolean;
}

/** 앵커 이름을 상품 facts 의 실제 날짜로 바인딩한다. */
export function resolveAnchor(anchor: string, product: Product): ISODate | null {
  switch (anchor) {
    case 'maturity':
      return product.facts.maturity ?? null;
    case 'account_open':
      return product.facts.openedAt ?? null;
    default:
      return null;
  }
}

/** 현재 실적이 기준을 넘는가. 실적 데이터가 없거나 기준이 없으면 충족으로 *가정* 한다 — metricStatus 가 그 사실을 드러낸다. */
export function isMetricMet(cond: MappedCondition): boolean {
  const { threshold, currentValue } = cond.metric;
  if (threshold === null || currentValue === undefined) return true;
  return currentValue >= threshold;
}

export function nextJudgmentDate(cond: MappedCondition, today: ISODate): ISODate | null {
  const { op, params } = cond.expr;
  switch (op) {
    case 'RECUR': {
      const dom = params.from?.dayOfMonth;
      if (dom === undefined) throw new Error(`${cond.id}: RECUR 에 from.dayOfMonth 가 없다`);
      return nextDayOfMonth(today, dom);
    }
    case 'ROLLING': {
      if (params.settleOn?.anchor === 'month_end') return endOfMonth(today);
      const dom = params.settleOn?.dayOfMonth;
      if (dom === undefined) throw new Error(`${cond.id}: ROLLING 의 settleOn 을 해석할 수 없다`);
      return nextDayOfMonth(today, dom);
    }
    case 'COUNT': {
      const dom = params.checkOn?.dayOfMonth;
      if (dom === undefined) throw new Error(`${cond.id}: COUNT 에 checkOn.dayOfMonth 가 없다`);
      return nextDayOfMonth(today, dom);
    }
    case 'PERMANENT':
      return null;
  }
}

export function isRecoverable(cond: MappedCondition): boolean {
  return cond.expr.op !== 'PERMANENT';
}

export function cycleLabel(cond: MappedCondition): string {
  const { op, params } = cond.expr;
  switch (op) {
    case 'RECUR':
      return `매월 ${params.from?.dayOfMonth}일 재산정`;
    case 'ROLLING':
      return params.settleOn?.anchor === 'month_end'
        ? '전월 실적, 매월 말일 확정'
        : `전월 실적, 매월 ${params.settleOn?.dayOfMonth}일 확정`;
    case 'COUNT':
      return `매월 ${params.checkOn?.dayOfMonth}일 확인`;
    case 'PERMANENT':
      return '가입 시 확정, 만기까지 고정';
  }
}

const METRIC_NOUN: Record<string, string> = {
  salary_transfer: '급여이체',
  card_spend: '카드 이용금액',
  autopay_count: '자동이체 건수',
  card_holding: '제휴카드 보유',
  card_autopay: '카드 자동납부',
  loan_holding: '대출 보유',
  deposit_balance: '예적금 평균잔액',
};

export function metricNoun(kind: string): string {
  return METRIC_NOUN[kind] ?? kind;
}

/** 건수로 세는 실적인가. 아니면 원 단위 금액이다. */
const COUNT_METRICS = new Set(['autopay_count', 'card_holding', 'card_autopay', 'loan_holding']);

export function metricUnit(kind: string): string {
  return COUNT_METRICS.has(kind) ? '건' : '원';
}

/** 이 조건을 살려 두려면 지켜야 하는 것. "카드 이용금액 300,000원 이상" */
export function requirementLabel(cond: MappedCondition): string {
  const { kind, threshold } = cond.metric;
  if (threshold === null) return `${metricNoun(kind)} 유지`;
  return `${metricNoun(kind)} ${fmt(threshold)}${metricUnit(kind)} 이상`;
}

function inactiveReason(cond: MappedCondition): string | null {
  if (isMetricMet(cond)) return null;
  const { threshold, currentValue, kind } = cond.metric;
  const unit = metricUnit(kind);
  return `현재 ${metricNoun(kind)} ${fmt(currentValue!)}${unit} < 기준 ${fmt(threshold!)}${unit} · 이미 미적용`;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function evaluateCondition(
  cond: MappedCondition,
  today: ISODate,
  products: Product[],
): Judgment {
  const holder = products.find((p) => p.id === cond.binds.holder);
  if (!holder) throw new Error(`${cond.id}: holder ${cond.binds.holder} 를 찾을 수 없다`);

  const date = nextJudgmentDate(cond, today);
  const recoverable = isRecoverable(cond);
  const active = isMetricMet(cond);

  let recoverAt: Tagged<ISODate> | null = null;
  if (!recoverable) {
    const anchor = cond.expr.params.until?.anchor;
    const bound = anchor ? resolveAnchor(anchor, holder) : null;
    if (!bound) throw new Error(`${cond.id}: until 앵커 '${anchor}' 를 상품 facts 에 바인딩할 수 없다`);
    recoverAt = tag(bound, 'holding');
  }

  const inThisMonth = date !== null && compareISO(date, startOfNextMonth(today)) < 0;

  return {
    conditionId: cond.id,
    holderId: holder.id,
    op: cond.expr.op,
    nextJudgmentDate: tag(date, 'calc'),
    recoverable,
    recoverAt,
    cycleLabel: tag(cycleLabel(cond), cond.provenance?.cycle ?? 'doc'),
    active,
    inactiveReason: inactiveReason(cond),
    countsForSafeAfter: recoverable && active && inThisMonth,
    metricStatus: metricStatus(cond),
  };
}

/** targetId 를 가리키는 MAPPED 조건 전부를 평가한다. 생략하면 기본 트리거의 대상 상품. */
export function evaluateAll(scenario: Scenario, targetId?: string): Judgment[] {
  const today = scenario.meta.today;
  const target = targetId ?? defaultTrigger(scenario).productId;
  return scenario.conditions
    .filter(isMapped)
    .filter((c) => c.binds.target === target)
    .map((c) => evaluateCondition(c, today, scenario.products));
}

/** 회복 불가 조건들의 회복 시점 중 가장 늦은 날. 없으면 null */
export function latestRecoverAt(judgments: Judgment[]): ISODate | null {
  return maxISO(
    judgments.filter((j) => !j.recoverable && j.recoverAt).map((j) => (j.recoverAt as Tagged<ISODate>).value),
  );
}

/**
 * 전체 안전 시점 = 회복 가능한 조건 중 이번 달 안에 남은 판정일의 최댓값.
 * 남은 판정이 없으면 오늘이 곧 안전 시점이다.
 */
export function computeSafeTiming(judgments: Judgment[], today: ISODate): SafeTiming {
  const dates = judgments
    .filter((j) => j.countsForSafeAfter)
    .map((j) => j.nextJudgmentDate.value)
    .filter((d): d is ISODate => d !== null);
  const latest = maxISO(dates);
  if (latest === null) {
    return { safeAfter: tag(today, 'calc'), safeFrom: tag(today, 'calc'), alreadySafe: true };
  }
  return {
    safeAfter: tag(latest, 'calc'),
    safeFrom: tag(addOffset(latest, { days: 1 }), 'calc'),
    alreadySafe: false,
  };
}
