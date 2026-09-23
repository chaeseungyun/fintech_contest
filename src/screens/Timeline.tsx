import { AppShell } from '../components/AppShell';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import type { Axis, AxisPoint, Derived } from '../lib/derive';
import { formatDotMD, formatDotYMD, formatKoMD, formatKoYMD, withJosa } from '../lib/format';
import { perkLabel } from '../lib/money';
import { useStore } from '../state/store';

/* 축 SVG 의 viewBox 좌표 */
const W = 334;
const LINE_Y = 48;
const LEFT = 20;
const RIGHT = 322;
/** 만기 점이 있으면 이번 달 축을 여기까지 줄이고, 그 뒤는 끊긴 선으로 만기까지 잇는다 */
const MONTH_END = 262;
const MATURITY_X = 300;
/** 라벨 둘이 이보다 가까우면 뒤의 것을 한 줄 내린다 */
const LABEL_GAP = 32;

const DOT: Record<AxisPoint['kind'], string> = {
  today: 'today',
  judgment: 'judgment',
  safe: 'safe',
  inactive: 'inactive',
};

/** 같은 날짜에 점이 여럿이면 라벨은 하나만 */
function dedupeLabels(points: AxisPoint[]): AxisPoint[] {
  const seen = new Set<string>();
  return points.filter((p) => (seen.has(p.date) ? false : (seen.add(p.date), true)));
}

/**
 * 시점 축. 점은 종류별로 색을 나눈다 — 오늘(네이비) · 우대 확인일(테두리) · 변경 가능 구간 시작(초록) · 만기(벽돌).
 * 위치는 derive().axis 의 pct 에서만 온다.
 */
function AxisChart({ axis, d }: { axis: Axis; d: Derived }) {
  const maturity = d.recoverBy;
  const end = maturity ? MONTH_END : RIGHT;
  const x = (pct: number) => LEFT + (pct / 100) * (end - LEFT);
  const safeX = x(axis.safeFromPct);

  let prevX = -Infinity;
  let prevLow = false;
  const labels = dedupeLabels(axis.points).map((p) => {
    const px = x(p.pct);
    const low = px - prevX < LABEL_GAP && !prevLow;
    prevX = px;
    prevLow = low;
    return { p, px, y: low ? 86 : 72 };
  });

  const summary = axis.points
    .map((p) => (p.kind === 'today' ? `오늘 ${formatKoMD(p.date)}` : formatKoMD(p.date)))
    .concat(maturity ? [`만기 ${formatKoYMD(maturity)}`] : [])
    .join(', ');

  return (
    <svg className="axischart" viewBox={`0 0 ${W} 104`} role="img" aria-label={`시점 축. ${summary}`}>
      <rect className="zone" x={safeX} y={34} width={RIGHT - safeX} height={28} rx={6} />
      <text className="zonelabel" x={(safeX + RIGHT) / 2} y={26}>
        변경 가능 구간
      </text>
      <path className="ln" d={`M${LEFT - 4} ${LINE_Y}H${end}`} />
      {maturity && <path className="ln gap" d={`M${end} ${LINE_Y}H${RIGHT}`} />}
      {axis.points.map((p, i) => (
        <circle
          key={`${p.date}-${p.conditionId ?? 'today'}-${i}`}
          className={`pt ${DOT[p.kind]}`}
          cx={x(p.pct)}
          cy={LINE_Y}
          r={p.kind === 'judgment' || p.kind === 'inactive' ? 4 : 5}
        />
      ))}
      {maturity && <circle className="pt maturity" cx={MATURITY_X} cy={LINE_Y} r={4.5} />}
      {labels.map(({ p, px, y }) => (
        <text
          key={p.date}
          className={`lb ${DOT[p.kind]}`}
          x={p.kind === 'today' ? LEFT : px}
          y={y}
          textAnchor={p.kind === 'today' ? 'start' : 'middle'}
        >
          {p.kind === 'today' ? '오늘' : formatDotMD(p.date)}
        </text>
      ))}
      {maturity && (
        <>
          <text className="lb maturity" x={W - 8} y={72} textAnchor="end">
            {formatDotYMD(maturity)}
          </text>
          <text className="lbsub" x={W - 8} y={86} textAnchor="end">
            {d.unrecoverable.map((i) => i.product.shortName ?? i.product.name).join('·')} 만기
          </text>
        </>
      )}
    </svg>
  );
}

export function Timeline() {
  const { derived: d, dispatch } = useStore();
  const center = d.center.shortName ?? d.center.name;
  const { timing } = d;

  return (
    <AppShell title="우대 확인일과 변경 가능 구간" onBack={() => dispatch({ type: 'back' })} hideTabBar>
      {/* 제목이 결론을 말한다. "안전" 이라는 말을 기한에 쓰지 않는다 */}
      <div className="pagehead">
        <h1>
          {timing.alreadySafe ? (
            <>
              이번 달 우대 확인은
              <br />
              모두 끝났습니다
            </>
          ) : (
            <>
              {formatKoMD(timing.safeAfter.value)}이 지나면
              <br />
              이번 달 우대가 확정됩니다
            </>
          )}
        </h1>
        <p>
          우대 확인일은 은행이 실적을 채웠는지 보고 그 달 우대를 줄지 정하는 날입니다. 이 날이 지나면 그 달
          우대는 확정되어, 그 뒤에 바꿔도 그 달 혜택은 잃지 않습니다.
        </p>
      </div>

      <section className="card axiscard">
        <span className="asof">오늘 {formatDotYMD(d.today)} 기준</span>
        <AxisChart axis={d.axis} d={d} />
        <p className="axisnote">
          {timing.alreadySafe ? (
            <>이번 달 우대가 이미 확정됐습니다. 지금 바꿔도 이번 달 혜택은 잃지 않습니다.</>
          ) : (
            <>
              마지막 확인이 끝나는 <b>{formatKoMD(timing.safeAfter.value)}</b> 뒤부터가 이번 달 혜택을 잃지 않고
              바꿀 수 있는 구간입니다.
            </>
          )}
        </p>
      </section>

      <div className="tlist">
        <h2 className="sectiontitle">조건별 확인일</h2>
        {d.items.map((item) => {
          const j = item.judgment;
          const date = j.nextJudgmentDate.value;
          return (
            <div key={item.condition.id} className="trow">
              <span className="ico">
                <Glyph name={TYPE_ICON[item.product.type] ?? 'deposit'} size={18} />
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
                    <em className="d">{formatDotMD(date)}</em>
                    {j.recoverable && !j.countsForSafeAfter && <span className="muted">다음 달 · 계산 제외</span>}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* 되돌릴 수 없는 우대 — 상품·우대폭·만기·결과를 다 적는다 */}
      {d.unrecoverable.map((item) => (
        <section key={item.condition.id} className="warncard">
          <h2>
            <Glyph name="info" size={16} />
            기다려도 돌아오지 않는 우대
          </h2>
          <p>
            {item.product.name}의 {perkLabel(item.condition)}는 {withJosa(center, '을/를')} 보유한 조건으로{' '}
            <b>가입일에 확정</b>된 것입니다. 지금 {d.trigger.verb}하면 만기{' '}
            <b>{formatKoYMD(item.judgment.recoverAt!.value)}</b>
            <SourceTag source={item.judgment.recoverAt!.source} />
            까지 이 우대 없이 이어지고, {withJosa(center, '을/를')} 다시 만들어도 되돌아오지 않습니다.
          </p>
          <span className="doc">{item.condition.sourceDoc}</span>
        </section>
      ))}

      {d.inactive.map((item) => (
        <div key={item.condition.id} className="card offcard">
          <h3 className="cardtitle">{item.product.name} · 이미 미적용</h3>
          <p>{item.judgment.inactiveReason}. 지금도 받지 못하는 혜택이라 시점 계산에서 뺐습니다.</p>
        </div>
      ))}

      {d.deferredNextMonth.length > 0 && (
        <p className="footnote">
          {d.deferredNextMonth
            .map((i) => `${i.product.shortName ?? i.product.name} ${formatKoMD(i.judgment.nextJudgmentDate.value!)}`)
            .join(', ')}
          은 다음 달에 확인하는 조건이라 이번 달 변경 가능 구간 계산에서 뺐습니다. 옮긴 뒤 실적을 다시 채우면
          유지됩니다.
        </p>
      )}
    </AppShell>
  );
}
