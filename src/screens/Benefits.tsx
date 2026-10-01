import { AddonCard } from '../components/AddonCard';
import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TileIcon, TYPE_ICON } from '../components/Glyph';
import { addonProposals } from '../lib/addon';
import { formatKoMD, formatMD } from '../lib/format';
import { benefitLabel } from '../lib/money';
import { currentLabel } from '../lib/interpreter';
import { watchSummary, type WatchRow } from '../lib/watch';
import { useStore } from '../state/store';

/**
 * 혜택 탭 = 상시 분석 화면.
 * "지금 얼마 받고 있는가" 만이 아니라 "무엇이 언제 판정되는가" 까지 같이 본다.
 * 숫자와 날짜는 전부 watchSummary() 가 계산한 값이다.
 */
export function Benefits() {
  const { scenario, dispatch } = useStore();
  const watch = watchSummary(scenario);
  const addons = addonProposals(scenario);
  const active = watch.rows.filter((r) => r.judgment.active);

  return (
    <AppShell title="혜택">
      <div className="card summarycard">
        <span className="lbl">
          지금 받고 있는 우대 혜택
        </span>
        <Amount value={watch.activeTotal} short size="hero" prefix="연" />
        <span className="sub">
          상품 {watch.productCount}개 · 조건 {watch.linkCount}건
        </span>
      </div>

      <div className={`monitorbar${watch.nextDate ? '' : ' clear'}`}>
        <span className="ico" aria-hidden="true">
          <Glyph name="clock" size={18} />
        </span>
        <span className="tx">
          {watch.nextDate
            ? `다음 우대 확인일 ${formatKoMD(watch.nextDate)} · 이번 달 ${watch.dueSoon.length}건 남음`
            : '이번 달 우대가 모두 확정됐어요.'}
        </span>
      </div>

      <div className="plist card">
        {active.map((r) => (
          <WatchRowView key={r.condition.id} row={r} />
        ))}
      </div>

      {/* 실적 미달로 지금 못 받는 우대. "받고 있는" 목록에 섞으면 적용 중인 것처럼 읽힌다 */}
      {watch.inactive.length > 0 && (
        <>
          <h3 className="sectiontitle">조건을 채우면 받을 수 있는 우대</h3>
          <div className="plist card">
            {watch.inactive.map((r) => (
              <WatchRowView key={r.condition.id} row={r} />
            ))}
          </div>
        </>
      )}

      <AddonCard proposal={addons} title="지금 보유 상품에 더하면 이득인 상품" />

      <button
        type="button"
        className="btn primary"
        onClick={() => dispatch({ type: 'push', route: { name: 'hub' } })}
      >
        유지·변경 손익 분석하기
      </button>
    </AppShell>
  );
}

/**
 * 조건 행 하나. 살아있으면 "무엇을 받고 있고 무엇이 받치는가",
 * 미적용이면 "무엇을 채우면 받는가 · 지금 얼마인가" 를 적는다.
 */
function WatchRowView({ row: r }: { row: WatchRow }) {
  const { dispatch } = useStore();
  const on = r.judgment.active;
  const date = r.judgment.nextJudgmentDate.value;
  const now = currentLabel(r.condition);
  const dep = on
    ? `${r.target.shortName ?? r.target.name} 유지 조건 · ${r.requirement}`
    : `${r.requirement}이면 받아요${now ? ` · 지금 ${now}` : ''}`;
  return (
    <div className={`prow${on ? '' : ' off'}`}>
      <TileIcon name={TYPE_ICON[r.holder.type] ?? 'deposit'} size={20} />
      <span className="body">
        <b>{r.holder.name}</b>
        <span>
          {benefitLabel(r.condition, r.holder, on)} · {r.judgment.cycleLabel.value}
        </span>
        {/* 조건이 걸린 상품에 분석 트리거가 있으면 그리로 간다. 트리거 목록의 복제가 아니라 이 조건에서 이어지는 맥락 링크다 */}
        {r.triggerId ? (
          <button
            type="button"
            className="dep link"
            onClick={() => dispatch({ type: 'push', route: { name: 'analyzing', triggerId: r.triggerId! } })}
          >
            {dep} · 분석 보기
            <Glyph name="chevron" size={12} />
          </button>
        ) : (
          <span className="dep">{dep}</span>
        )}
      </span>
      <span className="tail">
        <Amount value={r.annualBenefit} short />
        <em className={`due${r.dueThisMonth && on ? ' soon' : ''}`}>
          {on ? (date ? `${formatMD(date)} 확인` : '만기까지 고정') : '미적용'}
        </em>
      </span>
    </div>
  );
}
