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
  recommendation: RecommendationExpectation;
}

export interface RecommendationExpectation {
  hurdle: number;
  /** 갈아탄 뒤 순손익 큰 순 */
  ranked: string[];
  netAfter: Record<string, number>;
  preserved: Record<string, string[]>;
  best: string | null;
}

export interface EarlyTerminationExpectation {
  fullDays: number;
  elapsedDays: number;
  fullInterest: number;
  earlyInterest: number;
  loss: number;
}

export interface AddonsExpectation {
  /** 연 순이득 큰 순 */
  ranked: string[];
  netGain: Record<string, number>;
  /** 후보가 되살리는 조건 id */
  unlocked: Record<string, string[]>;
  /** 트리거 화면에 뜨는 후보 — 변경 대상과 같은 종류는 빠진다 */
  byTrigger: Record<string, string[]>;
}

export interface Expectation {
  totalAssets: number;
  horizonMonths: number[];
  earlyTermination: Record<string, EarlyTerminationExpectation>;
  addons: AddonsExpectation;
  triggers: Record<string, TriggerExpectation>;
}

export const EXPECTED = (fixture as unknown as { expected: Expectation }).expected;

export const TRIGGER_IDS = Object.keys(EXPECTED.triggers);

/** 급여통장 변경 — 팀이 계산 규칙을 확정할 때 기준으로 삼은 시나리오 */
export const SALARY = 'salary_switch';
/** 카드 해지 — 시안의 주력 시나리오 */
export const CARD = 'card_cancel';
/** 예·적금 해지 — 중도해지 이자가 붙는 유일한 시나리오 */
export const DEPOSIT = 'deposit_cancel';
