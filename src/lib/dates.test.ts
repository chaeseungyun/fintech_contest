import { describe, expect, it } from 'vitest';
import {
  addOffset,
  daysBetween,
  daysInMonth,
  endOfMonth,
  fromDayNumber,
  nextDayOfMonth,
  parseISO,
  parsePeriod,
  startOfNextMonth,
  toDayNumber,
} from './dates';

describe('말일 clamping', () => {
  it('1/31 +1M → 2/28 (평년)', () => {
    expect(addOffset('2026-01-31', { months: 1 })).toBe('2026-02-28');
  });
  it('1/31 +1M → 2/29 (윤년)', () => {
    expect(addOffset('2028-01-31', { months: 1 })).toBe('2028-02-29');
  });
  it('3/31 +1M → 4/30, 8/31 +1M → 9/30', () => {
    expect(addOffset('2026-03-31', { months: 1 })).toBe('2026-04-30');
    expect(addOffset('2026-08-31', { months: 1 })).toBe('2026-09-30');
  });
  it('2/29 +1Y → 2/28', () => {
    expect(addOffset('2028-02-29', { years: 1 })).toBe('2029-02-28');
  });
  it('연말 넘김: 11/30 +3M → 다음 해 2/28', () => {
    expect(addOffset('2026-11-30', { months: 3 })).toBe('2027-02-28');
  });
  it('음수 월 오프셋도 clamping', () => {
    expect(addOffset('2026-03-31', { months: -1 })).toBe('2026-02-28');
    expect(addOffset('2026-01-15', { months: -1 })).toBe('2025-12-15');
  });
});

describe('오프셋 순서: 년 → 월 → 일', () => {
  it('1/30 +1M+1D → 3/1 (일을 먼저 하면 2/28 이 된다)', () => {
    expect(addOffset('2026-01-30', { months: 1, days: 1 })).toBe('2026-03-01');
    // 반대 순서라면
    expect(addOffset(addOffset('2026-01-30', { days: 1 }), { months: 1 })).toBe('2026-02-28');
  });
  it('2024-02-29 +1Y+1M → 3/28 (월을 먼저 하면 3/29)', () => {
    expect(addOffset('2024-02-29', { years: 1, months: 1 })).toBe('2025-03-28');
    expect(addOffset(addOffset('2024-02-29', { months: 1 }), { years: 1 })).toBe('2025-03-29');
  });
  it('일 오프셋은 월 경계를 넘는다', () => {
    expect(addOffset('2026-09-30', { days: 1 })).toBe('2026-10-01');
    expect(addOffset('2026-12-31', { days: 1 })).toBe('2027-01-01');
    expect(addOffset('2026-03-01', { days: -1 })).toBe('2026-02-28');
  });
});

describe('다음 판정일 nextDayOfMonth', () => {
  const today = '2026-09-08';
  it('오늘보다 뒤인 날 → 이번 달', () => {
    expect(nextDayOfMonth(today, 15)).toBe('2026-09-15');
  });
  it('오늘보다 앞인 날 → 다음 달', () => {
    expect(nextDayOfMonth(today, 5)).toBe('2026-10-05');
  });
  it('오늘이 그 날이면 오늘', () => {
    expect(nextDayOfMonth(today, 8)).toBe('2026-09-08');
  });
  it('31일 기준은 30일짜리 달에서 말일로 clamping', () => {
    expect(nextDayOfMonth(today, 31)).toBe('2026-09-30');
    expect(nextDayOfMonth('2026-09-30', 31)).toBe('2026-09-30');
    expect(nextDayOfMonth('2026-10-01', 31)).toBe('2026-10-31');
  });
  it('연말: 12/20 기준 5일 → 다음 해 1/5', () => {
    expect(nextDayOfMonth('2026-12-20', 5)).toBe('2027-01-05');
  });
});

describe('보조 함수', () => {
  it('endOfMonth / startOfNextMonth', () => {
    expect(endOfMonth('2026-09-08')).toBe('2026-09-30');
    expect(endOfMonth('2026-02-01')).toBe('2026-02-28');
    expect(startOfNextMonth('2026-09-08')).toBe('2026-10-01');
    expect(startOfNextMonth('2026-12-08')).toBe('2027-01-01');
  });
  it('daysBetween 은 반열림 [a, b) 길이', () => {
    expect(daysBetween('2026-09-08', '2026-09-30')).toBe(22);
    expect(daysBetween('2026-09-08', '2026-09-08')).toBe(0);
    expect(daysBetween('2026-09-30', '2026-10-05')).toBe(5);
  });
  it('day number 왕복', () => {
    for (const d of ['1970-01-01', '2000-02-29', '2026-09-08', '2027-03-20', '2100-12-31']) {
      expect(fromDayNumber(toDayNumber(parseISO(d)))).toBe(d);
    }
    expect(toDayNumber(parseISO('1970-01-01'))).toBe(0);
  });
  it('daysInMonth', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });
  it('parsePeriod', () => {
    expect(parsePeriod('1M')).toEqual({ months: 1 });
    expect(parsePeriod('2Y')).toEqual({ years: 2 });
    expect(parsePeriod('14D')).toEqual({ days: 14 });
  });
  it('잘못된 날짜는 던진다', () => {
    expect(() => parseISO('2026-02-30')).toThrow();
    expect(() => parseISO('2026/09/08')).toThrow();
  });
});
