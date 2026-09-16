import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { SpendChart } from '../components/SpendChart';
import { formatPercent } from '../lib/format';
import { spendSummary, totalAssets } from '../lib/portfolio';
import { useStore, type Tab } from '../state/store';

export function Home() {
  const { scenario, dispatch } = useStore();
  const { home, brand } = scenario;
  const assets = totalAssets(scenario);
  const spend = spendSummary(scenario);

  const openAi = () => dispatch({ type: 'push', route: { name: 'switchpoint' } });

  return (
    <AppShell
      header={
        <div className="homehead">
          <button type="button" className="logo">
            {brand.short}
            <Glyph name="chevron" size={16} />
          </button>
          <div className="homehead-actions">
            <button type="button" aria-label="검색">
              <Glyph name="search" size={22} />
            </button>
            <button type="button" aria-label="알림">
              <Glyph name="bell" size={22} />
            </button>
            <button type="button" aria-label="전체메뉴" onClick={() => dispatch({ type: 'selectTab', tab: 'more' })}>
              <Glyph name="menu" size={22} />
            </button>
          </div>
        </div>
      }
    >
      <h2 className="greeting">
        {home.userName}님
        <br />
        {home.greeting}
      </h2>

      <button type="button" className="card assetcard" onClick={() => dispatch({ type: 'selectTab', tab: 'assets' })}>
        <span className="lbl">
          총 자산 <Glyph name="eye" size={15} />
        </span>
        <span className="row">
          <Amount value={assets} short size="xl" />
          <Glyph name="chevron" size={18} />
        </span>
      </button>

      <div className="quickgrid">
        {home.quickMenu.map((q) => (
          <button
            key={q.label}
            type="button"
            className={q.key === 'ai' ? 'quick ai' : 'quick'}
            onClick={() => (q.tab ? dispatch({ type: 'selectTab', tab: q.tab as Tab }) : openAi())}
          >
            <span className={`ico tint-${q.key}`}>
              <Glyph name={q.key} size={23} />
            </span>
            <span className="qlabel">{q.label}</span>
          </button>
        ))}
      </div>

      <button type="button" className="aibanner" onClick={openAi}>
        <div className="txt">
          <b>{brand.service}</b>
          <span>{brand.serviceTagline}</span>
        </div>
        <span className="go" aria-hidden="true">
          <Glyph name="arrow" size={20} />
        </span>
      </button>

      <div className="card spendcard">
        <span className="lbl">이번 달 소비</span>
        <div className="row">
          <Amount value={spend.current} short size="lg" />
          <SpendChart summary={spend} />
        </div>
        {spend.delta && (
          <span className={`delta ${spend.delta.value < 0 ? 'down' : 'up'}`}>
            전월 대비 {spend.delta.value < 0 ? '−' : '+'}
            {formatPercent(spend.delta.value)}
          </span>
        )}
      </div>
    </AppShell>
  );
}
