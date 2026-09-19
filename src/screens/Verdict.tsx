import { AddonCard } from '../components/AddonCard';
import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import { RecommendCard } from '../components/RecommendCard';
import { SourceTag } from '../components/SourceTag';
import { formatMonths, formatWonShort, withJosa } from '../lib/format';
import { useStore } from '../state/store';

export function Verdict({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const v = d.verdict;
  const name = d.center.shortName ?? d.center.name;
  const early = d.earlyTermination;

  return (
    <AppShell
      title="분석 결과"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      actions={
        <button
          type="button"
          aria-label="판정일 자세히 보기"
          onClick={() => dispatch({ type: 'push', route: { name: 'timeline', triggerId } })}
        >
          <Glyph name="dots" size={21} />
        </button>
      }
      footer={
        <>
          <button
            type="button"
            className="btn primary"
            onClick={() => dispatch({ type: 'push', route: { name: 'actionplan', triggerId } })}
          >
            {v.kind === 'keep' ? '유지 절차 안내받기' : `${d.trigger.verb} 절차 안내받기`}
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

      {early && (
        <section className="card earlycard">
          <h3 className="cardtitle">
            중도해지 이자 손실
            <Amount value={early.loss} short />
          </h3>
          <div className="fields">
            <div className="f">
              <span className="k">만기까지 두면</span>
              <span className="v">
                <Amount value={early.fullInterest} short showTag />
              </span>
            </div>
            <div className="f">
              <span className="k">오늘 해지하면</span>
              <span className="v">
                <Amount value={early.earlyInterest} short showTag />
              </span>
            </div>
          </div>
          <p className="note">
            {early.basisLabel}. 해지할 때 한 번 확정되는 금액이라 위 연 단위 손익과 더하지 않고 따로
            봅니다. <SourceTag source={early.loss.source} />
          </p>
        </section>
      )}

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

      <div className="nextup">
        <b>다음 단계는 실행 안내입니다</b>
        <p>
          이 앱은 {d.trigger.verb}를 대신 처리하지 않습니다. 어느 금융사에 어떤 순서로 언제 신청하면
          손해가 가장 적은지, 창구에서 무엇을 확인해야 하는지를 정리해 드립니다.
          {d.actionPlan.steps.length > 0 && ` 단계 ${d.actionPlan.steps.length}개로 안내합니다.`}
        </p>
      </div>

      <p className="footnote">
        이 판단은 보유 상품 정보와 약관에서 추출한 조건만으로 계산한 결과입니다. 연 기준 순손익은{' '}
        {formatWonShort(d.netAnnual.value)}이며, 실제 적용은 각 금융사 약관을 따릅니다.
      </p>
    </AppShell>
  );
}
