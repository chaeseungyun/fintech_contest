import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { QuickMenu } from '../components/QuickMenu';
import { Term } from '../components/Term';
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
          {/* 기능 설명이 아니라 사용자가 품을 질문으로 연다 */}
          <span>{home.bannerQuestion ?? brand.serviceTagline}</span>
          <em className="live">
            <i className="dot" aria-hidden="true" />
            상품 {watch.productCount}개 · 혜택 조건 {watch.linkCount}건 상시 분석 중
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
          {watch.nextDate ? (
            <>
              다음 <Term term="우대 확인일" /> {formatKoMD(watch.nextDate)}
            </>
          ) : (
            '이번 달 우대 확인은 모두 끝났어요.'
          )}
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
          <p className="note warn">지금 못 받고 있는 우대 {watch.inactive.length}건</p>
        )}

        <button type="button" className="btn text" onClick={toBenefits}>
          받고 있는 우대 전부 보기
          <Glyph name="chevron" size={14} />
        </button>
      </section>
    </AppShell>
  );
}
