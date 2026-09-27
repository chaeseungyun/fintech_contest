import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TileIcon } from '../components/Glyph';
import { QuickMenu } from '../components/QuickMenu';
import { formatDotYMD, formatKoMD, formatWonShort } from '../lib/format';
import { totalAssets, totalDebt } from '../lib/portfolio';
import { tag } from '../lib/types';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

export function Home() {
  const { scenario, dispatch } = useStore();
  const { home, brand } = scenario;
  const assets = totalAssets(scenario);
  const debt = totalDebt(scenario);
  const watch = watchSummary(scenario);

  // 대표 계좌는 데이터(home.mainAccountId)가 정한다. 없으면 총자산을 크게 쓴다
  const main = scenario.products.find((p) => p.id === home.mainAccountId);
  const cards = scenario.products.filter((p) => p.type === 'credit_card');
  const loans = scenario.products.filter((p) => p.type === 'loan');
  const cardSpend = tag(
    cards.reduce((a, c) => a + (c.facts.monthlySpendCurrent ?? 0), 0),
    'holding',
  );

  const openAi = () => dispatch({ type: 'push', route: { name: 'hub' } });
  const toBenefits = () => dispatch({ type: 'selectTab', tab: 'benefits' });
  const toAssets = (section: string) => dispatch({ type: 'selectTab', tab: 'assets', section });

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
      {/* 은행 홈의 문법 — 대표 계좌 → 퀵메뉴 → 배너 한 칸(이 기능) → 카드·대출 요약 */}
      <button type="button" className="card assetcard" onClick={() => toAssets('account')}>
        <span className="body">
          <span className="lbl">{main ? main.name : `${home.userName}님의 총 자산`}</span>
          <Amount value={main ? tag(main.facts.balance ?? 0, 'holding') : assets} short size="xl" />
          <span className="sub">
            {main ? `총 자산 ${formatWonShort(assets.value)}` : debt.value > 0 && `대출 잔액 ${formatWonShort(debt.value)}`}
          </span>
        </span>
        <Glyph name="chevron" size={18} />
      </button>

      <QuickMenu />

      {/* 은행 안의 메뉴 배너 하나. 위는 분석(허브), 아래 한 줄은 이번 달 점검(혜택 탭) — 점검 목록은 혜택 탭에 있다 */}
      <div className="aibanner">
        <button type="button" className="aimain" onClick={openAi}>
          <span className="txt">
            <b>{brand.service}</b>
            {/* 기능 설명이 아니라 사용자가 품을 질문으로 연다 */}
            <span>{home.bannerQuestion ?? brand.serviceTagline}</span>
            <em className="live">
              <i className="dot" aria-hidden="true" />
              상품 {watch.productCount}개 · 혜택 조건 {watch.linkCount}건 상시 분석 중
            </em>
          </span>
          <Glyph name="arrow" size={20} />
        </button>
        <button type="button" className="aicheck" onClick={toBenefits}>
          <Glyph name="clock" size={15} />
          <span>
            {watch.nextDate
              ? `${formatKoMD(watch.nextDate)} 우대 확인 · 이번 달 ${watch.dueSoon.length}건 남음`
              : '이번 달 우대가 모두 확정됐어요'}
          </span>
          <Glyph name="chevron" size={14} />
        </button>
      </div>
      {/* 카드·대출 요약 — 은행 홈에 늘 있는 블록. 누르면 자산 탭의 그 섹션으로 간다 */}
      {(cards.length > 0 || loans.length > 0) && (
        <section className="card homesum">
          {cards.length > 0 && (
            <button type="button" className="sumrow" onClick={() => toAssets('card')}>
              <TileIcon name="card" size={19} />
              <span className="body">
                <b>이번 달 카드 이용</b>
                <span>{cards.map((c) => c.shortName ?? c.name).join(' · ')}</span>
              </span>
              <Amount value={cardSpend} short />
              <Glyph name="chevron" size={15} />
            </button>
          )}
          {loans.length > 0 && (
            <button type="button" className="sumrow" onClick={() => toAssets('loan')}>
              <TileIcon name="loan" size={19} />
              <span className="body">
                <b>대출 {loans.length}건</b>
                <span>{loans.map((l) => l.shortName ?? l.name).join(' · ')}</span>
              </span>
              <Amount value={debt} short />
              <Glyph name="chevron" size={15} />
            </button>
          )}
        </section>
      )}

    </AppShell>
  );
}
