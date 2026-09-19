// 상시 분석 요약. 트리거(변경 시도)를 전제하지 않고 "지금 보유 상태" 만 본다.
// 홈의 상태 카드와 혜택 탭이 같은 결과를 읽는다 — 화면이 각자 세지 않는다.
//
// derive() 가 "이 상품을 바꾸면" 을 계산한다면, 여기는 "아무것도 안 바꾸면 이번 달에 무슨 일이
// 일어나는가" 를 낸다. 코멘트가 지적한 '상시'가 화면에 드러나는 자리다.

import { compareISO, startOfNextMonth } from './dates';
import { productById } from './graph';
import { evaluateCondition, requirementLabel, type Judgment } from './interpreter';
import { annualLossOf, sumAnnual } from './money';
import type { ISODate, MappedCondition, Product, Scenario, Tagged } from './types';
import { isMapped } from './types';

export interface WatchRow {
  condition: MappedCondition;
  /** 혜택을 받는 상품 */
  holder: Product;
  /** 그 혜택을 떠받치는 상품 */
  target: Product;
  /** 지금 받고 있는(또는 못 받고 있는) 연 혜택 */
  annualBenefit: Tagged<number>;
  judgment: Judgment;
  /** "카드 이용금액 300,000원 이상" */
  requirement: string;
  /** 이번 달 안에 판정일이 남아 있는가 */
  dueThisMonth: boolean;
  /** 이 조건을 흔드는 변경 진입점. 없으면 null */
  triggerId: string | null;
}

export interface WatchSummary {
  today: ISODate;
  /** 연 혜택 큰 순 */
  rows: WatchRow[];
  /** 지금 실제로 받고 있는 우대의 연 합계 */
  activeTotal: Tagged<number>;
  /** 실적 미달로 이미 꺼져 있는 조건 */
  inactive: WatchRow[];
  /** 이번 달 안에 판정일이 남은 조건. 날짜 빠른 순 */
  dueSoon: WatchRow[];
  /** 가장 이른 판정일. 이번 달에 남은 판정이 없으면 null */
  nextDate: ISODate | null;
  /** 상시 분석 중인 연결 조건 수 */
  linkCount: number;
  /** 조건에 걸려 있는 상품 수 */
  productCount: number;
}

export function watchSummary(scenario: Scenario): WatchSummary {
  const today = scenario.meta.today;
  const nextMonth = startOfNextMonth(today);

  const rows: WatchRow[] = scenario.conditions.filter(isMapped).map((condition) => {
    const holder = productById(scenario, condition.binds.holder);
    const target = productById(scenario, condition.binds.target);
    const judgment = evaluateCondition(condition, today, scenario.products);
    const date = judgment.nextJudgmentDate.value;
    return {
      condition,
      holder,
      target,
      annualBenefit: { value: annualLossOf(condition, holder), source: 'calc' as const },
      judgment,
      requirement: requirementLabel(condition),
      dueThisMonth: date !== null && compareISO(date, nextMonth) < 0,
      triggerId: scenario.triggers.find((t) => t.productId === target.id)?.id ?? null,
    };
  });
  rows.sort((a, b) => b.annualBenefit.value - a.annualBenefit.value);

  const inactive = rows.filter((r) => !r.judgment.active);
  const dueSoon = rows
    .filter((r) => r.judgment.active && r.dueThisMonth)
    .sort((a, b) => compareISO(a.judgment.nextJudgmentDate.value!, b.judgment.nextJudgmentDate.value!));

  const productIds = new Set<string>();
  for (const r of rows) {
    productIds.add(r.holder.id);
    productIds.add(r.target.id);
  }

  return {
    today,
    rows,
    activeTotal: sumAnnual(rows.filter((r) => r.judgment.active).map((r) => r.annualBenefit.value)),
    inactive,
    dueSoon,
    nextDate: dueSoon.length > 0 ? dueSoon[0].judgment.nextJudgmentDate.value : null,
    linkCount: rows.length,
    productCount: productIds.size,
  };
}
