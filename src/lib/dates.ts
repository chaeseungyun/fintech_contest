// 날짜 산술. 타임존 Asia/Seoul 고정, 시각 없음.
// Date 객체를 쓰지 않는다 — 'YYYY-MM-DD' 문자열과 정수 산술만으로 처리한다.

import type { ISODate } from './types';

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number; // 1–31
}

export interface DateOffset {
  years?: number;
  months?: number;
  days?: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** 말일 clamping: 그 달에 없는 날이면 말일로 내린다. */
export function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, daysInMonth(y, m));
}

export function parseISO(s: ISODate): YMD {
  const m = ISO_RE.exec(s);
  if (!m) throw new Error(`invalid ISO date: ${s}`);
  const ymd = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (ymd.m < 1 || ymd.m > 12 || ymd.d < 1 || ymd.d > daysInMonth(ymd.y, ymd.m)) {
    throw new Error(`invalid calendar date: ${s}`);
  }
  return ymd;
}

export function toISO({ y, m, d }: YMD): ISODate {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** ISO 문자열은 사전순 = 시간순. */
export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxISO(dates: ISODate[]): ISODate | null {
  return dates.length ? dates.reduce((a, b) => (compareISO(a, b) >= 0 ? a : b)) : null;
}

export function minISO(dates: ISODate[]): ISODate | null {
  return dates.length ? dates.reduce((a, b) => (compareISO(a, b) <= 0 ? a : b)) : null;
}

// ── 일수 산술 (Howard Hinnant, days_from_civil / civil_from_days) ──
// 1970-01-01 = 0. 윤년·월 길이를 전부 정수 산술로 처리한다.

export function toDayNumber({ y, m, d }: YMD): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(dayNumber: number): ISODate {
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return toISO({ y: y + (m <= 2 ? 1 : 0), m, d });
}

/** b − a 일수. 반열림 [a, b) 의 길이. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return toDayNumber(parseISO(b)) - toDayNumber(parseISO(a));
}

/**
 * 오프셋 적용. 년 → 월 → 일 순서 고정. 년·월 단계마다 말일 clamping.
 * 순서를 바꾸면 결과가 달라진다 (2026-01-30 +1M+1D: 3/1, 일을 먼저 하면 2/28).
 */
export function addOffset(date: ISODate, off: DateOffset): ISODate {
  let { y, m, d } = parseISO(date);
  if (off.years) {
    y += off.years;
    d = clampDay(y, m, d);
  }
  if (off.months) {
    const total = y * 12 + (m - 1) + off.months;
    y = Math.floor(total / 12);
    m = (((total % 12) + 12) % 12) + 1;
    d = clampDay(y, m, d);
  }
  if (off.days) {
    return fromDayNumber(toDayNumber({ y, m, d }) + off.days);
  }
  return toISO({ y, m, d });
}

export function startOfMonth(date: ISODate): ISODate {
  const { y, m } = parseISO(date);
  return toISO({ y, m, d: 1 });
}

export function endOfMonth(date: ISODate): ISODate {
  const { y, m } = parseISO(date);
  return toISO({ y, m, d: daysInMonth(y, m) });
}

/** 다음 달 1일. 이번 달 구간 [startOfMonth, startOfNextMonth) 의 끝. */
export function startOfNextMonth(date: ISODate): ISODate {
  return addOffset(startOfMonth(date), { months: 1 });
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  const pa = parseISO(a);
  const pb = parseISO(b);
  return pa.y === pb.y && pa.m === pb.m;
}

/**
 * 오늘 이후(오늘 포함) 첫 dayOfMonth. 오늘이 그 날이면 오늘.
 * dayOfMonth 가 그 달에 없으면 말일로 clamping (31 → 9/30).
 */
export function nextDayOfMonth(today: ISODate, dayOfMonth: number): ISODate {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error(`invalid dayOfMonth: ${dayOfMonth}`);
  }
  const { y, m } = parseISO(today);
  const thisMonth = toISO({ y, m, d: clampDay(y, m, dayOfMonth) });
  if (compareISO(thisMonth, today) >= 0) return thisMonth;
  const { y: ny, m: nm } = parseISO(startOfNextMonth(today));
  return toISO({ y: ny, m: nm, d: clampDay(ny, nm, dayOfMonth) });
}

/** '1M', '3M', '1Y', '14D' → DateOffset */
export function parsePeriod(period: string): DateOffset {
  const m = /^(\d+)([YMD])$/.exec(period);
  if (!m) throw new Error(`invalid period: ${period}`);
  const n = Number(m[1]);
  return m[2] === 'Y' ? { years: n } : m[2] === 'M' ? { months: n } : { days: n };
}
