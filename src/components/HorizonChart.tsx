import { formatSignedWonShort } from '../lib/format';
import type { Horizon } from '../lib/horizon';

/**
 * 시점별 예상 손익. 0 을 기준선으로 위/아래로 자란다.
 * 막대 높이·위치는 horizon.points 의 값에서만 나온다 — 화면에 숫자를 쓰지 않는다.
 */
export function HorizonChart({ horizon }: { horizon: Horizon }) {
  const values = horizon.points.map((p) => p.value.value);
  const posMax = Math.max(0, ...values);
  const negMax = Math.max(0, ...values.map((v) => -v));
  const span = Math.max(1, posMax + negMax);
  /** 0 선의 위치 (위에서부터 %) */
  const base = (posMax / span) * 100;

  return (
    <div className="hchart">
      <div className="plot">
        <div className="grid">
          <span className="zero" style={{ top: `${base}%` }} />
            {horizon.points.map((p) => {
            const v = p.value.value;
            const h = (Math.abs(v) / span) * 100;
            const up = v >= 0;
            const barStyle = up
              ? { bottom: `${100 - base}%`, height: `${h}%` }
              : { top: `${base}%`, height: `${h}%` };
            const labelStyle = up
              ? { bottom: `calc(${100 - base}% + ${h}% + 3px)` }
              : { top: `calc(${base}% + ${h}% + 3px)` };
            return (
              <div key={p.months} className={`col${p.recommended ? ' rec' : ''}`}>
                <span
                  className={`bar ${up ? 'up' : 'down'}`}
                  style={barStyle}
                  title={`${p.label} ${formatSignedWonShort(v)}`}
                />
                <span className={`val ${up ? 'up' : 'down'}`} style={labelStyle}>
                  {p.recommended && <b className="badge">추천</b>}
                  {formatSignedWonShort(v)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="xaxis">
        {horizon.points.map((p) => (
          <span key={p.months} className={p.recommended ? 'on' : undefined}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
