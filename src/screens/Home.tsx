import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { QuickMenu } from '../components/QuickMenu';
import { formatDotMD, formatDotYMD, formatKoMD, formatWonShort } from '../lib/format';
import { totalAssets, totalDebt } from '../lib/portfolio';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

export function Home() {
  const { scenario, dispatch } = useStore();
  const { home, brand } = scenario;
  const assets = totalAssets(scenario);
  const debt = totalDebt(scenario);
  const watch = watchSummary(scenario);

  const openAi = () => dispatch({ type: 'push', route: { name: 'hub' } });
  const toBenefits = () => dispatch({ type: 'selectTab', tab: 'benefits' });

  return (
    <AppShell
      header={
        <div className="homehead">
          {/* 홈 상단은 은행이다. 이 기능(brand.service)은 그 안의 메뉴·배너로만 나온다 */}
          <span className="logo">{brand.bank}</span>
          <span className="samplechip">
            샘플 데이터 · 기준일 <span className="mono">{formatDotYMD(scenario.meta.today)}</span>
          </span>
          <div className="homehead-actions">
            <button type="button" aria-label="전체메뉴" onClick={() => dispatch({ type: 'selectTab', tab: 'more' })}>
              <Glyph name="menu" size={22} />
            </button>
          </div>
        </div>
      }
    >
      {/* 은행 홈의 문법 — 총자산이 맨 위다 */}
      <button type="button" className="card assetcard" onClick={() => dispatch({ type: 'selectTab', tab: 'assets' })}>
        <span className="body">
          <span className="lbl">{home.userName}님의 총 자산</span>
          <Amount value={assets} short size="xl" />
          {debt.value > 0 && <span className="sub">대출 잔액 {formatWonShort(debt.value)}</span>}
        </span>
        <Glyph name="chevron" size={18} />
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
        <Glyph name="arrow" size={20} />
      </button>

      <section className="card watchcard">
        <div className="cardhead">
          <h2 className="cardtitle">이번 달 점검</h2>
          {watch.dueSoon.length > 0 && <span className="count">{watch.dueSoon.length}건 남음</span>}
        </div>
        <p className="chartnote">
          {watch.nextDate
            ? `${formatKoMD(watch.nextDate)}부터 은행이 우대 실적을 확인합니다. 확인이 끝나면 그 달 우대는 확정됩니다.`
            : '이번 달 우대 확인은 모두 끝났습니다.'}
        </p>

        <div className="watchlist">
          {/* 점검 행은 혜택 탭(상시 점검)으로 간다. 해지 분석으로 바로 튀지 않는다 — 분석 진입은 허브에서만 */}
          {watch.dueSoon.slice(0, 3).map((r) => (
            <button key={r.condition.id} type="button" className="wrow" onClick={toBenefits}>
              <span className="d">{formatDotMD(r.judgment.nextJudgmentDate.value!)}</span>
              <span className="body">
                <b>{r.holder.name}</b>
                <span>{r.requirement}</span>
              </span>
              <span className="tail">
                <Amount value={r.annualBenefit} short prefix="연" />
                <Glyph name="chevron" size={15} />
              </span>
            </button>
          ))}
        </div>

        {watch.inactive.length > 0 && (
          <p className="note warn">실적 미달로 지금 받지 못하는 우대가 {watch.inactive.length}건 있습니다.</p>
        )}

        <button type="button" className="btn text" onClick={toBenefits}>
          받고 있는 우대 전부 보기
          <Glyph name="chevron" size={14} />
        </button>
      </section>
    </AppShell>
  );
}
