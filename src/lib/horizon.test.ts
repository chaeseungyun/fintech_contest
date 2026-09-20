import { describe, expect, it } from 'vitest';
import { derive } from './derive';
import { applyEdits } from './edits';
import { BASE, CARD, EXPECTED, TRIGGER_IDS } from './fixture.test-helpers';
import { DEFAULT_HORIZON_MONTHS, holdValue, horizonProjection, netAnnualOf } from './horizon';

const scenario = applyEdits(BASE, {});

describe('expected.horizon 재현 — 트리거 전부', () => {
  for (const triggerId of TRIGGER_IDS) {
    const e = EXPECTED.triggers[triggerId];
    const d = derive(scenario, triggerId);

    it(`${triggerId}: 시점별 손익 ${e.horizon.join(' / ')}`, () => {
      expect(d.horizon.points.map((p) => p.months)).toEqual(EXPECTED.horizonMonths);
      expect(d.horizon.points.map((p) => p.value.value)).toEqual(e.horizon);
      expect(d.horizon.points.every((p) => p.value.source === 'calc')).toBe(true);
    });

    it(`${triggerId}: 추천 구간 ${e.recommendedMonths}개월 · 판단 ${e.verdict}`, () => {
      expect(d.horizon.recommended.months).toBe(e.recommendedMonths);
      expect(d.horizon.points.filter((p) => p.recommended)).toHaveLength(1);
      expect(d.verdict.kind).toBe(e.verdict);
    });
  }
});

describe('계산 규칙', () => {
  it('지금 실행 = 절감 − 연간 손실', () => {
    expect(netAnnualOf(194_000, 30_000)).toBe(-164_000);
    expect(netAnnualOf(36_000, 816_000)).toBe(780_000);
  });

  it('m개월 유지 = 연간 손실 × m/12 − 절감 × ceil(m/12)', () => {
    expect(holdValue(194_000, 30_000, 6)).toBe(97_000 - 30_000);
    expect(holdValue(194_000, 30_000, 12)).toBe(194_000 - 30_000);
    // 13개월은 두 번째 해의 절감(연회비)이 한 번 더 나간다
    expect(holdValue(194_000, 30_000, 24)).toBe(388_000 - 60_000);
    expect(holdValue(194_000, 30_000, 13)).toBe(Math.round((194_000 * 13) / 12) - 60_000);
  });

  it('1년 유지 이익은 지금 실행 손실의 거울상이다', () => {
    const d = derive(scenario, CARD);
    const now = d.horizon.points.find((p) => p.months === 0)!;
    const year = d.horizon.points.find((p) => p.months === 12)!;
    expect(year.value.value).toBe(-now.value.value);
  });

  it('기본 구간은 1년 안에서 분기 단위 — 0·3·6·9·12개월', () => {
    expect(DEFAULT_HORIZON_MONTHS).toEqual([0, 3, 6, 9, 12]);
  });

  it('1년을 넘는 구간은 배수일 뿐이라 두지 않는다', () => {
    expect(holdValue(194_000, 30_000, 24)).toBe(2 * holdValue(194_000, 30_000, 12));
  });
});

describe('추천 구간 고르기', () => {
  const base = { today: '2026-09-08', verb: '해지' as const };

  it('지금 실행이 이미 이득이면 0개월', () => {
    const h = horizonProjection({ ...base, annualLoss: 36_000, savings: 816_000, recoverBy: null });
    expect(h.recommended.months).toBe(0);
    expect(h.reason).toBe('now');
  });

  it('회복 불가 조건이 있으면 그 회복 시점을 넘기는 가장 이른 구간', () => {
    // 만기 2027-03-20 은 +6개월(2027-03-08)로는 못 넘고 +9개월(2027-06-08)이면 넘는다
    const h = horizonProjection({
      ...base,
      annualLoss: 194_000,
      savings: 30_000,
      recoverBy: '2027-03-20',
    });
    expect(h.recommended.months).toBe(9);
    expect(h.reason).toBe('recover');

    const earlier = horizonProjection({
      ...base,
      annualLoss: 194_000,
      savings: 30_000,
      recoverBy: '2027-01-10',
    });
    expect(earlier.recommended.months).toBe(6);

    const soon = horizonProjection({
      ...base,
      annualLoss: 194_000,
      savings: 30_000,
      recoverBy: '2026-11-30',
    });
    expect(soon.recommended.months).toBe(3);
  });

  it('회복 불가 조건이 없으면 순손익이 양으로 도는 가장 이른 구간', () => {
    // 절감이 없으면 첫 구간부터 양수 → 3개월 (팀 확정 2026-09-20: 이대로 표시한다)
    const h = horizonProjection({ ...base, annualLoss: 50_000, savings: 0, recoverBy: null });
    expect(h.recommended.months).toBe(3);
    expect(h.reason).toBe('positive');

    // 절감이 커서 첫 구간이 음수면 양으로 도는 구간까지 미룬다
    const later = horizonProjection({ ...base, annualLoss: 100_000, savings: 40_000, recoverBy: null });
    expect(later.points.map((p) => p.value.value)).toEqual([-60_000, -15_000, 10_000, 35_000, 60_000]);
    expect(later.recommended.months).toBe(6);
  });

  it('회복 시점이 마지막 구간보다도 멀면 가장 긴 구간을 고른다', () => {
    const h = horizonProjection({
      ...base,
      annualLoss: 194_000,
      savings: 30_000,
      recoverBy: '2031-01-01',
    });
    expect(h.recommended.months).toBe(12);
    expect(h.reason).toBe('recover-beyond');
  });

  it('순수 함수: 같은 입력이면 같은 결과', () => {
    const args = { ...base, annualLoss: 194_000, savings: 30_000, recoverBy: '2027-03-20' };
    expect(horizonProjection(args)).toEqual(horizonProjection(args));
  });
});

describe('축 배율', () => {
  it('scale 은 절대값 최댓값이고 0 이어도 1 이상이다', () => {
    expect(horizonProjection({ ...base0, annualLoss: 0, savings: 0, recoverBy: null }).scale).toBe(1);
    expect(
      horizonProjection({ ...base0, annualLoss: 194_000, savings: 30_000, recoverBy: null }).scale,
    ).toBe(164_000);
  });
});

const base0 = { today: '2026-09-08', verb: '해지' };
