import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { QuickMenu } from '../components/QuickMenu';
import { SourceTag } from '../components/SourceTag';
import { formatKoMD, formatMD } from '../lib/format';
import { totalAssets } from '../lib/portfolio';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

export function Home() {
  const { scenario, dispatch } = useStore();
  const { home, brand } = scenario;
  const assets = totalAssets(scenario);
  const watch = watchSummary(scenario);

  const openAi = () => dispatch({ type: 'push', route: { name: 'hub' } });

  return (
    <AppShell
      header={
        <div className="homehead">
          <span className="logo">{brand.short}</span>
          <div className="homehead-actions">
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

      <QuickMenu />

      <button type="button" className="aibanner" onClick={openAi}>
        <div className="txt">
          <b>{brand.service}</b>
          <span>{brand.serviceTagline}</span>
          <em className="live">
            <i className="dot" aria-hidden="true" />
            상품 {watch.productCount}개 · 우대 조건 {watch.linkCount}건 상시 분석 중
          </em>
        </div>
        <span className="go" aria-hidden="true">
          <Glyph name="arrow" size={20} />
        </span>
      </button>

      <section className="card watchcard">
        <h3 className="cardtitle">
          이번 달 점검
          <SourceTag source={watch.activeTotal.source} />
        </h3>
        <p className="chartnote">
          {watch.nextDate
            ? `${formatKoMD(watch.nextDate)}부터 우대 판정이 시작됩니다. 이번 달에 ${watch.dueSoon.length}건이 남았습니다.`
            : '이번 달 우대 판정은 모두 끝났습니다.'}
        </p>

        <div className="watchlist">
          {watch.dueSoon.slice(0, 3).map((r) => (
            <button
              key={r.condition.id}
              type="button"
              className="wrow"
              disabled={r.triggerId === null}
              onClick={() =>
                r.triggerId &&
                dispatch({ type: 'push', route: { name: 'analyzing', triggerId: r.triggerId } })
              }
            >
              <span className="d">{formatMD(r.judgment.nextJudgmentDate.value!)}</span>
              <span className="body">
                <b>{r.holder.name}</b>
                <span>{r.requirement}</span>
              </span>
              <span className="tail">
                <Amount value={r.annualBenefit} short />
                <Glyph name="chevron" size={15} />
              </span>
            </button>
          ))}
        </div>

        {watch.inactive.length > 0 && (
          <p className="note warn">
            실적 미달로 지금 받지 못하는 우대가 {watch.inactive.length}건 있습니다.
          </p>
        )}

        <button type="button" className="btn text" onClick={() => dispatch({ type: 'selectTab', tab: 'benefits' })}>
          받고 있는 우대 전부 보기
          <Glyph name="chevron" size={14} />
        </button>
      </section>
    </AppShell>
  );
}
