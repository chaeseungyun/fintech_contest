import { useState } from 'react';
import { formatSignedWonShort } from '../lib/format';
import type { Horizon, HorizonReason } from '../lib/horizon';

/**
 * 강조 막대 위의 작은 글자. 이유에 따라 다르다 — 첫 양수 구간(positive)은 "추천 시점" 이 아니라
 * 손익분기라서 그렇게 적는다. 변경 시점은 판정일·만기 같은 확인된 사건으로 정한다.
 */
const MARK: Record<HorizonReason, string> = {
  now: '지금도 이득',
  recover: '만기 뒤',
  'recover-beyond': '최소 유지',
  positive: '손익분기',
};

/* viewBox 좌표. 막대 폭 36, 위쪽은 강조 글자·끝 값 두 줄, 아래쪽은 음수 값 한 줄과 x축 */
const W = 334;
const H = 166;
const PAD_X = 14;
const TOP = 34;
const BOTTOM = 136;
const BAR = 36;

/**
 * 유지 기간별 예상 손익. 0 선 기준 발산 막대 — 음수 --down, 양수 --up.
 * 막대 높이·위치는 horizon.points 의 값에서만 나온다. 값 라벨은 양 끝에만 — 모든 막대에 숫자를 박지 않는다.
 * quiet 면 강조를 그리지 않는다 — 절감이 없어 손익분기 자체가 없을 때.
 * 가운데 막대 값은 눌러야 보인다(모바일엔 hover 가 없다). 고른 막대는 화면 안에서만 쓰는 표시 상태다.
 */
export function HorizonChart({ horizon, quiet = false }: { horizon: Horizon; quiet?: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pts = horizon.points;
  const values = pts.map((p) => p.value.value);
  const posMax = Math.max(0, ...values);
  const negMax = Math.max(0, ...values.map((v) => -v));
  const span = Math.max(1, posMax + negMax);
  const zero = TOP + (posMax / span) * (BOTTOM - TOP);
  const step = (W - PAD_X * 2) / pts.length;
  const cx = (i: number) => PAD_X + step * (i + 0.5);
  const last = pts.length - 1;

  const summary = pts.map((p) => `${p.label} ${formatSignedWonShort(p.value.value)}`).join(', ');

  return (
    <svg className="hchart" viewBox={`0 0 ${W} ${H}`} aria-label={`유지 기간별 예상 손익. ${summary}`}>
      {pts.map((p, i) => {
        const v = p.value.value;
        const h = Math.max(2, (Math.abs(v) / span) * (BOTTOM - TOP));
        const up = v >= 0;
        const y = up ? zero - h : zero;
        const on = p.recommended && !quiet;
        const isEnd = i === 0 || i === last;
        const showValue = isEnd || picked === i;
        const top = up ? y : zero;
        const pick = () => setPicked(picked === i ? null : i);
        return (
          <g
            key={p.months}
            className={`col${picked === i ? ' picked' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${p.label} ${formatSignedWonShort(v)}`}
            aria-pressed={picked === i}
            onClick={pick}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick())}
          >
            {/* 막대가 짧아도 누르기 쉽게 기둥 전체를 받는다 */}
            <rect className="hit" x={cx(i) - step / 2} y={0} width={step} height={H} />
            <rect className={up ? 'bar up' : 'bar down'} x={cx(i) - BAR / 2} y={y} width={BAR} height={h} rx={3} />
            {showValue && (
              <text className={`val ${up ? 'up' : 'down'}`} x={cx(i)} y={up ? y - 5 : zero + h + 13}>
                {formatSignedWonShort(v)}
              </text>
            )}
            {on && (
              <text className="mark" x={cx(i)} y={top - (showValue && up ? 19 : 6)}>
                {MARK[horizon.reason]}
              </text>
            )}
            {/* 막대 폭에 맞춰 짧게. 전체 문구("3개월 유지")는 aria-label 에 있다 */}
            <text className={`x${on || picked === i ? ' on' : ''}`} x={cx(i)} y={H - 2}>
              {p.months === 0 ? '지금' : `${p.months}개월`}
            </text>
          </g>
        );
      })}
      <path className="zero" d={`M${PAD_X} ${zero}h${W - PAD_X * 2}`} />
    </svg>
  );
}
