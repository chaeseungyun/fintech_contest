import { describe, expect, it } from 'vitest';
import { applyEdits } from './edits';
import { BASE, CARD, EXPECTED, SALARY, TRIGGER_IDS } from './fixture.test-helpers';
import {
  computeSafeTiming,
  evaluateAll,
  evaluateCondition,
  latestRecoverAt,
  METRIC_STATUS_LABEL,
  metricStatus,
  metricUnit,
} from './interpreter';
import type { ISODate, MappedCondition } from './types';
import { isMapped, triggerById } from './types';

const scenario = applyEdits(BASE, {});
const byId = (id: string) => scenario.conditions.find((c) => c.id === id) as MappedCondition;
const targetOf = (id: string) => triggerById(scenario, id).productId;

describe('expected.nextJudgmentDates 재현 — 트리거 전부', () => {
  for (const triggerId of TRIGGER_IDS) {
    const e = EXPECTED.triggers[triggerId];
    const judgments = evaluateAll(scenario, targetOf(triggerId));
    for (const [id, date] of Object.entries(e.nextJudgmentDates)) {
      it(`${triggerId}/${id} → ${date}`, () => {
        const j = judgments.find((x) => x.conditionId === id);
        expect(j).toBeDefined();
        expect(j!.nextJudgmentDate.value).toBe(date);
        expect(j!.nextJudgmentDate.source).toBe('calc');
      });
    }
  }
});

describe('회복 가능 여부', () => {
  for (const triggerId of TRIGGER_IDS) {
    const e = EXPECTED.triggers[triggerId];
    const judgments = evaluateAll(scenario, targetOf(triggerId));

    it(`${triggerId}: PERMANENT 만 회복 불가`, () => {
      expect(judgments.filter((j) => !j.recoverable).map((j) => j.conditionId)).toEqual(
        e.unrecoverable.map((u) => u.conditionId),
      );
    });

    it(`${triggerId}: 회복 불가 건은 until 앵커를 facts.maturity 로 바인딩한다`, () => {
      for (const u of e.unrecoverable) {
        const j = judgments.find((x) => x.conditionId === u.conditionId)!;
        expect(j.recoverAt?.value).toBe(u.until);
        expect(j.recoverAt?.source).toBe('holding');
        expect(j.nextJudgmentDate.value).toBeNull();
      }
    });

    it(`${triggerId}: 안전 시점은 ${e.safeAfter}`, () => {
      const timing = computeSafeTiming(judgments, scenario.meta.today);
      expect(timing.safeAfter.value).toBe(e.safeAfter);
      expect(timing.safeAfter.source).toBe('calc');
    });
  }
});

describe('안전 시점 규칙 (팀 확정 2026-09-10)', () => {
  const judgments = evaluateAll(scenario, targetOf(SALARY));

  it('이번 달을 넘긴 판정(c3 10/5)은 계산에서 빠진다', () => {
    const c3 = judgments.find((j) => j.conditionId === 'c3')!;
    expect(c3.nextJudgmentDate.value).toBe('2026-10-05');
    expect(c3.countsForSafeAfter).toBe(false);
    expect(computeSafeTiming(judgments, scenario.meta.today).safeAfter.value).toBe('2026-09-30');
  });

  it('안전 구간은 safeAfter 다음 날부터다', () => {
    const t = computeSafeTiming(judgments, scenario.meta.today);
    expect(t.safeFrom.value).toBe('2026-10-01');
    expect(t.alreadySafe).toBe(false);
  });

  it('남은 판정이 없으면 오늘이 곧 안전 시점이다', () => {
    const t = computeSafeTiming([], scenario.meta.today);
    expect(t.alreadySafe).toBe(true);
    expect(t.safeAfter.value).toBe(scenario.meta.today);
  });
});

describe('실적 미충족은 이미 미적용', () => {
  it('기준을 현재 실적보다 올리면 active 가 꺼지고 안전 시점에서 빠진다', () => {
    const raised = applyEdits(BASE, { k1: { threshold: 900_000 } });
    const cond = raised.conditions.find((c) => c.id === 'k1')!;
    const j = evaluateCondition(cond as MappedCondition, raised.meta.today, raised.products);
    expect(j.active).toBe(false);
    expect(j.countsForSafeAfter).toBe(false);
    expect(j.inactiveReason).toContain('이미 미적용');
  });

  it('threshold 나 currentValue 가 없으면 충족으로 본다', () => {
    const j = evaluateCondition(byId('k2'), scenario.meta.today, scenario.products);
    expect(j.active).toBe(true);
  });
});

describe('실적 확인 상태 — 빈 값을 조용히 충족으로 처리하지 않는다', () => {
  const at = (id: string) => evaluateCondition(byId(id), scenario.meta.today, scenario.products).metricStatus;

  it('실적 값이 있으면 확인됨', () => {
    expect(at('k1')).toBe('verified');
    expect(at('c2')).toBe('verified');
  });

  it('PERMANENT 는 가입 시 확정이라 재판정이 없다', () => {
    expect(at('k2')).toBe('fixed');
    expect(at('c4')).toBe('fixed');
  });

  it('실적 값이 없고 사용자가 확인한 것은 사용자 확인', () => {
    expect(byId('c1').metric.currentValue).toBeUndefined();
    expect(at('c1')).toBe('user');
  });

  it('실적 값이 없고 확인도 없으면 가정 — 라벨이 그렇게 말한다', () => {
    const cond: MappedCondition = {
      ...byId('c1'),
      metric: { ...byId('c1').metric, source: 'doc' },
    };
    expect(metricStatus(cond)).toBe('assumed');
    expect(METRIC_STATUS_LABEL.assumed).toContain('가정');
    // 계산은 그대로 충족으로 두되(값이 없으니), 상태로 드러낸다
    expect(evaluateCondition(cond, scenario.meta.today, scenario.products).active).toBe(true);
  });
});

describe('회복 시점 집계', () => {
  it('회복 불가 건들의 회복 시점 중 가장 늦은 날', () => {
    const judgments = evaluateAll(scenario, targetOf(CARD));
    expect(latestRecoverAt(judgments)).toBe('2027-03-20');
  });
  it('회복 불가 건이 없으면 null', () => {
    const judgments = evaluateAll(scenario, targetOf('loan_change'));
    expect(latestRecoverAt(judgments)).toBeNull();
  });
});

describe('실적 단위', () => {
  it('건수로 세는 실적과 금액 실적을 구분한다', () => {
    expect(metricUnit('autopay_count')).toBe('건');
    expect(metricUnit('card_holding')).toBe('건');
    expect(metricUnit('card_spend')).toBe('원');
    expect(metricUnit('deposit_balance')).toBe('원');
  });
});

describe('MAPPED 가 아닌 조건은 평가하지 않는다', () => {
  it('UNSUPPORTED 는 판정에서 빠진다', () => {
    const ids = scenario.conditions.filter((c) => !isMapped(c)).map((c) => c.id);
    expect(ids).toEqual(['u1', 'u2']);
    const all: ISODate[] = TRIGGER_IDS.flatMap((t) =>
      evaluateAll(scenario, targetOf(t)).map((j) => j.conditionId),
    );
    for (const id of ids) expect(all).not.toContain(id);
  });
});
