// 시점별 예상 손익. "지금 실행" 과 "n개월 더 유지" 를 같은 축 위에 놓는다.
// 전부 순수 함수. today 는 반드시 scenario.meta.today 에서 온다.
//
// 계산 규칙
//   지금 실행(0)   : 연 기준 순손익 = 절감 − 연간 손실
//                    (바로 실행하면 절감은 생기고 혜택은 없어진다)
//   m개월 유지(m>0): 지켜낸 혜택 − 그동안 계속 낸 비용
//                    = 연간 손실 × m/12 − 절감 × ceil(m/12)
//                    절감은 연 단위로 나가는 비용이라 해가 바뀔 때마다 한 번씩 더해진다.
//
// 추천 구간
//   1) 지금 실행이 이미 이득이면(순손익 ≥ 0) 0개월
//   2) 회복 불가 조건이 있으면 그 회복 시점을 넘기는 가장 이른 구간
//   3) 그 외에는 순손익이 양(+)으로 돌아서는 가장 이른 구간

import { addOffset, compareISO } from './dates';
import { formatMonths } from './format';
import type { ISODate, Tagged } from './types';
import { tag } from './types';

export const DEFAULT_HORIZON_MONTHS = [0, 6, 12, 24];

export interface HorizonPoint {
  months: number;
  /** 0 = 지금 실행, 그 외 = 유지 */
  kind: 'now' | 'hold';
  /** "지금 해지", "6개월 유지", "1년 유지" */
  label: string;
  /** 순손익. 양수면 이득, 음수면 손해 */
  value: Tagged<number>;
  recommended: boolean;
}

export interface Horizon {
  points: HorizonPoint[];
  recommended: HorizonPoint;
  /** 지금 실행했을 때의 연 기준 순손익 */
  netAnnual: Tagged<number>;
  /** 축을 그릴 때 쓰는 최대 절대값. 0 이면 1 로 둔다(0 나누기 방지) */
  scale: number;
}

export interface HorizonInput {
  today: ISODate;
  /** 연간 손실 합계 (양수) */
  annualLoss: number;
  /** 연간 절감 합계 (양수) */
  savings: number;
  /** 회복 불가 조건의 회복 시점 중 가장 늦은 날. 없으면 null */
  recoverBy: ISODate | null;
  /** "해지" / "변경" */
  verb: string;
  months?: number[];
}

export function netAnnualOf(annualLoss: number, savings: number): number {
  return savings - annualLoss;
}

export function holdValue(annualLoss: number, savings: number, months: number): number {
  const kept = (annualLoss * months) / 12;
  const paid = savings * Math.ceil(months / 12);
  return Math.round(kept - paid);
}

export function horizonProjection(input: HorizonInput): Horizon {
  const { today, annualLoss, savings, recoverBy, verb } = input;
  const months = [...(input.months ?? DEFAULT_HORIZON_MONTHS)].sort((a, b) => a - b);
  const net = netAnnualOf(annualLoss, savings);

  const raw = months.map((m) => ({
    months: m,
    kind: (m === 0 ? 'now' : 'hold') as HorizonPoint['kind'],
    label: m === 0 ? `지금 ${verb}` : `${formatMonths(m)} 유지`,
    amount: m === 0 ? net : holdValue(annualLoss, savings, m),
  }));

  const recommendedMonths = pickRecommended(raw, { today, net, recoverBy });

  const points: HorizonPoint[] = raw.map((p) => ({
    months: p.months,
    kind: p.kind,
    label: p.label,
    value: tag(p.amount, 'calc'),
    recommended: p.months === recommendedMonths,
  }));

  const scale = Math.max(1, ...points.map((p) => Math.abs(p.value.value)));
  return {
    points,
    recommended: points.find((p) => p.recommended) ?? points[0],
    netAnnual: tag(net, 'calc'),
    scale,
  };
}

function pickRecommended(
  raw: { months: number; amount: number }[],
  ctx: { today: ISODate; net: number; recoverBy: ISODate | null },
): number {
  if (ctx.net >= 0) return 0;

  const holds = raw.filter((p) => p.months > 0);
  if (holds.length === 0) return 0;

  if (ctx.recoverBy !== null) {
    const covering = holds.find(
      (p) => compareISO(addOffset(ctx.today, { months: p.months }), ctx.recoverBy as ISODate) >= 0,
    );
    if (covering) return covering.months;
    return holds[holds.length - 1].months;
  }

  const positive = holds.find((p) => p.amount > 0);
  return positive ? positive.months : holds[holds.length - 1].months;
}
