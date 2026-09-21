import { Amount } from '../components/Amount';
import { AppShell } from '../components/AppShell';
import { BasisStrip } from '../components/BasisStrip';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import { SourceTag } from '../components/SourceTag';
import type { Derived } from '../lib/derive';
import type { ImpactItem } from '../lib/derive';
import { formatKoYMD, formatMonths, withJosa } from '../lib/format';
import { perkLabel } from '../lib/money';
import { useStore } from '../state/store';

/**
 * 차트 아래 한 줄. 구간을 고른 이유(horizon.reason)에 맞춰 쓴다 — 구간 숫자만 보고 문장을 짓지 않는다.
 * 'positive' 는 "최적 변경 시점" 이 아니라 손익분기다. 변경 시점은 판정일·만기 같은 확인된 사건으로 정한다.
 */
/** "정기예금의 우대금리 0.25%p" — 어떤 상품의 어떤 혜택인지 이름을 붙인다 */
const perkOf = (i: ImpactItem) => `${i.product.shortName ?? i.product.name}의 ${perkLabel(i.condition)}`;

/**
 * 되돌릴 수 없는 우대 설명. 상품·혜택·만기·결과를 전부 적는다 — "우대의 만기" 같은 내부 표현을 쓰지 않는다.
 * 만기가 여럿이면 가장 늦은 날(recoverBy) 기준.
 */
function unrecoverableNote(d: Derived): string {
  const { verb } = d.trigger;
  const center = d.center.shortName ?? d.center.name;
  const perks = d.unrecoverable.map(perkOf).join('·');
  const until = formatKoYMD(d.recoverBy!);
  return `${perks}는 ${withJosa(center, '을/를')} 보유한 조건으로 가입 때 확정된 것이라, 지금 ${verb}하면 만기(${until})까지 이 우대 없이 이어지고 ${withJosa(center, '을/를')} 다시 만들어도 되돌아오지 않습니다.`;
}

function horizonNote(d: Derived): string {
  const { verb } = d.trigger;
  const held = formatMonths(d.horizon.recommended.months);
  switch (d.horizon.reason) {
    case 'now':
      return `지금 ${verb}해도 연 기준으로 손해가 아닙니다.`;
    case 'recover':
      return `${unrecoverableNote(d)} 이 우대를 지키려면 만기 뒤에 ${verb}하세요 — 차트에서는 ${held} 구간부터입니다.`;
    case 'recover-beyond':
      return `${unrecoverableNote(d)} 만기가 차트 구간(${held}) 안에 오지 않으니, 지키려면 그 뒤에 ${verb}하세요.`;
    case 'positive': {
      const cost = d.savings.map((s) => s.label).join('·');
      return d.savings.length > 0
        ? `${held} 이상 유지하면 지켜지는 혜택이 ${cost}를 넘어섭니다(손익분기). 바꾸는 시점은 우대 확인일 기준으로 정하세요.`
        : `유지 기간이 길수록 지켜지는 혜택이 커집니다. 바꾸는 시점은 우대 확인일 기준으로 정하세요.`;
    }
  }
}

const MARK: Record<Derived['verdict']['kind'], 'check' | 'arrow' | 'info'> = {
  keep: 'check',
  switch: 'arrow',
  pending: 'info',
};

/**
 * 분석이 끝나고 처음 보는 화면. 결론 한 줄·숫자 하나·기간별 차트까지만 — 스크롤 없이 결론이 끝나야 한다.
 * 항목별 이유·유지 조건·갈아타기 후보·체크리스트는 "분석 과정 보기"(impact) 로 한 단계 들어간다.
 */
export function Verdict({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const v = d.verdict;
  const pending = v.kind === 'pending';

  const toImpact = () => dispatch({ type: 'push', route: { name: 'impact', triggerId } });
  const toHub = () => dispatch({ type: 'popTo', name: 'hub' });

  return (
    <AppShell
      title="비교 결과"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        <>
          <button type="button" className="btn primary" onClick={toImpact}>
            분석 과정 보기
          </button>
          <button type="button" className="btn text" onClick={toHub}>
            다른 항목도 분석해보기
            <Glyph name="chevron" size={14} />
          </button>
        </>
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
        {/* 결론 옆의 숫자 하나. 절감·손실로 쪼갠 근거는 결과 상세(impact)에서 그린다 */}
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

      <p className="footnote">
        이 결과는 보유 상품 정보와 약관에서 추출한 조건만으로 계산했습니다. 미래 금리 변동이나 상품
        존속은 예측하지 않으며, 실제 적용은 각 금융사 약관을 따릅니다.
      </p>
    </AppShell>
  );
}
