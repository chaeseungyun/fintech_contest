import { describe, expect, it } from 'vitest';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, EXPECTED, TRIGGER_IDS } from './fixture.test-helpers';
import { eligibilityOf, hurdleOf, isPreserved, ownBenefitOf, ownCostOf, recommend } from './recommend';
import type { Candidate, Scenario } from './types';
import { candidatesFor, triggerById } from './types';

const scenario = applyEdits(BASE, {});
const INSURANCE = 'insurance_cancel';

const candidate = (id: string) => scenario.candidates!.find((c) => c.id === id)!;
const withCandidates = (candidates: Candidate[]): Scenario => ({ ...scenario, candidates });

describe('expected.recommendation 재현 — 트리거 전부', () => {
  for (const triggerId of TRIGGER_IDS) {
    const e = EXPECTED.triggers[triggerId].recommendation;
    const r = derive(scenario, triggerId).recommendation;

    it(`${triggerId}: 문턱 ${e.hurdle.toLocaleString()} · 추천 ${e.best ?? '없음'}`, () => {
      expect(r.hurdle.value).toBe(e.hurdle);
      expect(r.hurdle.source).toBe('calc');
      expect(r.results.map((x) => x.candidate.id)).toEqual(e.ranked);
      expect(r.best?.candidate.id ?? null).toBe(e.best);
    });

    it(`${triggerId}: 후보별 순손익과 유지되는 연결`, () => {
      const netAfter = Object.fromEntries(r.results.map((x) => [x.candidate.id, x.netAfter.value]));
      const preserved = Object.fromEntries(
        r.results.map((x) => [x.candidate.id, x.preserved.map((l) => l.condition.id)]),
      );
      expect(netAfter).toEqual(e.netAfter);
      expect(preserved).toEqual(e.preserved);
      expect(r.results.every((x) => x.netAfter.source === 'calc')).toBe(true);
    });

    it(`${triggerId}: 순손익 큰 순으로 정렬된다`, () => {
      const values = r.results.map((x) => x.netAfter.value);
      expect(values).toEqual([...values].sort((a, b) => b - a));
    });
  }
});

describe('계산 규칙', () => {
  it('문턱 = max(0, −netAnnual)', () => {
    expect(hurdleOf(-164_000)).toBe(164_000);
    expect(hurdleOf(780_000)).toBe(0);
    expect(hurdleOf(0)).toBe(0);
  });

  it('갈아탄 뒤 순손익 = netAnnual + 유지되는 손실 + 자체 혜택 − 후보 비용', () => {
    const d = derive(scenario, CARD);
    for (const r of d.recommendation.results) {
      expect(r.netAfter.value).toBe(
        d.netAnnual.value + r.preservedLoss.value + r.ownBenefit.value - r.ownCost.value,
      );
    }
    const smart = d.recommendation.results.find((r) => r.candidate.id === 'card_nuri_smart')!;
    // k1 120,000 + k3 24,000 유지, 자체 혜택 5,000×12, 연회비 15,000
    expect(smart.preservedLoss.value).toBe(144_000);
    expect(smart.ownBenefit.value).toBe(60_000);
    expect(smart.ownCost.value).toBe(15_000);
    expect(smart.netAfter.value).toBe(-164_000 + 144_000 + 60_000 - 15_000);
  });

  it('PERMANENT 조건은 후보가 실적을 유지시켜도 살리지 못한다', () => {
    const d = derive(scenario, CARD);
    const k2 = d.items.find((i) => i.condition.id === 'k2')!;
    const smart = candidate('card_nuri_smart');
    expect(smart.satisfies.kinds).toContain(k2.condition.metric.kind);
    expect(isPreserved(k2, smart)).toBe(false);
    const result = d.recommendation.results.find((r) => r.candidate.id === smart.id)!;
    expect(result.broken.map((l) => l.condition.id)).toEqual(['k2']);
  });

  it('자체 혜택이 더 커도 연결이 끊기면 문턱을 못 넘는다 — 한빛 프리미엄', () => {
    const d = derive(scenario, CARD);
    const hanbit = d.recommendation.results.find((r) => r.candidate.id === 'card_hanbit_premium')!;
    const smart = d.recommendation.results.find((r) => r.candidate.id === 'card_nuri_smart')!;
    expect(hanbit.ownBenefit.value).toBeGreaterThan(smart.ownBenefit.value);
    expect(hanbit.ownCost.value).toBeLessThan(smart.ownCost.value);
    expect(hanbit.preserved).toHaveLength(0);
    expect(hanbit.clearsHurdle).toBe(false);
    expect(hanbit.recommended).toBe(false);
    expect(smart.recommended).toBe(true);
  });

  it('후보 비용은 트리거의 savings 규칙을 후보 facts 에 적용한다', () => {
    const card = triggerById(scenario, CARD);
    const ins = triggerById(scenario, INSURANCE);
    expect(ownCostOf(candidate('card_nuri_smart'), card)).toBe(15_000);
    expect(ownCostOf(candidate('card_hanbit_premium'), card)).toBe(0);
    expect(ownCostOf(candidate('ins_nuri_lite'), ins)).toBe(42_000 * 12);
    // 절감 항목이 없는 트리거면 후보 비용도 0
    expect(ownCostOf(candidate('card_nuri_smart'), triggerById(scenario, 'salary_switch'))).toBe(0);
  });

  it('rate_delta 자체 혜택은 변경 대상 상품의 원금에 곱한다', () => {
    const center = scenario.products.find((p) => p.id === 'dep_nuri_term')!;
    const c: Candidate = {
      ...candidate('card_nuri_smart'),
      ownBenefits: [
        { label: '우대금리', effect: { kind: 'rate_delta', value: 0.003 }, sourceText: '', confidence: 0.8 },
      ],
    };
    expect(ownBenefitOf(c, center)).toBe(20_000_000 * 0.003);
    // 원금이 없는 상품(카드)이 중심이면 rate_delta 는 0
    const card = scenario.products.find((p) => p.id === 'card_nuri_tok')!;
    expect(ownBenefitOf(c, card)).toBe(0);
  });
});

describe('파이프라인이 못 채운 경우', () => {
  it('satisfies 가 UNSUPPORTED 면 아무 연결도 유지되지 않고 linkUnknown 이 켜진다', () => {
    const smart = candidate('card_nuri_smart');
    const unknown: Candidate = {
      ...smart,
      satisfies: { status: 'UNSUPPORTED', kinds: [], sourceText: '', unsupportedReason: '범위불명', confidence: 0.3 },
    };
    const d = derive(withCandidates([unknown]), CARD);
    const r = d.recommendation.results[0];
    expect(r.linkUnknown).toBe(true);
    expect(r.preserved).toHaveLength(0);
    expect(r.preservedLoss.value).toBe(0);
    // 보수적으로 계산하니 문턱을 못 넘는다
    expect(r.netAfter.value).toBe(-164_000 + 60_000 - 15_000);
    expect(r.recommended).toBe(false);
    expect(r.basisLabel).toContain('연결 유지 확인 필요');
  });

  it('보험 후보는 satisfies 가 UNSUPPORTED 지만 문턱이 0 이라 추천된다', () => {
    const r = derive(scenario, INSURANCE).recommendation;
    expect(r.hurdle.value).toBe(0);
    expect(r.best?.candidate.id).toBe('ins_nuri_lite');
    expect(r.best?.linkUnknown).toBe(true);
    expect(r.best?.netAfter.value).toBe(780_000 - 42_000 * 12);
  });

  it('자격이 미충족이면 문턱을 넘어도 추천하지 않는다', () => {
    const smart = candidate('card_nuri_smart');
    const unmet: Candidate = {
      ...smart,
      eligibility: { status: 'MAPPED', met: false, sourceText: '' },
    };
    const d = derive(withCandidates([unmet]), CARD);
    const r = d.recommendation.results[0];
    expect(r.clearsHurdle).toBe(true);
    expect(r.eligibility).toBe('unmet');
    expect(r.recommended).toBe(false);
    expect(d.recommendation.best).toBeNull();
  });

  it('자격 판정', () => {
    expect(eligibilityOf(candidate('card_nuri_smart'))).toBe('ok');
    expect(eligibilityOf(candidate('card_hanbit_premium'))).toBe('unknown');
    expect(eligibilityOf({ ...candidate('card_nuri_smart'), eligibility: undefined })).toBe('unknown');
  });

  it('후보가 없으면 결과가 비고 headline 이 그렇게 말한다', () => {
    const r = derive(scenario, 'salary_switch').recommendation;
    expect(candidatesFor(scenario, 'salary_switch')).toHaveLength(0);
    expect(r.results).toHaveLength(0);
    expect(r.best).toBeNull();
    expect(r.headline.body).toContain('등록된 후보 상품이 없습니다');
  });
});

describe('문장', () => {
  it('추천이 있고 문턱이 있으면 "그래도 갈아탄다면"', () => {
    const r = derive(scenario, CARD).recommendation;
    expect(r.headline.title).toBe('그래도 갈아탄다면');
    expect(r.headline.body).toContain('16.4만원');
    expect(r.headline.body).toContain('스마트카드로');
    expect(r.headline.body).toContain('연결 2/3');
    expect(r.headline.body).toContain('2.5만원');
  });

  it('문턱이 0 이면 "해지 후 대체한다면"', () => {
    const r = derive(scenario, INSURANCE).recommendation;
    expect(r.headline.title).toBe('해지 후 대체한다면');
  });

  it('후보는 있지만 아무도 못 넘으면 그렇게 말한다', () => {
    const d = derive(withCandidates([candidate('card_hanbit_premium')]), CARD);
    expect(d.recommendation.best).toBeNull();
    expect(d.recommendation.headline.title).toBe('지금은 갈아탈 만한 상품이 없습니다');
    expect(d.recommendation.headline.body).toContain('후보 1개');
  });

  it('basisLabel 은 유지 연결 수와 비용을 담는다', () => {
    const r = derive(scenario, CARD).recommendation;
    const smart = r.results.find((x) => x.candidate.id === 'card_nuri_smart')!;
    const hanbit = r.results.find((x) => x.candidate.id === 'card_hanbit_premium')!;
    expect(smart.basisLabel).toBe('연결 2/3 유지 · 연회비 1.5만원 · 자체 혜택 연 6만원');
    expect(hanbit.basisLabel).toBe('연결 0/3 유지 · 연회비 없음 · 자체 혜택 연 12만원');
  });
});

describe('체크리스트 연동', () => {
  it('연결을 살리는 후보가 있으면 실행 순서 항목이 붙는다 — 고르기 전에는 "예를 들어" 로 적는다', () => {
    const d = derive(scenario, CARD);
    const item = d.checklist.find((c) => c.key === 'switch-order')!;
    expect(item).toBeDefined();
    expect(item.text).toBe('예를 들어 스마트카드를 먼저 만든 뒤 9월 30일 이후에 톡톡카드를 해지하면 연결 2건이 유지됩니다.');
    expect(item.source).toBe('calc');
  });

  it('후보를 고르면 그 안을 "선택한" 으로 적는다', () => {
    const d = derive(scenario, CARD, { chosenCandidateId: 'card_nuri_smart' });
    const item = d.checklist.find((c) => c.key === 'switch-order')!;
    expect(item.text.startsWith('선택한 스마트카드를')).toBe(true);
  });

  it('추천 문구는 "추천합니다" 대신 이득 표시와 직접 고름을 말한다', () => {
    const r = derive(scenario, CARD).recommendation;
    expect(r.headline.body).toContain("'이득'");
    expect(r.headline.body).toContain('직접 고릅니다');
    expect(r.headline.body).not.toContain('추천합니다');
  });

  it('유지되는 연결이 없으면 순서 항목이 없다', () => {
    const d = derive(scenario, INSURANCE);
    expect(d.checklist.find((c) => c.key === 'switch-order')).toBeUndefined();
  });
});

describe('수정 → 재계산', () => {
  it('카드 실적 기준을 올려 k1 이 미적용이 되면 유지 목록에서도 빠진다', () => {
    const d = derive(applyEdits(BASE, { k1: { threshold: 900_000 } }), CARD);
    const smart = d.recommendation.results.find((r) => r.candidate.id === 'card_nuri_smart')!;
    expect(smart.preserved.map((l) => l.condition.id)).toEqual(['k3']);
    expect(d.recommendation.linkCount).toBe(2);
    // k1 은 손실에서도 빠지고 유지분에서도 빠져 순손익은 같다
    expect(smart.netAfter.value).toBe(25_000);
  });

  it('조건을 지우면 연결 수가 줄어든다', () => {
    const d = derive(applyEdits(BASE, {}, ['k3']), CARD);
    expect(d.recommendation.linkCount).toBe(2);
    const smart = d.recommendation.results.find((r) => r.candidate.id === 'card_nuri_smart')!;
    expect(smart.basisLabel).toContain('연결 1/2 유지');
  });

  it('순수 함수: 같은 입력이면 같은 결과', () => {
    const d = derive(scenario, CARD);
    const input = {
      trigger: d.trigger,
      center: d.center,
      links: d.items,
      netAnnual: d.netAnnual.value,
      candidates: candidatesFor(scenario, CARD),
    };
    expect(recommend(input)).toEqual(recommend(input));
  });
});
