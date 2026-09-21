import { describe, expect, it } from 'vitest';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, DEPOSIT, EXPECTED, SALARY, TRIGGER_IDS } from './fixture.test-helpers';
import { requirementLabel } from './interpreter';

const scenario = applyEdits(BASE, {});
const INSURANCE = 'insurance_cancel';
const LOAN = 'loan_change';

describe('비교 결과 — 핵심 입력이 빠지면 결론을 내지 않는다', () => {
  it('missing 이 있는 트리거는 pending 이고, 무엇이 빠졌는지 헤드라인에 적는다', () => {
    for (const id of [LOAN, DEPOSIT, SALARY]) {
      const d = derive(scenario, id);
      expect(d.missing.length).toBeGreaterThan(0);
      expect(d.verdict.kind).toBe('pending');
      expect(d.verdict.highlight).toContain('비교할 수 없습니다');
      expect(d.verdict.body).toContain(d.missing[0]);
      // 손실 쪽 소계는 그대로 계산한다 — 확인된 항목의 변화 소계
      expect(d.netAnnual.value).toBe(EXPECTED.triggers[id].netAnnual);
    }
  });

  it('missing 이 없는 트리거는 keep/switch 로 판정하고 "확인된 조건에서는" 으로 한정한다', () => {
    const card = derive(scenario, CARD);
    expect(card.missing).toEqual([]);
    expect(card.verdict.kind).toBe('keep');
    expect(card.verdict.lead).toBe('확인된 조건에서는');

    const ins = derive(scenario, INSURANCE);
    expect(ins.verdict.kind).toBe('switch');
    expect(ins.verdict.lead).toBe('확인된 조건에서는');
  });

  it('missing 을 비우면 같은 숫자로 keep 이 된다 — 보류는 데이터가 결정한다', () => {
    const cleared = {
      ...scenario,
      triggers: scenario.triggers.map((t) => (t.id === LOAN ? { ...t, missing: [] } : t)),
    };
    const d = derive(cleared, LOAN);
    expect(d.verdict.kind).toBe('keep');
    expect(d.netAnnual.value).toBe(derive(scenario, LOAN).netAnnual.value);
  });
});

describe('비교 기준 — 금액 옆에 항상 붙는 값', () => {
  for (const id of TRIGGER_IDS) {
    it(`${id}: 무엇 vs 무엇 · 기간 · 기준일 · 가정`, () => {
      const d = derive(scenario, id);
      expect(d.basis.change).toBe(`${d.center.shortName ?? d.center.name} ${d.trigger.verb}`);
      expect(d.basis.versus).toBe('그대로 유지');
      expect(d.basis.period).toBe('연 기준');
      expect(d.basis.asOf).toBe(scenario.meta.today);
      expect(d.basis.assumption.length).toBeGreaterThan(0);
    });
  }
});

describe('유지 조건 목록 — 절차가 아니라 조건이다', () => {
  it('살아있는 조건마다 실적 기준과 판정 주기를 한 줄로 낸다', () => {
    const d = derive(scenario, CARD);
    expect(d.maintain).toHaveLength(d.items.filter((i) => i.judgment.active).length);
    for (const i of d.items.filter((x) => x.judgment.active)) {
      const row = d.maintain.find((m) => m.key === `keep-${i.condition.id}`)!;
      expect(row.text).toContain(requirementLabel(i.condition));
      expect(row.text).toContain(i.judgment.cycleLabel.value);
    }
  });

  it('실적 미달로 꺼진 조건은 유지 조건에 없다', () => {
    const raised = applyEdits(BASE, { k1: { threshold: 900_000 } });
    const d = derive(raised, CARD);
    expect(d.maintain.some((m) => m.key === 'keep-k1')).toBe(false);
  });
});

describe('분석 진행 단계 — 연출과 구현을 구분한다', () => {
  it('첫 단계는 "불러오기" 이고 실시간 추출이 없다고 적는다', () => {
    const d = derive(scenario, CARD);
    expect(d.steps[0].label).toContain('추출해 둔');
    expect(d.steps[0].detail).toContain('실시간 추출 없음');
    expect(d.steps[0].detail).toContain('샘플');
  });
});
