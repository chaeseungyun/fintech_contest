// 연쇄 조회. binds.target 이 변경 대상 상품을 가리키는 조건을 전부 찾아
// 각 조건의 binds.holder 를 영향받는 상품으로 낸다. 관계도의 선은 이 배열로 그린다.

import { metricNoun } from './interpreter';
import type { Condition, Effect, MappedCondition, Product, Scenario, Tagged } from './types';
import { isMapped, tag } from './types';

export interface Edge {
  conditionId: string;
  holderId: string;
  targetId: string;
  effect: Tagged<Effect>;
  /** 선 위 라벨: "급여이체 조건", "카드+급여 조건" */
  metricLabel: Tagged<string>;
}

export interface Satellite {
  product: Product;
  edge: Edge;
}

export interface Graph {
  center: Product;
  edges: Edge[];
  satellites: Satellite[];
}

/** target 상품에 걸린 MAPPED 조건 전부 */
export function incomingConditions(scenario: Scenario, targetId: string): MappedCondition[] {
  return scenario.conditions.filter(isMapped).filter((c) => c.binds.target === targetId);
}

export function productById(scenario: Scenario, id: string): Product {
  const p = scenario.products.find((x) => x.id === id);
  if (!p) throw new Error(`product ${id} 를 찾을 수 없다`);
  return p;
}

export function metricLabel(cond: MappedCondition): string {
  const kind = cond.metric.kind;
  if (kind === 'salary_transfer') return '급여이체 조건';
  const short: Record<string, string> = { card_spend: '카드', autopay_count: '자동이체' };
  return `${short[kind] ?? metricNoun(kind)}+급여 조건`;
}

export function toEdge(cond: MappedCondition): Edge {
  return {
    conditionId: cond.id,
    holderId: cond.binds.holder,
    targetId: cond.binds.target,
    effect: tag(cond.binds.effect, cond.provenance?.effect ?? 'doc'),
    metricLabel: tag(metricLabel(cond), 'doc'),
  };
}

export function buildGraph(scenario: Scenario, centerId: string): Graph {
  const center = productById(scenario, centerId);
  const edges = incomingConditions(scenario, centerId).map(toEdge);
  const satellites = edges.map((edge) => ({ product: productById(scenario, edge.holderId), edge }));
  return { center, edges, satellites };
}

export function unsupportedConditions(scenario: Scenario): Condition[] {
  return scenario.conditions.filter((c) => c.status === 'UNSUPPORTED');
}

/** 같은 약관 문서(sourceDoc)에서 조건으로 옮기지 못한 문장들 */
export function unsupportedForDocs(scenario: Scenario, docs: string[]): Condition[] {
  const set = new Set(docs);
  return unsupportedConditions(scenario).filter((c) => set.has(c.sourceDoc));
}
