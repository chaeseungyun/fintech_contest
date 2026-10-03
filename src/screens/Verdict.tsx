import { Amount } from '../components/Amount';
import { AppShell } from '../components/AppShell';
import { BasisStrip } from '../components/BasisStrip';
import { Glyph } from '../components/Glyph';
import { HorizonChart } from '../components/HorizonChart';
import type { Derived } from '../lib/derive';
import type { ImpactItem } from '../lib/derive';
import { formatKoMD, formatKoYMD, formatMonths, withJosa } from '../lib/format';
import { perkLabel } from '../lib/money';
import { tag } from '../lib/types';
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

/** "톡톡카드 적립·주담대 우대" — 실제로 잃는 연결의 상품과 혜택 이름. 상품이 여럿이면 상품 이름만 */
function whyLossLabel(d: Derived): string {
  const losing = d.items.filter((i) => i.effectiveLoss.value > 0);
  const names = [...new Set(losing.map((i) => i.product.shortName ?? i.product.name))];
  if (names.length !== 1) return `${names.join('·')} 혜택`;
  const perks = [...new Set(losing.map((i) => perkLabel(i.condition).split(' ')[0]))];
  return `${names[0]} ${perks.join('·')}`;
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

/**
 * 분석이 끝나고 처음 보는 화면. 결론 → 순손익 → 비교 기준 → "왜?" 두 줄 → 기간별 차트 → 시점 스트립.
 * 항목별 이유·유지 조건·갈아타기 후보·체크리스트는 "분석 과정 보기"(impact) 로 한 단계 들어간다.
 * "왜?" 두 줄(얻는 것·잃는 것 합계)은 작게만 쓴다 — 항목별 금액과 근거는 결과 상세의 몫이다.
 */
export function Verdict({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const v = d.verdict;
  const pending = v.kind === 'pending';
  const { verb } = d.trigger;
  const loss = d.total.value;
  const saving = d.savingsTotal.value;

  const toImpact = () => dispatch({ type: 'push', route: { name: 'impact', triggerId } });
  const toHub = () => dispatch({ type: 'popTo', name: 'hub' });
  // 우대 확인일 계산이 이 프로젝트의 차별점이라 결과 상세를 거치지 않고 한 단계 얕게 둔다
  const toTimeline = () => dispatch({ type: 'push', route: { name: 'timeline', triggerId } });

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
      <section className={`verdictcard ${v.kind}`}>
        {pending && <span className="statechip">전체 비교 보류 · 확인 필요 {d.missing.length}건</span>}
        <span className="meta">
          {d.center.name}
          {d.center.facts.last4 && ` (${d.center.facts.last4})`}
        </span>
        <h1>
          {v.lead}
          <br />
          <em>{v.highlight}</em>
          {v.tail && ` ${v.tail}`}
        </h1>
        {/* 유지·변경은 헤드라인과 두 줄이 이미 말한다. 보류일 때만 무엇이 빠졌는지 적는다 */}
        {pending && <p>{v.body}</p>}
        <div className="net">
          <span className="k">{pending ? '확인된 항목 소계' : `${verb} 시 연간 예상 손익`}</span>
          <Amount value={d.netAnnual} signed short size="hero" />
        </div>
        <BasisStrip basis={d.basis} />
        {/* 결론 밑 "왜?" 두 줄 — 처음 보는 사람이 순손익이 어디서 왔는지 바로 읽게 한다(팀 확정 2026-09-27).
            작게 쓴다: 항목별 내역과 근거는 결과 상세의 몫이다 */}
        {(saving !== 0 || loss > 0) && (
          <ul className="why" aria-label="순손익이 나온 이유">
            {saving !== 0 && (
              <li>
                <span className="k">
                  얻는 것 · {d.savings.map((s) => s.label).join('·')}
                </span>
                <Amount value={d.savingsTotal} signed short />
              </li>
            )}
            {loss > 0 && (
              <li>
                <span className="k">잃는 것 · {whyLossLabel(d)}</span>
                <Amount value={tag(-loss, d.total.source)} signed short />
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="card chartcard">
        <div className="head">
          <h2 className="cardtitle">
            유지 기간별 예상 손익 · 지금 {verb} 대비
          </h2>
          <span className="sub">
            {pending && '확인된 항목만 · '}막대를 누르면 값이 보여요
          </span>
        </div>
        {/* 절감이 없으면 손익분기가 없다 — 첫 양수 구간을 강조하지 않는다 */}
        <HorizonChart horizon={d.horizon} quiet={d.horizon.reason === 'positive' && d.savings.length === 0} />
        {d.horizon.reason !== 'now' && <p className="chartnote">{horizonNote(d)}</p>}
      </section>

      {d.split && d.split.dest === null && (
        <button type="button" className="card linkrow" onClick={toImpact}>
          <span className="ico warn">
            <Glyph name="card" size={19} />
          </span>
          <span className="body">
            <b>옮겨 갈 카드를 고르면 비교가 끝납니다</b>
            <span>남길 금액과 카드 고르기</span>
          </span>
          <Glyph name="chevron" size={16} />
        </button>
      )}

      {d.items.length > 0 && (
        <button type="button" className="card linkrow" onClick={toTimeline}>
          <span className="ico warn">
            <Glyph name="clock" size={19} />
          </span>
          <span className="body">
            <b>
              {d.timing.alreadySafe && d.waitExempt.length > 0
                ? '남은 우대 확인을 기다리지 않아도 돼요'
                : d.timing.alreadySafe
                  ? '이번 달 우대 확인은 모두 끝났습니다'
                : `${formatKoMD(d.timing.safeAfter.value)}이 지나면 이번 달 우대가 확정`}
            </b>
            <span>우대 확인일과 변경 가능 구간 보기</span>
          </span>
          <Glyph name="chevron" size={16} />
        </button>
      )}

      <p className="footnote">미래 금리 변동은 예측하지 않았어요. 실제 적용은 각 금융사 약관을 따릅니다.</p>
    </AppShell>
  );
}
