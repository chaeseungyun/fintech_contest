import { describe, expect, it } from 'vitest';
import { applyEdits } from './edits';
import { BASE } from './fixture.test-helpers';
import { isMapped } from './types';
import { watchSummary } from './watch';

const scenario = applyEdits(BASE, {});
const mapped = scenario.conditions.filter(isMapped);

describe('상시 요약 — 트리거 없이 보유 상태만 본다', () => {
  const w = watchSummary(scenario);

  it('MAPPED 조건 전부를 본다', () => {
    expect(w.linkCount).toBe(mapped.length);
    expect(w.rows).toHaveLength(mapped.length);
  });

  it('연 혜택 큰 순으로 정렬된다', () => {
    const values = w.rows.map((r) => r.annualBenefit.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('살아있는 조건의 합만 지금 받는 혜택으로 센다', () => {
    const sum = w.rows
      .filter((r) => r.judgment.active)
      .reduce((a, r) => a + r.annualBenefit.value, 0);
    expect(w.activeTotal.value).toBe(sum);
    expect(w.activeTotal.source).toBe('calc');
  });

  it('오늘 기준 이번 달에 남은 판정만 임박으로 센다', () => {
    expect(w.today).toBe(scenario.meta.today);
    for (const r of w.dueSoon) {
      const date = r.judgment.nextJudgmentDate.value!;
      expect(date >= w.today).toBe(true);
      expect(date.slice(0, 7)).toBe(w.today.slice(0, 7));
      expect(r.judgment.active).toBe(true);
    }
  });

  it('임박한 판정은 날짜 빠른 순이고 nextDate 가 그 첫 날이다', () => {
    const dates = w.dueSoon.map((r) => r.judgment.nextJudgmentDate.value!);
    expect(dates).toEqual([...dates].sort());
    expect(w.nextDate).toBe(dates[0] ?? null);
  });

  it('만기까지 고정된 조건(PERMANENT)은 판정일이 없어 임박에 들어가지 않는다', () => {
    const perm = w.rows.filter((r) => r.judgment.nextJudgmentDate.value === null);
    expect(perm.length).toBeGreaterThan(0);
    for (const r of perm) expect(w.dueSoon).not.toContain(r);
  });

  it('기본 시나리오에는 실적 미달 조건이 없다', () => {
    expect(w.inactive).toHaveLength(0);
  });

  it('각 조건은 그것을 흔드는 분석 진입점을 안다', () => {
    for (const r of w.rows) {
      if (r.triggerId === null) continue;
      expect(scenario.triggers.find((t) => t.id === r.triggerId)!.productId).toBe(r.target.id);
    }
  });
});

describe('실적을 건드리면 요약이 따라 움직인다', () => {
  it('카드 실적 기준을 올리면 그 조건이 미적용으로 빠지고 합계가 줄어든다', () => {
    const before = watchSummary(scenario);
    const after = watchSummary(applyEdits(BASE, { k1: { threshold: 900_000 } }));

    expect(after.inactive.map((r) => r.condition.id)).toEqual(['k1']);
    expect(after.activeTotal.value).toBe(before.activeTotal.value - 60_000_000 * 0.002);
    expect(after.linkCount).toBe(before.linkCount);
  });

  it('판정일을 오늘 뒤로 밀면 임박 목록의 순서가 바뀐다', () => {
    const after = watchSummary(applyEdits(BASE, { k1: { dayOfMonth: 28 } }));
    const dates = after.dueSoon.map((r) => r.judgment.nextJudgmentDate.value!);
    expect(dates).toEqual([...dates].sort());
    expect(dates).toContain('2026-09-28');
  });

  it('조건을 지우면 요약에서도 사라진다', () => {
    const after = watchSummary(applyEdits(BASE, {}, ['k1', 'k2']));
    expect(after.linkCount).toBe(mapped.length - 2);
    expect(after.rows.some((r) => r.condition.id === 'k1')).toBe(false);
  });
});
