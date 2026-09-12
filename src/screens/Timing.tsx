import { PhoneFrame } from '../components/PhoneFrame';
import { SourceTag } from '../components/SourceTag';
import type { AxisPoint, ImpactItem } from '../lib/derive';
import { formatKoMD, formatKoYMD, formatMD } from '../lib/format';
import { useStore } from '../state/store';

const POINT_COLOR: Record<AxisPoint['kind'], string> = {
  today: 'var(--app-ink)',
  judgment: 'var(--warn)',
  safe: 'var(--brand)',
  inactive: '#B8BEC7',
};

function dotColor(item: ImpactItem): string {
  if (!item.judgment.active) return '#B8BEC7';
  if (item.judgment.recoverable && !item.judgment.countsForSafeAfter) return '#B8BEC7';
  if (!item.judgment.recoverable) return 'var(--danger)';
  return 'var(--brand)';
}

/** 축 위 라벨. 왼쪽 여백 6%, 오른쪽 여백 6% 를 두고 0–100 을 88% 폭에 매핑한다. */
const x = (pct: number) => `${6 + pct * 0.88}%`;

export function Timing() {
  const { derived: d, dispatch } = useStore();
  const { axis, timing } = d;

  return (
    <PhoneFrame title="시점" onBack={() => dispatch({ type: 'navigate', screen: 2 })}>
      <div className="box">
        <div className="inst">오늘 {formatKoMD(d.today)} 기준</div>
        <div className="axis">
          <div className="ln" />
          <div
            className="safe"
            style={{ left: x(axis.safeFromPct), width: `calc(${x(100)} - ${x(axis.safeFromPct)})` }}
          />
          {axis.points.map((p, i) => (
            <div
              key={`${p.date}-${p.conditionId ?? 'today'}-${i}`}
              className="pt"
              style={{ left: x(p.pct), background: POINT_COLOR[p.kind] }}
              title={p.date}
            />
          ))}
          {dedupeLabels(axis.points).map((p) => (
            <div key={p.date} className="lb" style={{ left: x(p.pct) }}>
              {p.kind === 'today' ? '오늘' : formatMD(p.date)}
            </div>
          ))}
        </div>
        <div className="meta">
          {timing.alreadySafe ? (
            <>이번 달 판정은 모두 끝났습니다. 지금 옮겨도 됩니다</>
          ) : (
            <>
              <b>{formatKoMD(timing.safeAfter.value)}</b>이 지나면 이번 달 판정이 모두 끝납니다
            </>
          )}{' '}
          <SourceTag source={timing.safeAfter.source} />
          {d.deferredNextMonth.length > 0 && (
            <div className="sub">
              {d.deferredNextMonth
                .map((i) => `${i.product.shortName ?? i.product.name} ${formatMD(i.judgment.nextJudgmentDate.value!)}`)
                .join(', ')}
              은 다음 달 판정이라 계산에서 뺐습니다. 옮긴 뒤 실적을 다시 채우면 유지됩니다.
            </div>
          )}
        </div>
      </div>

      <div className="box tight">
        {d.items.map((item) => {
          const j = item.judgment;
          const date = j.nextJudgmentDate.value;
          return (
            <div key={item.condition.id} className={`tlrow${j.active ? '' : ' off'}`}>
              <span className="dot" style={{ background: dotColor(item) }} />
              <span className="nm">
                {item.product.name}
                <br />
                <span className="st">
                  {j.cycleLabel.value} <SourceTag source={j.cycleLabel.source} />
                </span>
              </span>
              {!j.active ? (
                <span className="dt muted">판정 제외</span>
              ) : date === null ? (
                <span className="dt danger">회복 불가</span>
              ) : (
                <span className="dt">
                  {formatMD(date)}
                  <div className="rt">
                    {j.recoverable && !j.countsForSafeAfter ? (
                      <span className="muted">다음 달 · 계산 제외</span>
                    ) : (
                      <SourceTag source={j.nextJudgmentDate.source} />
                    )}
                  </div>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {d.unrecoverable.map((item) => (
        <div key={item.condition.id} className="box perm">
          <div className="inst">{item.product.name}</div>
          <div className="meta" style={{ lineHeight: 1.65 }}>
            가입 시점에 우대가 확정되는 조건이라 판정일이 없습니다. 급여이체를 끊으면 만기{' '}
            <b>{formatKoYMD(item.judgment.recoverAt!.value)}</b>
            <SourceTag source={item.judgment.recoverAt!.source} />
            까지 되돌릴 수 없습니다. <SourceTag source={item.judgment.cycleLabel.source} />
          </div>
        </div>
      ))}

      {d.inactive.map((item) => (
        <div key={item.condition.id} className="box off">
          <div className="inst">{item.product.name}</div>
          <div className="meta" style={{ lineHeight: 1.65 }}>
            {item.judgment.inactiveReason}. 지금도 받지 못하는 혜택이라 시점 계산에서 뺐습니다.
          </div>
        </div>
      ))}

      <button type="button" className="btn text" onClick={() => dispatch({ type: 'navigate', screen: 4 })}>
        근거 원문 보기
      </button>
    </PhoneFrame>
  );
}

/** 같은 날짜에 점이 여럿이면 라벨은 하나만 */
function dedupeLabels(points: AxisPoint[]): AxisPoint[] {
  const seen = new Set<string>();
  return points.filter((p) => (seen.has(p.date) ? false : (seen.add(p.date), true)));
}
