import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/scenario.json';
import { applyEdits } from './edits';
import { buildGraph, incomingConditions, unsupportedForDocs } from './graph';
import type { Scenario } from './types';

const base = fixture as unknown as Scenario;
const scenario = applyEdits(base, {});
const target = scenario.trigger.productId;

describe('binds 역방향 조회', () => {
  it('급여통장을 target 으로 가진 조건은 4건 (UNSUPPORTED 제외)', () => {
    expect(incomingConditions(scenario, target).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
  it('각 조건의 holder 가 위성 노드가 된다', () => {
    const g = buildGraph(scenario, target);
    expect(g.center.id).toBe(target);
    expect(g.edges).toHaveLength(4);
    expect(g.satellites.map((s) => s.product.id)).toEqual([
      'loan_hana_mortgage',
      'card_hana_1q',
      'autopay_hana_utility',
      'dep_hana_term',
    ]);
    expect(g.edges.every((e) => e.targetId === target)).toBe(true);
    expect(g.edges.every((e) => e.effect.source === 'doc')).toBe(true);
  });
  it('조건을 하나 지우면 선도 하나 줄어든다', () => {
    const fewer = applyEdits(base, {}, ['c3']);
    expect(buildGraph(fewer, target).edges).toHaveLength(3);
    expect(buildGraph(fewer, target).satellites.map((s) => s.product.id)).not.toContain(
      'autopay_hana_utility',
    );
  });
  it('조건을 하나 더하면 선도 하나 는다', () => {
    const c1 = scenario.conditions.find((c) => c.id === 'c1')!;
    const more: Scenario = {
      ...scenario,
      conditions: [...scenario.conditions, { ...c1, id: 'c9' }],
    };
    expect(buildGraph(more, target).edges).toHaveLength(5);
  });
  it('다른 상품을 중심에 두면 선이 없다', () => {
    expect(buildGraph(scenario, 'card_hana_1q').edges).toHaveLength(0);
  });
  it('선 라벨은 metric.kind 에서 나온다', () => {
    const labels = buildGraph(scenario, target).edges.map((e) => e.metricLabel.value);
    expect(labels).toEqual(['급여이체 조건', '카드+급여 조건', '자동이체+급여 조건', '급여이체 조건']);
  });
});

describe('옮기지 못한 조건', () => {
  it('c5 는 주담대 약관과 같은 문서에 묶인다', () => {
    const loanDoc = scenario.conditions.find((c) => c.id === 'c1')!.sourceDoc;
    expect(unsupportedForDocs(scenario, [loanDoc]).map((c) => c.id)).toEqual(['c5']);
    const cardDoc = scenario.conditions.find((c) => c.id === 'c2')!.sourceDoc;
    expect(unsupportedForDocs(scenario, [cardDoc])).toHaveLength(0);
  });
});
