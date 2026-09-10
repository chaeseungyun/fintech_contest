// 표시용 포맷. 값을 만들지 않는다 — 계산은 lib/* 에서만.

import { parseISO } from './dates';
import type { ISODate } from './types';

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 2026-09-30 → 9/30 */
export function formatMD(date: ISODate): string {
  const { m, d } = parseISO(date);
  return `${m}/${d}`;
}

/** 2026-09-30 → 9월 30일 */
export function formatKoMD(date: ISODate): string {
  const { m, d } = parseISO(date);
  return `${m}월 ${d}일`;
}

/** 2027-03-20 → 2027년 3월 20일 */
export function formatKoYMD(date: ISODate): string {
  const { y, m, d } = parseISO(date);
  return `${y}년 ${m}월 ${d}일`;
}
