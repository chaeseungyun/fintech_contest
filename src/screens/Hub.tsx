import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { MiniGraph } from '../components/MiniGraph';
import { SourceTag } from '../components/SourceTag';
import { derive } from '../lib/derive';
import { formatKoMD } from '../lib/format';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

/** 상시 분석 허브. 분석 진입점(트리거)을 고르는 화면. */
export function Hub() {
  const { scenario, derived: d, dispatch } = useStore();
  const watch = watchSummary(scenario);

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
        {scenario.home.bannerTitle.split('\n').map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </h2>
      <p className="herosub">{scenario.home.bannerBody}</p>

      <div className="flowbar">
        {['상시 분석', '손익 판정', '최종 판단', '실행 안내'].map((s, i) => (
          <span key={s} className={i === 0 ? 'on' : undefined}>
            {s}
          </span>
        ))}
      </div>

      <MiniGraph graph={d.graph} nodeLabel={d.trigger.nodeLabel} />

      <div className="monitorbar">
        <span className="ico" aria-hidden="true">
          <Glyph name="clock" size={18} />
        </span>
        <span className="tx">
          상품 {watch.productCount}개 · 우대 조건 {watch.linkCount}건을 보고 있습니다.
          {watch.nextDate
            ? ` 다음 판정일은 ${formatKoMD(watch.nextDate)}입니다.`
            : ' 이번 달 판정은 모두 끝났습니다.'}
        </span>
        <SourceTag source="calc" />
      </div>

      <h3 className="sectiontitle">유지·변경 손익을 따져볼 항목</h3>

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
