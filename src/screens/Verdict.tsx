import { AddonCard } from '../components/AddonCard';
import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import { RecommendCard } from '../components/RecommendCard';
import { SourceTag } from '../components/SourceTag';
import type { Derived } from '../lib/derive';
import { formatKoMD, formatKoYMD, formatMonths } from '../lib/format';
import { useStore } from '../state/store';

/** 차트 아래 한 줄. 추천 구간을 고른 이유(horizon.reason)에 맞춰 쓴다 — 구간 숫자만 보고 문장을 짓지 않는다. */
function horizonNote(d: Derived): string {
  const { verb } = d.trigger;
  const held = formatMonths(d.horizon.recommended.months);
  switch (d.horizon.reason) {
    case 'now':
      return `지금 ${verb}해도 연 기준으로 손해가 아닙니다.`;
    case 'recover':
      return `${held} 유지하면 되돌릴 수 없는 우대의 만기(${formatKoMD(d.recoverBy!)})를 넘깁니다.`;
    case 'recover-beyond':
      return `되돌릴 수 없는 우대의 만기가 ${formatKoYMD(d.recoverBy!)}라 적어도 ${held} 이상 유지해야 합니다.`;
    case 'positive':
      return `${held}만 유지해도 이익으로 돌아섭니다. 더 오래 둘수록 이익은 커집니다.`;
  }
}

export function Verdict({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const v = d.verdict;

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
        <p className="chartnote">{horizonNote(d)}</p>
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
