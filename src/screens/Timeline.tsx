import { AppShell } from '../components/AppShell';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import type { AxisPoint, ImpactItem } from '../lib/derive';
import { formatKoMD, formatKoYMD, formatMD, withJosa } from '../lib/format';
import { perkLabel } from '../lib/money';
import { useStore } from '../state/store';

const POINT_CLASS: Record<AxisPoint['kind'], string> = {
  today: 'today',
  judgment: 'judgment',
  safe: 'safe',
  inactive: 'inactive',
};

function rowClass(item: ImpactItem): string {
  if (!item.judgment.active) return 'inactive';
  if (!item.judgment.recoverable) return 'perm';
  if (!item.judgment.countsForSafeAfter) return 'deferred';
  return 'safe';
}

/** 축 위 라벨. 좌우 6% 여백을 두고 0–100 을 88% 폭에 매핑한다. */
const x = (pct: number) => `${6 + pct * 0.88}%`;

export function Timeline() {
  const { derived: d, dispatch } = useStore();
  const center = d.center.shortName ?? d.center.name;
  const { axis, timing } = d;

  return (
    <AppShell title="우대 확인일과 변경 가능 구간" onBack={() => dispatch({ type: 'back' })} hideTabBar>
      <div className="card">
        <h3 className="cardtitle">
          오늘 {formatKoMD(d.today)} 기준
          <SourceTag source={timing.safeAfter.source} />
        </h3>

        <div className="axis">
          <div className="ln" />
          <div
            className="safezone"
            style={{ left: x(axis.safeFromPct), width: `calc(${x(100)} - ${x(axis.safeFromPct)})` }}
          />
          <div className="safelabel" style={{ left: x(axis.safeFromPct) }}>
            변경 가능 구간
          </div>
          {axis.points.map((p, i) => (
            <div
              key={`${p.date}-${p.conditionId ?? 'today'}-${i}`}
              className={`pt ${POINT_CLASS[p.kind]}`}
              style={{ left: x(p.pct) }}
              title={p.date}
            />
          ))}
          {dedupeLabels(axis.points).map((p) => (
            <div key={p.date} className="lb" style={{ left: x(p.pct) }}>
              {p.kind === 'today' ? '오늘' : formatMD(p.date)}
            </div>
          ))}
        </div>

        <p className="axisnote">
          {timing.alreadySafe ? (
            <>이번 달 우대 확인은 모두 끝나 이번 달 우대가 확정됐습니다. 지금 실행해도 이번 달 혜택은 잃지 않습니다.</>
          ) : (
            <>
              <b>{formatKoMD(timing.safeAfter.value)}</b>이 지나면 이번 달 우대 확인이 모두 끝나 이번 달 우대가
              확정됩니다. 그 뒤에 바꿔도 이번 달 혜택은 잃지 않습니다.
            </>
          )}
        </p>
        <p className="footnote">우대 확인일은 은행이 실적을 채웠는지 보고 그 달 우대를 줄지 정하는 날입니다. 이 날이 지나면 그 달 우대는 확정되어, 그 뒤에 바꿔도 그 달 혜택은 잃지 않습니다.</p>

        {d.deferredNextMonth.length > 0 && (
          <p className="note">
            {d.deferredNextMonth
              .map(
                (i) =>
                  `${i.product.shortName ?? i.product.name} ${formatMD(i.judgment.nextJudgmentDate.value!)}`,
              )
              .join(', ')}
            은 다음 달에 확인하는 조건이라 계산에서 뺐습니다. 옮긴 뒤 실적을 다시 채우면 유지됩니다.
          </p>
        )}
      </div>

      <div className="tlist">
        {d.items.map((item) => {
          const j = item.judgment;
          const date = j.nextJudgmentDate.value;
          return (
            <div key={item.condition.id} className={`trow ${rowClass(item)}`}>
              <span className="ico">
                <Glyph name={TYPE_ICON[item.product.type] ?? 'deposit'} size={19} />
              </span>
              <span className="body">
                <b>{item.product.name}</b>
                <span>
                  {j.cycleLabel.value} <SourceTag source={j.cycleLabel.source} />
                </span>
              </span>
              <span className="tail">
                {!j.active ? (
                  <em className="muted">확인 제외</em>
                ) : date === null ? (
                  <em className="danger">회복 불가</em>
                ) : (
                  <>
                    <em>{formatMD(date)}</em>
                    {j.recoverable && !j.countsForSafeAfter ? (
                      <span className="muted">다음 달 · 계산 제외</span>
                    ) : (
                      <SourceTag source={j.nextJudgmentDate.source} />
                    )}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {d.unrecoverable.map((item) => (
        <div key={item.condition.id} className="card warncard">
          <h3 className="cardtitle">{item.product.name} · 회복 불가</h3>
          <p>
            {perkLabel(item.condition)}는 가입 때 확정된 것이라 매달 확인하지 않습니다. {withJosa(center, '을/를')}{' '}
            {d.trigger.verb}하면 만기 <b>{formatKoYMD(item.judgment.recoverAt!.value)}</b>
            <SourceTag source={item.judgment.recoverAt!.source} />
            까지 이 우대 없이 이어지고, 다시 만들어도 되돌아오지 않습니다.
          </p>
        </div>
      ))}

      {d.inactive.map((item) => (
        <div key={item.condition.id} className="card offcard">
          <h3 className="cardtitle">{item.product.name} · 이미 미적용</h3>
          <p>{item.judgment.inactiveReason}. 지금도 받지 못하는 혜택이라 시점 계산에서 뺐습니다.</p>
        </div>
      ))}
    </AppShell>
  );
}

/** 같은 날짜에 점이 여럿이면 라벨은 하나만 */
function dedupeLabels(points: AxisPoint[]): AxisPoint[] {
  const seen = new Set<string>();
  return points.filter((p) => (seen.has(p.date) ? false : (seen.add(p.date), true)));
}
