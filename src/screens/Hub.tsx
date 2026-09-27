import { useEffect } from 'react';
import { Glyph, TileIcon } from '../components/Glyph';
import { derive } from '../lib/derive';
import type { Trigger } from '../lib/types';
import { useStore } from '../state/store';

/**
 * 가정 넣어 보기 허브. "카드를 해지하면?" 은 사용자만 줄 수 있으니 여기서 고른다.
 * "상시 분석 중" 은 홈(배너 숫자·이번 달 점검)이 이미 말했다 — 여기서 되풀이하지 않고, 그 분석을 입력으로 언급만 한다.
 * 손익 금액을 미리 보여주지 않는다 — 영향받는 상품 수·이름만 적고, 숫자는 분석을 거친 뒤 나온다.
 * 행 제목은 기능 이름이 아니라 사용자의 질문(trigger.question)이다.
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

  // 대표 사례(관리비)는 맨 위에 따로
  const featured = scenario.triggers.filter((t) => t.featured);
  const rest = scenario.triggers.filter((t) => !t.featured);

  const row = (t: Trigger) => {
    const d = derive(scenario, t.id);
    return (
      <button
        key={t.id}
        type="button"
        className={t.featured ? 'triggerrow featured' : 'triggerrow'}
        onClick={() => dispatch({ type: 'push', route: { name: 'analyzing', triggerId: t.id } })}
      >
        <TileIcon name={t.icon} size={20} />
        <span className="body">
          {/* 제목은 사용자가 스스로 할 질문. 보조 줄은 함께 달라지는 상품 이름만 — 금액은 적지 않는다 */}
          <b>{t.question ?? t.label}</b>
          {d.graph.satellites.length > 0 && (
            <span>영향받는 상품 · {affectedNames(d.graph.satellites.map((s) => s.product))}</span>
          )}
          {d.missing.length > 0 && <em className="need">확인 필요 · {d.missing.join('·')}</em>}
        </span>
        <Glyph name="chevron" size={17} />
      </button>
    );
  };

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
        {featured.length > 0 && <div className="triggerlist featured">{featured.map(row)}</div>}

        <h2 className="sectiontitle">{featured.length > 0 ? '다른 경우도 미리 보기' : '바꿔 볼 항목을 고르세요'}</h2>

        <div className="triggerlist">{rest.map(row)}</div>
      </section>
    </div>
  );
}
