// 테스트가 공유하는 기대치 읽기. 화면 코드에서는 쓰지 않는다.

import fixture from '../fixtures/scenario.json';
import type { ISODate, Scenario } from './types';

export const BASE = fixture as unknown as Scenario;

export interface TriggerExpectation {
  annualLossByProduct: Record<string, number>;
  annualLossTotal: number;
  savingsTotal: number;
  netAnnual: number;
  nextJudgmentDates: Record<string, ISODate | null>;
  safeAfter: ISODate;
  unrecoverable: { conditionId: string; until: ISODate }[];
  horizon: number[];
  recommendedMonths: number;
  verdict: 'keep' | 'switch';
}

export interface Expectation {
  totalAssets: number;
  horizonMonths: number[];
  triggers: Record<string, TriggerExpectation>;
}

export const EXPECTED = (fixture as unknown as { expected: Expectation }).expected;

export const TRIGGER_IDS = Object.keys(EXPECTED.triggers);

/** 급여통장 변경 — 팀이 계산 규칙을 확정할 때 기준으로 삼은 시나리오 */
export const SALARY = 'salary_switch';
/** 카드 해지 — 시안의 주력 시나리오 */
export const CARD = 'card_cancel';
