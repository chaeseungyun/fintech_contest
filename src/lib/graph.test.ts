import { describe, expect, it } from 'vitest';
import { applyEdits } from './edits';
import { BASE, CARD, SALARY } from './fixture.test-helpers';
import { buildGraph, incomingConditions, outgoingConditions, unsupportedForDocs } from './graph';
import type { Scenario } from './types';
import { triggerById } from './types';

const scenario = applyEdits(BASE, {});
const targetOf = (id: string) => triggerById(scenario, id).productId;

describe('binds 역방향 조회', () => {
  it('카드를 target 으로 가진 조건은 3건 (UNSUPPORTED 제외)', () => {
    expect(incomingConditions(scenario, targetOf(CARD)).map((c) => c.id)).toEqual(['k1', 'k2', 'k3']);
  });
  it('급여통장을 target 으로 가진 조건은 4건', () => {
    expect(incomingConditions(scenario, targetOf(SALARY)).map((c) => c.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
    ]);
  });
  it('각 조건의 holder 가 위성 노드가 된다', () => {
    const target = targetOf(CARD);
    const g = buildGraph(scenario, target);
    expect(g.center.id).toBe(target);
    expect(g.edges).toHaveLength(3);
    expect(g.satellites.map((s) => s.product.id)).toEqual([
      'loan_nuri_mortgage',
      'dep_nuri_term',
      'ins_nuri_care',
    ]);
    expect(g.edges.every((e) => e.targetId === target)).toBe(true);
    expect(g.edges.every((e) => e.effect.source === 'doc')).toBe(true);
  });
  it('조건을 하나 지우면 선도 하나 줄어든다', () => {
    const fewer = applyEdits(BASE, {}, ['k3']);
    const target = targetOf(CARD);
    expect(buildGraph(fewer, target).edges).toHaveLength(2);
    expect(buildGraph(fewer, target).satellites.map((s) => s.product.id)).not.toContain('ins_nuri_care');
  });
  it('조건을 하나 더하면 선도 하나 는다', () => {
    const k1 = scenario.conditions.find((c) => c.id === 'k1')!;
    const more: Scenario = { ...scenario, conditions: [...scenario.conditions, { ...k1, id: 'k9' }] };
    expect(buildGraph(more, targetOf(CARD)).edges).toHaveLength(4);
  });
  it('연결이 없는 상품을 중심에 두면 선이 없다', () => {
    expect(buildGraph(scenario, 'inv_nuri_fund').edges).toHaveLength(0);
  });
  it('선 라벨은 metric.kind 에서 나온다', () => {
    const labels = buildGraph(scenario, targetOf(CARD)).edges.map((e) => e.metricLabel.value);
    expect(labels).toEqual(['카드 실적 조건', '카드 보유 조건', '카드 납부 조건']);
  });
});

describe('holder 방향 조회', () => {
  it('정기예금은 세 상품의 유지 조건을 달고 있다', () => {
    expect(outgoingConditions(scenario, 'dep_nuri_term').map((c) => c.id)).toEqual(['k2', 'c4', 'l2']);
  });
});

describe('옮기지 못한 조건', () => {
  it('u1 은 주담대 약관과 같은 문서에 묶인다', () => {
    const loanDoc = scenario.conditions.find((c) => c.id === 'c1')!.sourceDoc;
    expect(unsupportedForDocs(scenario, [loanDoc]).map((c) => c.id)).toEqual(['u1']);
  });
  it('u2 는 카드 급여이체 우대 약관에 묶인다', () => {
    const cardDoc = scenario.conditions.find((c) => c.id === 'c2')!.sourceDoc;
    expect(unsupportedForDocs(scenario, [cardDoc]).map((c) => c.id)).toEqual(['u2']);
  });
  it('보험 약관에는 옮기지 못한 문장이 없다', () => {
    const insDoc = scenario.conditions.find((c) => c.id === 'k3')!.sourceDoc;
    expect(unsupportedForDocs(scenario, [insDoc])).toHaveLength(0);
  });
});
