import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/scenario.json';
import { applyEdits } from './edits';
import { computeSafeTiming, evaluateAll, evaluateCondition } from './interpreter';
import type { ISODate, MappedCondition, Scenario } from './types';
import { isMapped } from './types';

const base = fixture as unknown as Scenario;
const scenario = applyEdits(base, {});
const expected = (fixture as unknown as {
  expected: {
    nextJudgmentDates: Record<string, ISODate | null>;
    safeAfter: ISODate;
    unrecoverable: { conditionId: string; until: ISODate }[];
  };
}).expected;

const byId = (id: string) => scenario.conditions.find((c) => c.id === id) as MappedCondition;

describe('expected.nextJudgmentDates 재현', () => {
  const judgments = evaluateAll(scenario);
  for (const [id, date] of Object.entries(expected.nextJudgmentDates)) {
    it(`${id} → ${date}`, () => {
      const j = judgments.find((x) => x.conditionId === id);
      expect(j).toBeDefined();
      expect(j!.nextJudgmentDate.value).toBe(date);
      expect(j!.nextJudgmentDate.source).toBe('calc');
    });
  }
});

describe('회복 가능 여부', () => {
  const judgments = evaluateAll(scenario);
  it('PERMANENT 만 회복 불가', () => {
    expect(judgments.filter((j) => !j.recoverable).map((j) => j.conditionId)).toEqual(
      expected.unrecoverable.map((u) => u.conditionId),
    );
  });
  it('회복 불가 건은 until 앵커를 facts.maturity 로 바인딩한다', () => {
    for (const u of expected.unrecoverable) {
      const j = judgments.find((x) => x.conditionId === u.conditionId)!;
      expect(j.recoverAt?.value).toBe(u.until);
      expect(j.recoverAt?.source).toBe('holding');
    }
  });
});

describe('안전 시점', () => {
  it('expected.safeAfter 재현 — 이번 달 안의 판정일 중 가장 늦은 날', () => {
    const timing = computeSafeTiming(evaluateAll(scenario), scenario.meta.today);
    expect(timing.safeAfter.value).toBe(expected.safeAfter);
    expect(timing.safeAfter.source).toBe('calc');
    expect(timing.alreadySafe).toBe(false);
  });
  it('c3(10/5)는 다음 달 판정이라 제외된다', () => {
    const j = evaluateAll(scenario).find((x) => x.conditionId === 'c3')!;
    expect(j.countsForSafeAfter).toBe(false);
    expect(j.recoverable).toBe(true);
  });
  it('이번 달 판정이 다 지나면 alreadySafe', () => {
    const late = { ...scenario, meta: { ...scenario.meta, today: '2026-09-30' } };
    // 9/30 당일은 c2 판정일이므로 아직 아님
    expect(computeSafeTiming(evaluateAll(late), late.meta.today).alreadySafe).toBe(false);
    // 10/1: c1(10/15), c2(10/31), c3(10/5) 전부 10월 판정 → 이번 달(10월) 판정이 다시 남는다
    const oct = { ...scenario, meta: { ...scenario.meta, today: '2026-10-01' } };
    expect(computeSafeTiming(evaluateAll(oct), oct.meta.today).safeAfter.value).toBe('2026-10-31');
  });
});

describe('실적 미충족 = 이미 미적용', () => {
  it('카드 기준을 60만원으로 올리면 c2 는 inactive 가 되고 안전 시점이 9/15 로 당겨진다', () => {
    const edited = applyEdits(base, { c2: { threshold: 600000 } });
    const judgments = evaluateAll(edited);
    const c2 = judgments.find((j) => j.conditionId === 'c2')!;
    expect(c2.active).toBe(false);
    expect(c2.countsForSafeAfter).toBe(false);
    expect(c2.inactiveReason).toContain('이미 미적용');
    expect(computeSafeTiming(judgments, edited.meta.today).safeAfter.value).toBe('2026-09-15');
  });
  it('실적 데이터가 없는 조건(c1)은 기준을 올려도 살아있다', () => {
    const edited = applyEdits(base, { c1: { threshold: 9_000_000 } });
    const c1 = evaluateAll(edited).find((j) => j.conditionId === 'c1')!;
    expect(c1.active).toBe(true);
  });
});

describe('판정 주기 수정', () => {
  it('c1 을 31일로 바꾸면 9/30 (말일 clamping)', () => {
    const edited = applyEdits(base, { c1: { dayOfMonth: 31 } });
    const c1 = evaluateAll(edited).find((j) => j.conditionId === 'c1')!;
    expect(c1.nextJudgmentDate.value).toBe('2026-09-30');
    expect(c1.cycleLabel.source).toBe('user');
  });
  it('c1 을 3일로 바꾸면 다음 달 10/3 → 안전 시점에서 빠져 9/30 유지', () => {
    const edited = applyEdits(base, { c1: { dayOfMonth: 3 } });
    const judgments = evaluateAll(edited);
    expect(judgments.find((j) => j.conditionId === 'c1')!.nextJudgmentDate.value).toBe('2026-10-03');
    expect(computeSafeTiming(judgments, edited.meta.today).safeAfter.value).toBe('2026-09-30');
  });
});

describe('입력 검증', () => {
  it('MAPPED 조건만 평가 대상이다', () => {
    expect(scenario.conditions.filter(isMapped).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
  it('오늘이 판정일이면 오늘', () => {
    const j = evaluateCondition(byId('c1'), '2026-09-15', scenario.products);
    expect(j.nextJudgmentDate.value).toBe('2026-09-15');
  });
});
