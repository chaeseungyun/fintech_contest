import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { derive } from '../lib/derive';
import { formatKoMD, formatKoYMD } from '../lib/format';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

/**
 * 상시 분석 허브. 두 층이다 —
 *   ① 상시 분석의 결과(watch): 트리거 없이 보유 상태만 보고 이미 계산돼 있는 것. "분석 중" 이 빈말이 아니라는 증거.
 *   ② 가정 넣어 보기(트리거): "카드를 해지하면?" 은 사용자만 줄 수 있으니 여기서 고른다.
 * 여기서는 손익 금액을 미리 보여주지 않는다 — 연결 건수와 영향 상품만 적고, 숫자는 분석을 거친 뒤 나온다.
 */
function affectedNames(products: { shortName?: string; name: string }[]): string {
  const seen: string[] = [];
  for (const p of products) {
    const n = p.shortName ?? p.name;
    if (!seen.includes(n)) seen.push(n);
  }
  return seen.join('·');
}

export function Hub() {
  const { scenario, dispatch } = useStore();
  const watch = watchSummary(scenario);

  return (
    <AppShell title={scenario.brand.service} onBack={() => dispatch({ type: 'back' })}>
      <h2 className="hero">
        {scenario.home.bannerTitle.split('\n').map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </h2>

      {/* "분석하고 있다" 의 증거 — 홈 배너·혜택 탭과 같은 watch 값이다. 여기서 새로 세지 않는다 */}
      <button type="button" className="livecard" onClick={() => dispatch({ type: 'selectTab', tab: 'benefits' })}>
        <span className="body">
          <b>
            <i className="dot" aria-hidden="true" />
            상품 {watch.productCount}개 · 우대 조건 {watch.linkCount}건을 계속 보고 있습니다
          </b>
          <span>
            {watch.nextDate
              ? `이번 달 우대 확인일 ${watch.dueSoon.length}건 · 다음은 ${formatKoMD(watch.nextDate)}`
              : '이번 달 우대 확인은 모두 끝났습니다'}
            {watch.inactive.length > 0 && ` · 실적 미달 ${watch.inactive.length}건`}
          </span>
        </span>
        <span className="tail">
          상시 점검
          <Glyph name="chevron" size={15} />
        </span>
      </button>

      <h3 className="sectiontitle">바꾸면 어떻게 될지 미리 보기</h3>
      <p className="herosub">{scenario.home.bannerBody}</p>
      {/* 항목을 누르면 이 순서로 진행된다 — 연결은 이미 찾아 뒀으니 계산부터 */}
      <ol className="howto">
        <li>손익 비교</li>
        <li>바꿔도 되는 시점</li>
        <li>실행 순서 안내</li>
      </ol>

      <div className="triggerlist">
        {scenario.triggers.map((t) => {
          const d = derive(scenario, t.id);
          return (
            <button
              key={t.id}
              type="button"
              className="triggerrow"
              onClick={() => dispatch({ type: 'push', route: { name: 'analyzing', triggerId: t.id } })}
            >
              <span className={`ico tint-${t.icon}`}>
                <Glyph name={t.icon} size={22} />
              </span>
              <span className="body">
                <b>{t.label}</b>
                <span>
                  {d.center.institution} {d.center.name} · 연결 혜택 {d.graph.edges.length}건
                  {d.items.length > 0 && ` · ${affectedNames(d.items.map((i) => i.product))}`}
                </span>
                {d.missing.length > 0 && <em className="need">확인 필요 · {d.missing.join('·')}</em>}
              </span>
              <span className="tail">
                <Glyph name="chevron" size={18} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="footnote">
        항목을 고르면 미리 찾아 둔 연결에 그 변경을 넣어 우대 변화와 손익을 계산합니다. 보유 상품 정보와
        약관에서 추출해 둔 샘플 조건만으로 계산하며, 기준일은 {formatKoYMD(scenario.meta.today)}로 고정되어 있습니다.
      </p>
    </AppShell>
  );
}
