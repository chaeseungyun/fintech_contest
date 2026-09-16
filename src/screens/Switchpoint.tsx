import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { MiniGraph } from '../components/MiniGraph';
import { derive } from '../lib/derive';
import { useStore } from '../state/store';

/** SwitchPoint AI 허브. 분석 진입점(트리거)을 고르는 화면. */
export function Switchpoint() {
  const { scenario, derived: d, dispatch } = useStore();

  return (
    <AppShell
      title={scenario.brand.service}
      onBack={() => dispatch({ type: 'back' })}
      actions={
        <button type="button" aria-label="서비스 안내">
          <Glyph name="info" size={21} />
        </button>
      }
    >
      <h2 className="hero">
        변경 전,
        <br />
        연결된 영향을 먼저 확인하세요.
      </h2>
      <p className="herosub">{scenario.home.bannerBody}</p>

      <MiniGraph graph={d.graph} nodeLabel={d.trigger.nodeLabel} />

      <h3 className="sectiontitle">분석할 항목을 선택하세요.</h3>

      <div className="triggerlist">
        {scenario.triggers.map((t) => {
          const linked = derive(scenario, t.id).graph.satellites.length;
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
                <span>{t.sublabel}</span>
              </span>
              <span className="tail">
                {linked > 0 && <em className="linkcount">연결 {linked}</em>}
                <Glyph name="chevron" size={18} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="footnote">
        분석은 보유 상품 정보와 약관 원문에서 추출한 조건만으로 계산합니다. 오늘 날짜는{' '}
        {scenario.meta.today} 로 고정되어 있습니다.
      </p>
    </AppShell>
  );
}
