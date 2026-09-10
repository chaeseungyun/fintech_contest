// 사용자 수정을 기본 시나리오에 입히는 순수 함수.
// 수정된 값은 provenance 가 'user' 로 바뀐다 — 태그는 값과 같은 객체에 산다.

import type { Condition, MappedCondition, Provenance, Scenario, Source } from './types';
import { isMapped } from './types';

export interface ConditionEdit {
  /** binds.effect.value 를 덮어쓴다 (금리차는 부호 포함 소수, 월 혜택은 원) */
  effectValue?: number;
  /** RECUR.from / COUNT.checkOn / ROLLING.settleOn 의 dayOfMonth */
  dayOfMonth?: number;
  /** metric.threshold */
  threshold?: number;
}

export type Edits = Record<string, ConditionEdit>;

function baseProvenance(c: MappedCondition): Provenance {
  const threshold: Source = c.metric.source === 'user_confirmed' ? 'user' : 'doc';
  return { effect: 'doc', cycle: 'doc', threshold };
}

export function applyEditsToCondition(cond: Condition, edit: ConditionEdit | undefined): Condition {
  if (!isMapped(cond)) return cond;
  const provenance = baseProvenance(cond);
  if (!edit) return { ...cond, provenance };

  const next: MappedCondition = {
    ...cond,
    expr: { ...cond.expr, params: { ...cond.expr.params } },
    metric: { ...cond.metric },
    binds: { ...cond.binds, effect: { ...cond.binds.effect } },
    provenance,
  };

  if (edit.effectValue !== undefined) {
    next.binds.effect.value = edit.effectValue;
    provenance.effect = 'user';
  }
  if (edit.dayOfMonth !== undefined) {
    const p = next.expr.params;
    const key = next.expr.op === 'RECUR' ? 'from' : next.expr.op === 'COUNT' ? 'checkOn' : 'settleOn';
    p[key] = { anchor: 'judgment_day', dayOfMonth: edit.dayOfMonth };
    provenance.cycle = 'user';
  }
  if (edit.threshold !== undefined) {
    next.metric.threshold = edit.threshold;
    provenance.threshold = 'user';
  }
  return next;
}

/** 기본 시나리오 + 수정 + 삭제된 조건 → 화면이 읽는 유효 시나리오 */
export function applyEdits(base: Scenario, edits: Edits, removed: string[] = []): Scenario {
  const gone = new Set(removed);
  return {
    ...base,
    conditions: base.conditions
      .filter((c) => !gone.has(c.id))
      .map((c) => applyEditsToCondition(c, edits[c.id])),
  };
}
