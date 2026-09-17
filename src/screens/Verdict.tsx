import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import { RecommendCard } from '../components/RecommendCard';
import { SourceTag } from '../components/SourceTag';
import { formatKoMD, formatMonths, withJosa } from '../lib/format';
import { useStore } from '../state/store';

export function Verdict({ triggerId }: { triggerId: string }) {
  const { state, derived: d, dispatch } = useStore();
  const v = d.verdict;
  const name = d.center.shortName ?? d.center.name;

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
        state.decidedNow ? (
          <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'decideNow', value: false })}>
            취소하고 다시 보기
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() => dispatch({ type: 'decideNow', value: true })}
            >
              {v.kind === 'keep' ? '지금 그대로 유지하기' : `지금 ${d.trigger.verb}하기`}
            </button>
            <button
              type="button"
              className="btn text"
              onClick={() => dispatch({ type: 'popTo', name: 'switchpoint' })}
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

      {state.decidedNow && (
        <div className={`decided ${v.kind}`}>
          <b>
            {v.kind === 'keep'
              ? `${withJosa(name, '을/를')} 그대로 유지합니다.`
              : `${withJosa(name, '을/를')} ${d.trigger.verb}합니다.`}
          </b>
          <p>
            {v.kind === 'keep' ? (
              d.timing.alreadySafe ? (
                <>이번 달 판정은 이미 모두 끝났습니다. 마음이 바뀌면 지금 실행해도 이번 달 혜택은 지킵니다.</>
              ) : (
                <>
                  다음 판정일은 {formatKoMD(d.timing.safeAfter.value)}입니다. 그때까지는 지금 혜택이
                  유지됩니다. <SourceTag source={d.timing.safeAfter.source} />
                </>
              )
            ) : (
              <>
                연 기준 <Amount value={d.netAnnual} signed short />의 손익이 확정됩니다.
                {d.trigger.caveat ? ` ${d.trigger.caveat}` : ''}
              </>
            )}
          </p>
        </div>
      )}

      <p className="footnote">
        이 판단은 보유 상품 정보와 약관에서 추출한 조건만으로 계산한 결과입니다. 실제 적용은 각 금융사
        약관을 따릅니다.
      </p>
    </AppShell>
  );
}
