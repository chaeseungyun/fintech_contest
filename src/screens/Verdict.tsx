import { AddonCard } from '../components/AddonCard';
import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import { RecommendCard } from '../components/RecommendCard';
import { SourceTag } from '../components/SourceTag';
import { formatMonths, withJosa } from '../lib/format';
import { useStore } from '../state/store';

export function Verdict({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const v = d.verdict;
  const name = d.center.shortName ?? d.center.name;

  return (
    <AppShell
      title="최종 판단"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        v.kind === 'keep' ? (
          // 유지 판정: 강조 버튼은 다음 분석. 해지 절차는 "그래도" 를 붙여 한 단계 아래에 둔다.
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() => dispatch({ type: 'popTo', name: 'hub' })}
            >
              다른 항목도 분석해보기
            </button>
            <button
              type="button"
              className="btn text"
              onClick={() => dispatch({ type: 'push', route: { name: 'actionplan', triggerId } })}
            >
              그래도 {d.trigger.verb}한다면 · 절차 보기
              <Glyph name="chevron" size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() => dispatch({ type: 'push', route: { name: 'actionplan', triggerId } })}
            >
              {d.trigger.verb} 절차 안내받기
            </button>
            <button
              type="button"
              className="btn text"
              onClick={() => dispatch({ type: 'popTo', name: 'hub' })}
            >
              다른 항목도 분석해보기
              <Glyph name="chevron" size={14} />
            </button>
          </>
        )
      }
    >
      <div className={`verdictcard ${v.kind}`}>
        <span className="mark" aria-hidden="true">
          <Glyph name={v.kind === 'keep' ? 'check' : 'arrow'} size={26} />
        </span>
        <h2>
          {v.lead}
          <br />
          <em>{v.highlight}</em> {v.tail}
        </h2>
        <p>{v.body}</p>
      </div>

      <section className="card">
        <h3 className="cardtitle">
          시점별 예상 손익
          <SourceTag source={d.netAnnual.source} />
        </h3>
        <HorizonChart horizon={d.horizon} />
        <p className="chartnote">
          {d.horizon.recommended.months === 0
            ? `지금 ${d.trigger.verb}해도 연 기준으로 손해가 아닙니다.`
            : `${formatMonths(d.horizon.recommended.months)} 유지하면 ${withJosa(name, '과/와')} 연결된 우대 조건이 한 바퀴를 돕니다.`}
        </p>
      </section>

      <RecommendCard />

      <AddonCard proposal={d.addons} />

      <section className="card checklist">
        <h3 className="cardtitle">
          꼭 확인하세요
          <Glyph name="info" size={16} />
        </h3>
        <ul>
          {d.checklist.map((c) => (
            <li key={c.key}>
              <span className="mk" aria-hidden="true">
                <Glyph name="check" size={14} />
              </span>
              <span className="tx">
                {c.text} <SourceTag source={c.source} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="footnote">
        이 판단은 보유 상품 정보와 약관에서 추출한 조건만으로 계산한 결과입니다. 실제 적용은 각 금융사
        약관을 따릅니다.
      </p>
    </AppShell>
  );
}
