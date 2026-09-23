import { useEffect } from 'react';
import { Glyph, TileIcon } from '../components/Glyph';
import { derive } from '../lib/derive';
import { formatKoYMD } from '../lib/format';
import { useStore } from '../state/store';

/**
 * 가정 넣어 보기 허브. "카드를 해지하면?" 은 사용자만 줄 수 있으니 여기서 고른다.
 * "상시 분석 중" 은 홈(배너 숫자·이번 달 점검)이 이미 말했다 — 여기서 되풀이하지 않고, 그 분석을 입력으로 언급만 한다.
 * 손익 금액을 미리 보여주지 않는다 — 연결 건수와 영향 상품만 적고, 숫자는 분석을 거친 뒤 나온다.
 */
function affectedNames(products: { shortName?: string; name: string }[]): string {
  const seen: string[] = [];
  for (const p of products) {
    const n = p.shortName ?? p.name;
    if (!seen.includes(n)) seen.push(n);
  }
  return seen.join(' · ');
}

export function Hub() {
  const { scenario, dispatch } = useStore();
  const close = () => dispatch({ type: 'back' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sheetlayer">
      <button type="button" className="scrim" aria-label="닫기" tabIndex={-1} onClick={close} />
      <section className="bottomsheet" role="dialog" aria-modal="true" aria-labelledby="hub-title">
        <span className="grab" aria-hidden="true" />
        <div className="sheethead">
          <div>
            <span className="eyebrow">{scenario.brand.service}</span>
            <h1 id="hub-title">
              {scenario.home.bannerTitle.split('\n').map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </h1>
          </div>
          <button type="button" className="navbtn" aria-label="닫기" onClick={close}>
            <Glyph name="close" size={20} />
          </button>
        </div>
        <p className="herosub">{scenario.home.bannerBody}</p>

        <h2 className="sectiontitle">바꿔 볼 항목을 고르세요</h2>

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
                <TileIcon name={t.icon} size={20} />
                <span className="body">
                  <b>{t.label}</b>
                  <span>
                    {d.center.institution} {d.center.name} · 연결 혜택 {d.graph.edges.length}건
                  </span>
                  {d.items.length > 0 && <span>{affectedNames(d.items.map((i) => i.product))}</span>}
                  {d.missing.length > 0 && <em className="need">확인 필요 · {d.missing.join('·')}</em>}
                </span>
                <Glyph name="chevron" size={17} />
              </button>
            );
          })}
        </div>

        <p className="footnote">
          항목을 고르면 미리 찾아 둔 연결에 그 변경을 넣어 우대 변화와 손익을 계산합니다. 보유 상품 정보와
          약관에서 추출해 둔 샘플 조건만으로 계산하며, 기준일은 {formatKoYMD(scenario.meta.today)}로 고정되어 있습니다.
        </p>
      </section>
    </div>
  );
}
