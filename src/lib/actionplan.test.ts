import { describe, expect, it } from 'vitest';
import { toContact } from './actionplan';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, DEPOSIT, EXPECTED, TRIGGER_IDS } from './fixture.test-helpers';
import { formatKoMD } from './format';

const scenario = applyEdits(BASE, {});
const INSURANCE = 'insurance_cancel';
const product = (id: string) => scenario.products.find((p) => p.id === id)!;
const keys = (triggerId: string) => derive(scenario, triggerId).actionPlan.steps.map((s) => s.key);

describe('판단과 실행 안내는 같은 방향을 본다', () => {
  for (const triggerId of TRIGGER_IDS) {
    const d = derive(scenario, triggerId);
    it(`${triggerId}: 판단 ${d.verdict.kind} → 안내 ${d.actionPlan.kind}`, () => {
      expect(d.actionPlan.kind).toBe(EXPECTED.triggers[triggerId].verdict);
      expect(d.actionPlan.steps.length).toBeGreaterThan(0);
      expect(d.actionPlan.title).toContain(d.center.shortName ?? d.center.name);
    });
  }
});

describe('유지 판단의 안내', () => {
  const plan = derive(scenario, CARD).actionPlan;

  it('그대로 두기 → 지킬 조건 → 다시 볼 시점 → 그래도 바꾼다면', () => {
    expect(keys(CARD)).toEqual(['keep-decide', 'keep-rules', 'keep-review', 'keep-alt']);
  });

  it('지킬 조건은 살아있는 연결만큼 나온다', () => {
    const d = derive(scenario, CARD);
    const rules = plan.steps.find((s) => s.key === 'keep-rules')!;
    expect(rules.bullets).toHaveLength(d.items.filter((i) => i.judgment.active).length);
  });

  it('그래도 바꾼다면 — 새 상품 먼저, 판정일 이후, 그다음 해지 순서다', () => {
    const alt = plan.steps.find((s) => s.key === 'keep-alt')!;
    const newFirst = alt.bullets.findIndex((b) => b.includes('먼저 만듭니다'));
    const wait = alt.bullets.findIndex((b) => b.includes('판정이 끝난 뒤'));
    const act = alt.bullets.findIndex((b) => b.includes('해지 신청'));
    expect(newFirst).toBeGreaterThanOrEqual(0);
    expect(newFirst).toBeLessThan(wait);
    expect(wait).toBeLessThan(act);
  });

  it('기한은 안전 시점에서 온다 — 문구에 날짜를 적지 않는다', () => {
    const d = derive(scenario, CARD);
    const alt = plan.steps.find((s) => s.key === 'keep-alt')!;
    expect(alt.when?.value).toBe(d.timing.safeFrom.value);
    expect(alt.whenLabel).toBe(`${formatKoMD(d.timing.safeAfter.value)} 이후`);
  });

  it('회복 불가 항목을 빠뜨리지 않는다', () => {
    const d = derive(scenario, CARD);
    const alt = plan.steps.find((s) => s.key === 'keep-alt')!;
    for (const u of d.unrecoverable) {
      expect(alt.bullets.some((b) => b.includes(u.product.shortName ?? u.product.name))).toBe(true);
    }
  });
});

describe('변경 판단의 안내', () => {
  it('새 상품 발급이 해지보다 먼저 온다', () => {
    const k = keys(INSURANCE);
    expect(k.indexOf('new-first')).toBeGreaterThanOrEqual(0);
    expect(k.indexOf('new-first')).toBeLessThan(k.indexOf('execute'));
  });

  it('이번 달 판정이 남아 있으면 기다리는 단계가 들어간다', () => {
    const d = derive(scenario, INSURANCE);
    expect(d.timing.alreadySafe).toBe(false);
    const k = keys(INSURANCE);
    expect(k).toContain('wait');
    expect(k.indexOf('wait')).toBeLessThan(k.indexOf('execute'));
  });

  it('실행 단계는 변경 대상 금융사 창구를 단다', () => {
    const d = derive(scenario, INSURANCE);
    const exec = d.actionPlan.steps.find((s) => s.key === 'execute')!;
    expect(exec.contact?.institution).toBe(d.center.institution);
    expect(exec.contact?.dept).toBe(product('ins_nuri_care').contact!.dept);
  });
});

describe('중도해지 이자는 안내에도 남는다', () => {
  it('예·적금 해지는 유지 판단이지만 일회성 손실을 그래도 적는다', () => {
    const d = derive(scenario, DEPOSIT);
    const alt = d.actionPlan.steps.find((s) => s.key === 'keep-alt')!;
    expect(d.earlyTermination).not.toBeNull();
    expect(alt.bullets.some((b) => b.includes('중도해지 이자'))).toBe(true);
  });

  it('중도해지 손실이 없는 시나리오에는 그 문구가 없다', () => {
    const alt = derive(scenario, CARD).actionPlan.steps.find((s) => s.key === 'keep-alt')!;
    expect(alt.bullets.some((b) => b.includes('중도해지'))).toBe(false);
  });
});

describe('연락처는 데이터에서만 온다', () => {
  it('없는 번호를 지어내지 않는다', () => {
    for (const triggerId of TRIGGER_IDS) {
      const plan = derive(scenario, triggerId).actionPlan;
      for (const step of plan.steps) {
        if (step.contact) expect(step.contact.tel).toBeNull();
      }
      expect(plan.telMissing).toBe(true);
      expect(plan.notes.some((n) => n.includes('대표번호'))).toBe(true);
    }
  });

  it('창구 정보가 없는 상품은 연락처 칸도 없다', () => {
    expect(toContact('누리은행', undefined)).toBeNull();
  });

  it('창구 정보는 상품 데이터를 그대로 옮긴다', () => {
    const c = product('card_nuri_tok').contact!;
    expect(toContact('누리카드', c)).toEqual({
      institution: '누리카드',
      dept: c.dept,
      channels: c.channels,
      hours: c.hours,
      tel: null,
      ask: c.ask,
    });
  });

  it('창구에서 물어볼 것이 비어 있지 않다', () => {
    const exec = derive(scenario, CARD).actionPlan.steps.find((s) => s.contact !== null)!;
    expect(exec.contact!.ask.length).toBeGreaterThan(0);
  });
});

describe('안내는 새로 계산하지 않는다', () => {
  it('모든 기한은 derive 가 이미 낸 날짜다', () => {
    for (const triggerId of TRIGGER_IDS) {
      const d = derive(scenario, triggerId);
      const known = new Set(
        [d.timing.safeFrom.value, d.timing.safeAfter.value, ...d.items.map((i) => i.judgment.nextJudgmentDate.value)]
          .filter((x): x is string => x !== null),
      );
      for (const step of d.actionPlan.steps) {
        if (step.when && step.key !== 'keep-review') expect(known.has(step.when.value)).toBe(true);
      }
    }
  });

  it('모든 단계에 출처 태그가 붙는다', () => {
    for (const triggerId of TRIGGER_IDS) {
      for (const step of derive(scenario, triggerId).actionPlan.steps) {
        expect(['doc', 'calc', 'holding', 'user']).toContain(step.source);
      }
    }
  });
});
