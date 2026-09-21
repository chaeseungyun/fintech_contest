import { describe, expect, it } from 'vitest';
import { planBasisLabel, toContact } from './actionplan';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, DEPOSIT, EXPECTED, TRIGGER_IDS } from './fixture.test-helpers';
import { formatKoMD, formatMD } from './format';

const scenario = applyEdits(BASE, {});
const INSURANCE = 'insurance_cancel';
const LOAN = 'loan_change';
const SMART = 'card_nuri_smart';
const LITE = 'ins_nuri_lite';
const product = (id: string) => scenario.products.find((p) => p.id === id)!;
const keys = (triggerId: string, chosenCandidateId: string | null = null) =>
  derive(scenario, triggerId, { chosenCandidateId }).actionPlan.steps.map((s) => s.key);

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

describe('절차의 기준 안은 사용자가 고른다 — 앱이 고른 추천으로 절차를 짜지 않는다', () => {
  it('고르지 않았으면 "새 상품 없이" 이고 새 상품 단계가 없다', () => {
    const d = derive(scenario, CARD);
    expect(d.chosen).toBeNull();
    expect(d.actionPlan.basis).toBe('새 상품 없이 해지');
    expect(keys(CARD)).not.toContain('new-first');
    expect(keys(CARD)).not.toContain('move-metrics');
    // 추천(best)이 있어도 절차는 그것을 따르지 않는다
    expect(d.recommendation.best?.candidate.id).toBe(SMART);
  });

  it('후보를 고르면 그 후보의 발급·인정 확인 단계가 맨 앞에 온다', () => {
    const d = derive(scenario, CARD, { chosenCandidateId: SMART });
    expect(d.chosen?.candidate.id).toBe(SMART);
    expect(d.actionPlan.basis).toBe('스마트카드로 갈아타기');
    const k = keys(CARD, SMART);
    expect(k[0]).toBe('new-first');
    const first = d.actionPlan.steps[0];
    expect(first.title).toContain('발급 가능 여부와 우대 인정 조건');
    expect(first.title).not.toContain('먼저 만듭니다');
    expect(first.contact?.institution).toBe('누리카드');
  });

  it('없는 후보 id 는 "새 상품 없이" 로 떨어진다', () => {
    expect(derive(scenario, CARD, { chosenCandidateId: 'nope' }).chosen).toBeNull();
  });

  it('기준 안 문구는 후보 이름에 조사를 맞춘다', () => {
    const d = derive(scenario, INSURANCE, { chosenCandidateId: LITE });
    expect(planBasisLabel(d.chosen, d.trigger)).toBe('실속건강보험으로 갈아타기');
    expect(planBasisLabel(null, d.trigger)).toBe('새 상품 없이 해지');
  });
});

describe('유지 판단의 안내 — 유지 절차는 없고 해지 절차만 낸다', () => {
  const d = derive(scenario, CARD, { chosenCandidateId: SMART });
  const plan = d.actionPlan;

  it('유지 단계가 하나도 없다 — 그대로 두는 데 절차는 없다', () => {
    expect(plan.kind).toBe('keep');
    expect(keys(CARD, SMART).some((k) => k.startsWith('keep'))).toBe(false);
  });

  it('머리글에는 확인된 조건에서 유지가 유리하다고 적고, 절차는 해지 절차다', () => {
    expect(plan.summary).toContain('확인된 조건에서는 유지');
    expect(plan.title).toBe(`${d.center.shortName ?? d.center.name} ${d.trigger.verb} 절차`);
  });

  it('새 상품 확인 → 실적 이전 → 판정 종료 → 비가역 경고 → 해지 신청 순서다', () => {
    const k = keys(CARD, SMART);
    expect(k.indexOf('new-first')).toBe(0);
    expect(k.indexOf('new-first')).toBeLessThan(k.indexOf('move-metrics'));
    expect(k.indexOf('move-metrics')).toBeLessThan(k.indexOf('wait'));
    expect(k.indexOf('wait')).toBeLessThan(k.indexOf('unrecoverable'));
    expect(k.indexOf('unrecoverable')).toBeLessThan(k.indexOf('execute'));
    expect(k[k.length - 1]).toBe('execute');
  });

  it('실적 이전 단계는 "옮깁니다" 가 아니라 인정 시점 확인이다', () => {
    const step = plan.steps.find((s) => s.key === 'move-metrics')!;
    expect(step.title).toContain('인정 시점');
    expect(step.bullets.length).toBe(d.chosen!.preserved.length);
  });

  it('기한은 안전 시점에서 온다 — 문구에 날짜를 적지 않는다', () => {
    const exec = plan.steps.find((s) => s.key === 'execute')!;
    expect(exec.when?.value).toBe(d.timing.safeFrom.value);
    expect(exec.whenLabel).toContain(formatKoMD(d.timing.safeFrom.value));
    expect(exec.whenLabel).toContain('우대 확인 완료 후');
    expect(exec.whenLabel).not.toContain('안전');
  });

  it('기다리는 단계는 "그 뒤 확인할 항목" 을 이번 달 판정 항목으로 채운다', () => {
    const wait = plan.steps.find((s) => s.key === 'wait')!;
    const due = d.recoverable.filter((i) => i.judgment.countsForSafeAfter);
    expect(due.length).toBeGreaterThan(0);
    expect(wait.bullets).toHaveLength(due.length);
    for (const i of due) {
      const name = i.product.shortName ?? i.product.name;
      expect(wait.bullets.some((b) => b.includes(name) && b.includes(formatMD(i.judgment.nextJudgmentDate.value!)))).toBe(true);
    }
    expect(wait.whenLabel).toContain('이번 달 우대 확인 완료 후');
    expect(wait.whenLabel).not.toContain('안전');
  });

  it('회복 불가 항목을 빠뜨리지 않고, 해지 단계보다 먼저 경고한다', () => {
    const step = plan.steps.find((s) => s.key === 'unrecoverable');
    if (d.unrecoverable.length === 0) {
      expect(step).toBeUndefined();
      return;
    }
    for (const u of d.unrecoverable) {
      expect(step!.bullets.some((b) => b.includes(u.product.shortName ?? u.product.name))).toBe(true);
    }
    const k = keys(CARD, SMART);
    expect(k.indexOf('unrecoverable')).toBeLessThan(k.indexOf('execute'));
  });
});

describe('변경 판단의 안내', () => {
  it('후보를 고르면 새 상품 확인이 해지보다 먼저 온다', () => {
    const k = keys(INSURANCE, LITE);
    expect(k.indexOf('new-first')).toBe(0);
    expect(k.indexOf('new-first')).toBeLessThan(k.indexOf('execute'));
  });

  it('약관에서 확정되지 않은 인정 조건은 첫 단계의 확인 목록에 올라간다', () => {
    const d = derive(scenario, INSURANCE, { chosenCandidateId: LITE });
    const first = d.actionPlan.steps[0];
    expect(d.chosen!.linkUnknown).toBe(true);
    expect(first.bullets.some((b) => b.includes('우대 인정 여부'))).toBe(true);
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

describe('보류 판단의 안내', () => {
  it('머리글에 무엇이 빠져 보류인지 적고, 절차는 그대로 해지 절차다', () => {
    const d = derive(scenario, LOAN);
    expect(d.verdict.kind).toBe('pending');
    expect(d.actionPlan.kind).toBe('pending');
    expect(d.actionPlan.summary).toContain('보류');
    expect(d.actionPlan.summary).toContain(d.missing[0]);
    expect(keys(LOAN)).toContain('execute');
  });

  it('빠진 입력을 채우는 단계가 맨 앞에 오고, 빠진 항목을 그대로 적는다', () => {
    const d = derive(scenario, LOAN);
    const k = keys(LOAN);
    expect(k[0]).toBe('missing');
    expect(d.actionPlan.steps[0].bullets).toEqual(d.missing);
    expect(k.indexOf('missing')).toBeLessThan(k.indexOf('execute'));
  });

  it('빠진 입력이 없는 트리거에는 그 단계가 없다', () => {
    expect(keys(CARD)).not.toContain('missing');
    expect(keys(INSURANCE)).not.toContain('missing');
  });
});

describe('중도해지 이자는 안내에도 남는다', () => {
  it('예·적금 해지는 보류 판단이지만 일회성 손실을 그래도 적고, 해지 단계보다 먼저 온다', () => {
    const d = derive(scenario, DEPOSIT);
    const early = d.actionPlan.steps.find((s) => s.key === 'early')!;
    expect(d.earlyTermination).not.toBeNull();
    expect(early.detail).toContain('중도해지');
    expect(early.source).toBe(d.earlyTermination!.loss.source);
    const k = keys(DEPOSIT);
    expect(k.indexOf('early')).toBeLessThan(k.indexOf('execute'));
  });

  it('중도해지 손실이 없는 시나리오에는 그 단계가 없다', () => {
    expect(keys(CARD)).not.toContain('early');
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
        if (step.when) expect(known.has(step.when.value)).toBe(true);
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
