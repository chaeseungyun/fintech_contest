import { Amount } from '../components/Amount';
import { AppShell } from '../components/AppShell';
import { BasisStrip } from '../components/BasisStrip';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import { RecommendCard } from '../components/RecommendCard';
import { SourceTag } from '../components/SourceTag';
import type { Derived } from '../lib/derive';
import { formatKoMD, formatKoYMD, formatMonths } from '../lib/format';
import { useStore } from '../state/store';

/**
 * 차트 아래 한 줄. 구간을 고른 이유(horizon.reason)에 맞춰 쓴다 — 구간 숫자만 보고 문장을 짓지 않는다.
 * 'positive' 는 "최적 변경 시점" 이 아니라 손익분기다. 변경 시점은 판정일·만기 같은 확인된 사건으로 정한다.
 */
function horizonNote(d: Derived): string {
  const { verb } = d.trigger;
  const held = formatMonths(d.horizon.recommended.months);
  switch (d.horizon.reason) {
    case 'now':
      return `지금 ${verb}해도 연 기준으로 손해가 아닙니다.`;
    case 'recover':
      return `${held} 유지하면 되돌릴 수 없는 우대의 만기(${formatKoMD(d.recoverBy!)})를 넘깁니다. 그 전에 바꾸면 그 우대는 만기까지 복구되지 않습니다.`;
    case 'recover-beyond':
      return `되돌릴 수 없는 우대의 만기가 ${formatKoYMD(d.recoverBy!)}라 적어도 ${held} 이상 유지해야 합니다.`;
    case 'positive': {
      const cost = d.savings.map((s) => s.label).join('·');
      return d.savings.length > 0
        ? `${held} 이상 유지하면 지켜지는 혜택이 ${cost}를 넘어섭니다(손익분기). 바꾸는 시점은 아래 판정일 기준으로 정하세요.`
        : `유지 기간이 길수록 지켜지는 혜택이 커집니다. 바꾸는 시점은 아래 판정일 기준으로 정하세요.`;
    }
  }
}

const MARK: Record<Derived['verdict']['kind'], 'check' | 'arrow' | 'info'> = {
  keep: 'check',
  switch: 'arrow',
  pending: 'info',
};

export function Verdict({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const v = d.verdict;
  const pending = v.kind === 'pending';

  const toPlan = () => dispatch({ type: 'push', route: { name: 'actionplan', triggerId } });
  const toHub = () => dispatch({ type: 'popTo', name: 'hub' });

  return (
    <AppShell
      title="비교 결과"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        v.kind === 'switch' ? (
          <>
            <button type="button" className="btn primary" onClick={toPlan}>
              {d.trigger.verb} 절차 안내받기
            </button>
            <button type="button" className="btn text" onClick={toHub}>
              다른 항목도 분석해보기
              <Glyph name="chevron" size={14} />
            </button>
          </>
        ) : (
          // 유지·보류: 강조 버튼은 다음 분석. 해지 절차는 "그래도" 를 붙여 한 단계 아래에 둔다.
          <>
            <button type="button" className="btn primary" onClick={toHub}>
              다른 항목도 분석해보기
            </button>
            <button type="button" className="btn text" onClick={toPlan}>
              그래도 {d.trigger.verb}한다면 · 절차 보기
              <Glyph name="chevron" size={14} />
            </button>
          </>
        )
      }
    >
      <div className={`verdictcard ${v.kind}`}>
        <span className="mark" aria-hidden="true">
          <Glyph name={MARK[v.kind]} size={26} />
        </span>
        <h2>
          {v.lead}
          <br />
          <em>{v.highlight}</em>
          {v.tail && ` ${v.tail}`}
        </h2>
        <p>{v.body}</p>
        {/* 결론 옆의 숫자 하나. 총액 카드를 다시 그리지 않는다 — 영향 분석에서 이미 봤다 */}
        <span className="net">
          <em className="k">{pending ? '확인된 항목 소계' : '연간 예상 손익'}</em>
          <Amount value={d.netAnnual} signed short size="lg" />
        </span>
      </div>

      <BasisStrip basis={d.basis} compact />

      <section className="card">
        <h3 className="cardtitle">
          유지 기간별 예상 손익
          <SourceTag source={d.netAnnual.source} />
        </h3>
        <p className="chartsub">
          지금 {d.trigger.verb} 대비{pending && ' · 확인된 항목만'}
        </p>
        {/* 절감이 없으면 손익분기가 없다 — 첫 양수 구간을 강조하지 않는다 */}
        <HorizonChart horizon={d.horizon} quiet={d.horizon.reason === 'positive' && d.savings.length === 0} />
        <p className="chartnote">{horizonNote(d)}</p>
      </section>

      {d.maintain.length > 0 && (
        <section className="card checklist maintain">
          <h3 className="cardtitle">
            유지를 택한다면 지킬 조건
            <Glyph name="check" size={16} />
          </h3>
          <ul>
            {d.maintain.map((c) => (
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
          <p className="note">유지에는 절차가 없습니다. 위 실적만 판정일까지 유지되면 우대가 이어집니다.</p>
        </section>
      )}

      <RecommendCard triggerId={triggerId} />

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
        이 결과는 보유 상품 정보와 약관에서 추출한 조건만으로 계산했습니다. 미래 금리 변동이나 상품
        존속은 예측하지 않으며, 실제 적용은 각 금융사 약관을 따릅니다.
      </p>
    </AppShell>
  );
}
