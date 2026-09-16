// 표시용 포맷. 값을 만들지 않는다 — 계산은 lib/* 에서만.

import { parseISO } from './dates';
import type { ISODate } from './types';

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 부호를 앞에 붙인 금액. 0 은 부호 없음. */
export function formatSignedWon(n: number): string {
  if (n === 0) return formatWon(0);
  return `${n > 0 ? '+' : '−'}${formatWon(Math.abs(n))}`;
}

/** 194000 → 19.4만원, 125400000 → 1억 2,540만원 */
export function formatWonShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e8) {
    const eok = Math.floor(abs / 1e8);
    const rest = Math.round((abs - eok * 1e8) / 1e4);
    return rest === 0 ? `${sign}${eok}억원` : `${sign}${eok}억 ${rest.toLocaleString('ko-KR')}만원`;
  }
  if (abs >= 1e4) {
    const man = Math.round((abs / 1e4) * 10) / 10;
    return `${sign}${man.toLocaleString('ko-KR')}만원`;
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

/** 150000000 → 1.5억, 20000000 → 2,000만원. 라벨 안에 짧게 끼울 때. */
export function formatWonCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e8) return `${sign}${trim(abs / 1e8)}억`;
  if (abs >= 1e4) return `${sign}${trim(abs / 1e4).toLocaleString('ko-KR')}만원`;
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

const trim = (x: number) => Math.round(x * 100) / 100;

export function formatSignedWonShort(n: number): string {
  if (n === 0) return formatWonShort(0);
  return n > 0 ? `+${formatWonShort(n)}` : formatWonShort(n);
}

/** 0.036 → 3.6% */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100 * 1000) / 1000}%`;
}

/** -0.12 → 12% (부호는 호출부에서) */
export function formatPercent(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100)}%`;
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

/** 0 → 지금, 6 → 6개월, 12 → 1년, 24 → 2년 */
export function formatMonths(months: number): string {
  if (months === 0) return '지금';
  if (months % 12 === 0) return `${months / 12}년`;
  return `${months}개월`;
}

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 마지막 글자에 받침이 있는가. 한글이 아니면 받침 없음으로 본다. */
export function hasFinalConsonant(word: string): boolean {
  const ch = word.trim().slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return false;
  return (code - HANGUL_START) % 28 !== 0;
}

/**
 * 조사 선택. pair 는 '을/를' 처럼 "받침 있을 때/없을 때" 순서다.
 * 상품명이 데이터에서 오므로 문장을 화면에 하드코딩하지 않기 위해 필요하다.
 */
export function josa(word: string, pair: string): string {
  const [withJong, withoutJong] = pair.split('/');
  return hasFinalConsonant(word) ? withJong : withoutJong;
}

/** "톡톡카드를", "급여통장을" */
export function withJosa(word: string, pair: string): string {
  return `${word}${josa(word, pair)}`;
}
