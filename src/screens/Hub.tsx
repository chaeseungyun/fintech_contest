import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { derive } from '../lib/derive';
import { useStore } from '../state/store';

/** 상시 분석 허브. 분석 진입점(트리거)을 고르는 화면. */
export function Hub() {
  const { scenario, dispatch } = useStore();

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
      <p className="herosub">{scenario.home.bannerBody}</p>

      <h3 className="sectiontitle">유지·변경 손익을 따져볼 항목</h3>

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
                  {d.center.institution} {d.center.name} · 연결 조건 {d.graph.edges.length}건
                </span>
              </span>
              <span className="tail">
                <Amount value={d.netAnnual} signed short />
                <Glyph name="chevron" size={18} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="footnote">
        금액은 지금 실행했을 때의 연 기준 순손익입니다. 보유 상품 정보와 약관 원문에서 추출한
        조건만으로 계산하며, 오늘 날짜는 {scenario.meta.today} 로 고정되어 있습니다.
      </p>
    </AppShell>
  );
}
