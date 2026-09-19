import { describe, expect, it } from 'vitest';
import { addonCostOf, addonOwnBenefitOf, addonProposals, evaluateAddon, inactiveConditions } from './addon';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, EXPECTED, SALARY, TRIGGER_IDS } from './fixture.test-helpers';
import type { Candidate } from './types';
import { addonCandidates, candidatesFor, candidateMode } from './types';

const scenario = applyEdits(BASE, {});
const E = EXPECTED.addons;
const candidate = (id: string) => scenario.candidates!.find((c) => c.id === id) as Candidate;

describe('expected.addons 재현', () => {
  const p = addonProposals(scenario);

  it(`순이득 큰 순으로 ${E.ranked.join(', ')}`, () => {
    expect(p.results.map((r) => r.candidate.id)).toEqual(E.ranked);
    const values = p.results.map((r) => r.netGain.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('후보별 연 순이득', () => {
    const netGain = Object.fromEntries(p.results.map((r) => [r.candidate.id, r.netGain.value]));
    expect(netGain).toEqual(E.netGain);
    expect(p.results.every((r) => r.netGain.source === 'calc')).toBe(true);
  });

  it('되살아나는 조건', () => {
    const unlocked = Object.fromEntries(
      p.results.map((r) => [r.candidate.id, r.unlocked.map((u) => u.condition.id)]),
    );
    expect(unlocked).toEqual(E.unlocked);
  });

  it('기본 시나리오에는 실적 미달 조건이 없다', () => {
    expect(p.inactiveCount).toBe(0);
    expect(inactiveConditions(scenario)).toEqual([]);
  });
});

describe('트리거 화면에 뜨는 후보 — 변경 대상과 같은 종류는 뺀다', () => {
  for (const triggerId of TRIGGER_IDS) {
    it(`${triggerId}: ${E.byTrigger[triggerId].join(', ') || '없음'}`, () => {
      const d = derive(scenario, triggerId);
      expect(d.addons.results.map((r) => r.candidate.id)).toEqual(E.byTrigger[triggerId]);
      expect(d.addons.results.every((r) => r.candidate.type !== d.center.type)).toBe(true);
    });
  }

  it('카드 해지 화면에는 카드 연계 후보가 뜨지 않는다', () => {
    const ids = derive(scenario, CARD).addons.results.map((r) => r.candidate.id);
    expect(ids).not.toContain('card_nuri_life');
  });

  it('급여통장 변경 화면에는 통장 연계 후보가 뜨지 않는다', () => {
    const ids = derive(scenario, SALARY).addons.results.map((r) => r.candidate.id);
    expect(ids).not.toContain('acct_nuri_plus');
  });
});

describe('계산 규칙', () => {
  it('자체 혜택 = 월 금액 × 12', () => {
    expect(addonOwnBenefitOf(candidate('card_nuri_life'))).toBe((5000 + 3000) * 12);
    expect(addonOwnBenefitOf(candidate('acct_nuri_plus'))).toBe((2000 + 1000) * 12);
  });

  it('비용 = 연회비 + 월 보험료 × 12', () => {
    expect(addonCostOf(candidate('card_nuri_life'))).toBe(12_000);
    expect(addonCostOf(candidate('acct_nuri_plus'))).toBe(0);
  });

  it('순이득 = 되살아나는 혜택 + 자체 혜택 − 비용', () => {
    const r = evaluateAddon(candidate('card_nuri_life'), scenario);
    expect(r.netGain.value).toBe(r.unlockedGain.value + r.ownBenefit.value - r.ownCost.value);
    expect(r.recommended).toBe(true);
  });

  it('실적이 미달로 떨어지면 그 조건을 되살리는 값이 순이득에 들어간다', () => {
    // 카드 실적 기준을 올려 k1(주담대 0.2%p)을 미적용으로 만든다
    const edited = applyEdits(BASE, { k1: { threshold: 900_000 } });
    const before = evaluateAddon(candidate('card_nuri_life'), scenario);
    const after = evaluateAddon(candidate('card_nuri_life'), edited);

    expect(before.unlocked).toHaveLength(0);
    expect(after.unlocked.map((u) => u.condition.id)).toEqual(['k1']);
    expect(after.unlockedGain.value).toBe(60_000_000 * 0.002);
    expect(after.netGain.value).toBe(before.netGain.value + 120_000);
  });

  it('satisfies 가 UNSUPPORTED 면 아무 조건도 되살리지 못한다', () => {
    const blind: Candidate = {
      ...candidate('card_nuri_life'),
      satisfies: { ...candidate('card_nuri_life').satisfies, status: 'UNSUPPORTED', kinds: [] },
    };
    const edited = applyEdits(BASE, { k1: { threshold: 900_000 } });
    expect(evaluateAddon(blind, edited).unlocked).toHaveLength(0);
  });

  it('순이득이 0 이하면 제안하지 않는다', () => {
    const pricey: Candidate = { ...candidate('acct_nuri_plus'), facts: { annualFee: 40_000 } };
    const r = evaluateAddon(pricey, scenario);
    expect(r.netGain.value).toBe(36_000 - 40_000);
    expect(r.recommended).toBe(false);
  });

  it('자격 미충족이면 순이득이 커도 제안하지 않는다', () => {
    const blocked: Candidate = {
      ...candidate('card_nuri_life'),
      eligibility: { status: 'MAPPED', met: false, sourceText: '발급 제한' },
    };
    const r = evaluateAddon(blocked, scenario);
    expect(r.netGain.value).toBeGreaterThan(0);
    expect(r.recommended).toBe(false);
  });
});

describe('replace 와 add 는 섞이지 않는다', () => {
  it('add 후보는 갈아타기 후보 목록에 들어가지 않는다', () => {
    for (const triggerId of TRIGGER_IDS) {
      const ids = candidatesFor(scenario, triggerId).map((c) => c.id);
      expect(ids).not.toContain('card_nuri_life');
      expect(ids).not.toContain('acct_nuri_plus');
    }
  });

  it('replace 후보는 연계 제안 목록에 들어가지 않는다', () => {
    const ids = addonCandidates(scenario).map((c) => c.id);
    expect(ids).toEqual(['card_nuri_life', 'acct_nuri_plus']);
    expect(ids).not.toContain('card_nuri_smart');
  });

  it('mode 가 없으면 replace 로 본다', () => {
    expect(candidateMode({ ...candidate('card_nuri_life'), mode: undefined })).toBe('replace');
  });
});
