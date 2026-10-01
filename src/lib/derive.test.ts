import { describe, expect, it } from 'vitest';
import { CUSTOM_CARD_ID, derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, DEPOSIT, EXPECTED, SALARY, TRIGGER_IDS } from './fixture.test-helpers';
import { formatWonShort } from './format';
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
      // 나눠 쓰기는 "무엇을" 이 옮기는 금액과 카드다 — "톡톡카드 월 20만원 → 다른 카드"
      const name = d.center.shortName ?? d.center.name;
      expect(d.basis.change).toBe(
        d.split ? `${name} 월 ${formatWonShort(d.split.moved.value)} → 다른 카드` : `${name} ${d.trigger.verb}`,
      );
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
  it('첫 단계는 "추출해 둔" 조건을 불러오는 것 — 방금 읽는 것처럼 쓰지 않는다', () => {
    const d = derive(scenario, CARD);
    expect(d.steps[0].label).toContain('추출해 둔');
    expect(d.steps.map((s) => s.label).join(' ')).not.toMatch(/실시간|AI가 읽/);
  });
});

describe('관리비 계좌 납부 — 제안서 4쪽 실제 사례', () => {
  const MGMT = 'mgmt_fee_account';
  const e = EXPECTED.triggers[MGMT];
  const d = derive(applyEdits(BASE, {}), MGMT);

  it('3개월 기준 +6,096원 = 대출 이자 절감 9,500 − 카드 적립 3,404', () => {
    const three = d.horizon.points.find((p) => p.months === 3)!;
    // 차트는 "지금 바꾸는 것 대비 유지" 값이라 부호가 반대다 — 3개월 더 카드로 내면 6,096원 손해
    expect(-three.value.value).toBe(e.threeMonths);
    expect(Math.round((d.savingsTotal.value * 3) / 12)).toBe(9_500);
    expect(Math.round((d.total.value * 3) / 12)).toBe(3_404);
  });

  it('얻는 쪽은 대출 자동납부 우대(a1), 달마다 쌓이는 절감이다', () => {
    expect(d.savings.map((s) => [s.key, s.accrual])).toEqual([['gain-a1', 'monthly']]);
    expect(d.savings[0].annualAmount.value).toBe(38_000_000 * 0.001);
  });

  it('카드 이용금액이 80만 → 약 63.8만원이 돼도 60만 구간이라 카드 실적 우대는 유지된다', () => {
    const shifted = d.items.filter((i) => i.shift);
    expect(shifted.map((i) => i.condition.id).sort()).toEqual(['c2', 'k1', 'k1b', 'w1']);
    expect(shifted.every((i) => i.shift!.kept && i.effectiveLoss.value === 0)).toBe(true);
    expect(shifted[0].shift!.after).toBe(800_000 - 162_103);
    expect(d.verdict.kind).toBe('switch');
  });

  it('60만 구간 기준을 70만으로 올리면 0.1%p 를 잃어 계좌 납부가 불리해진다 (제안서의 −3,404원 경우)', () => {
    const lost = derive(applyEdits(BASE, { k1b: { threshold: 700_000 } }), MGMT);
    const tier = lost.items.find((i) => i.condition.id === 'k1b')!;
    expect(tier.shift!.kept).toBe(false);
    expect(tier.effectiveLoss.value).toBe(38_000);
    expect(lost.netAnnual.value).toBe(e.netAnnual - 38_000);
    expect(-lost.horizon.points.find((p) => p.months === 3)!.value.value).toBe(-3_404);
    expect(lost.verdict.kind).toBe('keep');
  });

  it('실행 안내: 신청 전에 자동납부 2건 인정과 가장 빠듯한 카드 실적 기준(60만)을 확인한다', () => {
    const keys = d.actionPlan.steps.map((s) => s.key);
    expect(keys).toEqual(['confirm', 'execute']);
    const confirm = d.actionPlan.steps[0];
    expect(confirm.bullets).toHaveLength(2);
    expect(confirm.bullets[0]).toContain('지금 1건');
    expect(confirm.bullets[1]).toContain(`여유 ${formatWonShort(800_000 - 162_103 - 600_000)}`);
    expect(confirm.contact?.ask.join(' ')).toContain('2건');
  });

  it('카드 적립은 결제할 때마다 쌓여 기다릴 이유가 없다 — 변경 가능 구간을 만들지 않는다', () => {
    expect(d.timing.alreadySafe).toBe(true);
    expect(d.actionPlan.steps.some((s) => s.key === 'wait')).toBe(false);
  });
});

describe('다른 카드와 나눠 쓰기 — 필요한 실적만 남기기 (v35 9쪽 · 제안서 6쪽)', () => {
  const SPLIT = 'card_split';
  const hanbit = { keep: 'needed' as const, toCardId: 'card_hanbit_premium' };

  it('옮겨 갈 카드를 고르기 전에는 보류 — 앱이 카드를 대신 고르지 않는다', () => {
    const d = derive(scenario, SPLIT);
    expect(d.verdict.kind).toBe('pending');
    expect(d.missing).toContain('옮겨 갈 카드');
    expect(d.split!.dest).toBeNull();
  });

  it('필요한 만큼 = 걸린 카드 실적 기준 중 가장 큰 값(60만). 80만 중 20만을 옮겨도 조건은 전부 유지', () => {
    const d = derive(scenario, SPLIT, { split: hanbit });
    expect(d.split!.needed.value).toBe(600_000);
    expect(d.split!.moved.value).toBe(200_000);
    expect(d.items.every((i) => i.shift?.kept)).toBe(true);
    // 20만 × (1.2% − 0.7%) × 12
    expect(d.netAnnual.value).toBe(12_000);
    expect(d.verdict.kind).toBe('switch');
  });

  it('전부 옮기면 대출·캐시백 실적 조건을 잃어 불리 — 상한이 걸린 신용대출은 실제분만', () => {
    const d = derive(scenario, SPLIT, { split: { ...hanbit, keep: 'all' } });
    expect(d.items.filter((i) => i.effectiveLoss.value > 0).map((i) => i.condition.id).sort()).toEqual([
      'c2',
      'k1',
      'k1b',
      'w1',
    ]);
    expect(d.capAdjustments.map((c) => c.amount.value)).toEqual([114_000]);
    expect(d.netAnnual.value).toBe(800_000 * 0.005 * 12 - (240_000 + 152_000 + 38_000 + 38_000 - 114_000));
    expect(d.verdict.kind).toBe('keep');
    expect(d.verdict.highlight).toContain('지금처럼 모아 쓰는 것이');
  });

  it('새로 만들 카드의 연회비는 해마다 나가는 비용으로 뺀다', () => {
    const d = derive(scenario, SPLIT, { split: { ...hanbit, toCardId: 'card_nuri_smart' } });
    expect(d.savings.map((s) => [s.key, s.annualAmount.value, s.accrual])).toEqual([
      ['split-reward', 200_000 * 0.003 * 12, 'monthly'],
      ['split-fee', -15_000, 'annual'],
    ]);
  });

  it('직접 입력한 카드는 사용자 확인 태그로 계산되고, 우대 실적으로는 인정되지 않는다', () => {
    const customCard = { name: '로카카드', rewardRate: 0.012, annualFee: 0 };
    const d = derive(scenario, SPLIT, { split: { keep: 'needed', toCardId: CUSTOM_CARD_ID }, customCard });
    expect(d.split!.dest!.name).toBe('로카카드');
    expect(d.split!.dest!.rewardRate.source).toBe('user');
    expect(d.netAnnual.value).toBe(12_000);
    // 입력한 카드가 없으면 그 id 를 골라도 보류
    expect(derive(scenario, SPLIT, { split: { keep: 'needed', toCardId: CUSTOM_CARD_ID } }).verdict.kind).toBe('pending');
  });

  it('직접 입력 카드의 실적 기준에 못 미치면 적립이 없고, 월 한도가 있으면 거기까지만 센다', () => {
    const base = { name: '로카카드', rewardRate: 0.012, annualFee: 0 };
    const pick = { split: { keep: 'needed' as const, toCardId: CUSTOM_CARD_ID } };
    // 옮기는 금액 20만 < 실적 기준 30만 → 적립 0, 톡톡카드 적립 0.7% 만 잃는다
    const under = derive(scenario, SPLIT, { ...pick, customCard: { ...base, minSpend: 300_000 } });
    expect(under.savings[0].annualAmount.value).toBe(-Math.round(200_000 * 0.007 * 12));
    expect(under.savings[0].basisLabel).toContain('적립 없음');
    // 월 한도 1,000원 < 20만 × 1.2% = 2,400원
    const capped = derive(scenario, SPLIT, { ...pick, customCard: { ...base, monthlyCap: 1_000 } });
    expect(capped.savings[0].annualAmount.value).toBe(Math.round((1_000 - 200_000 * 0.007) * 12));
  });

  it('대출 실적 인정을 "인정" 으로 넣으면 전부 옮겨도 대출 카드 우대는 유지 — 카드 자체 혜택은 여전히 잃는다', () => {
    const customCard = { name: '로카카드', rewardRate: 0.012, annualFee: 0, loanRecognized: 'yes' as const };
    const d = derive(scenario, SPLIT, { split: { keep: 'all', toCardId: CUSTOM_CARD_ID }, customCard });
    const lost = d.items.filter((i) => i.effectiveLoss.value > 0).map((i) => i.condition.id);
    expect(lost).toEqual(['c2']);
    const k1 = d.items.find((i) => i.condition.id === 'k1')!;
    expect(k1.shift!.recognized).toBe(true);
    expect(k1.effectiveLoss.source).toBe('user');
    expect(d.actionPlan.steps.find((s) => s.key === 'confirm')!.bullets[0]).toContain('직접 입력한 값');
    // 모르면 인정하지 않는 쪽으로 계산한다
    const unknown = derive(scenario, SPLIT, {
      split: { keep: 'all', toCardId: CUSTOM_CARD_ID },
      customCard: { ...customCard, loanRecognized: 'unknown' },
    });
    expect(unknown.items.filter((i) => i.effectiveLoss.value > 0).length).toBe(4);
  });

  it('직접 입력 금액은 0 ~ 지금 사용액 사이로 자른다', () => {
    expect(derive(scenario, SPLIT, { split: { ...hanbit, keep: 5_000_000 } }).split!.kept.value).toBe(800_000);
    expect(derive(scenario, SPLIT, { split: { ...hanbit, keep: -1 } }).split!.kept.value).toBe(0);
  });
});
