import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { BasisStrip } from '../components/BasisStrip';
import { Clause } from '../components/Clause';
import { Glyph, TileIcon, TYPE_ICON } from '../components/Glyph';
import { RecommendCard } from '../components/RecommendCard';
import { SplitCard } from '../components/SplitCard';
import { SourceTag } from '../components/SourceTag';
import { formatKoMD, formatKoYMD, formatWon, formatWonShort, withJosa } from '../lib/format';
import type { ImpactItem } from '../lib/derive';
import { METRIC_STATUS_LABEL } from '../lib/interpreter';
import { formatRateDelta, perkLabel, type CapAdjustment } from '../lib/money';
import { useStore } from '../state/store';
import { tag } from '../lib/types';

/**
 * 펼친 내역 첫 줄 — 이 변경이 이 상품에 무슨 일을 일으키는지 한 문장.
 * "우대금리 0.2%p 소멸 · 잔액 1.5억" 을 처음 보는 사람 말로 다시 쓴다. 값은 전부 계산 결과에서 온다.
 */
function plainEffect(item: ImpactItem, center: string, verb: string): string {
  const name = item.product.shortName ?? item.product.name;
  const perk = perkLabel(item.condition);
  const head = `${withJosa(center, '을/를')} ${verb}하면 ${name}의 ${perk}`;
  const won = formatWon(item.effectiveLoss.value);
  if (item.shift) {
    const after = formatWonShort(item.shift.after);
    const bar = formatWonShort(item.condition.metric.threshold ?? 0);
    return item.shift.kept
      ? `${withJosa(center, '을/를')} ${verb}해도 카드 이용금액이 월 ${after}으로 기준 ${bar} 이상이라 ${name}의 ${perk}는 그대로 유지됩니다.`
      : `${withJosa(center, '을/를')} ${verb}하면 카드 이용금액이 월 ${after}으로 기준 ${bar} 아래가 되어 ${name}의 ${perk}가 빠지고 대출 이자가 연 ${won} 늘어납니다.`;
  }
  if (item.condition.binds.effect.kind === 'spend_rate') return `${head}이 끊겨 받는 포인트가 연 ${won} 줄어듭니다.`;
  if (item.condition.binds.effect.kind === 'monthly_benefit') return `${head}이 끊겨 연 ${won}을 더 내게 됩니다.`;
  return item.product.type === 'loan'
    ? `${head}가 빠져 대출 이자가 연 ${won} 늘어납니다.`
    : `${head}가 빠져 받는 이자가 연 ${won} 줄어듭니다.`;
}

const pp = (x: number) => formatRateDelta(x).replace(/^[−+]/, '');

/**
 * 우대 상한 조정 한 줄. 항목 행은 명목 금액이라, 상한 때문에 실제로 덜 바뀌는 몫을 여기서 되돌린다.
 * "상한 1%p · 명목 0.4%p 중 실제 0.1%p 만 오름" — 값은 전부 capAdjustment 결과에서 온다.
 */
function CapRow({ cap, name }: { cap: CapAdjustment; name: string }) {
  const softer = cap.amount.value > 0;
  return (
    <div className="irow saving">
      <div className="head static">
        <span className="ico tint-save">
          <Glyph name="save" size={20} />
        </span>
        <span className="body">
          <b>{name} 우대 상한 조정</b>
          <span>
            상한 {pp(cap.cap.value)} · 명목 {pp(Math.abs(cap.nominalDelta))} 중 실제 {pp(Math.abs(cap.actualDelta))}만{' '}
            {softer ? '오름' : '내림'} <SourceTag source={cap.cap.source} />
          </span>
        </span>
        <span className="tail">
          <Amount value={cap.amount} signed short />
        </span>
      </div>
    </div>
  );
}

function ImpactRow({ item, triggerId }: { item: ImpactItem; triggerId: string }) {
  const { state, derived: d, dispatch } = useStore();
  const open = state.expandedConditionId === item.condition.id;
  const j = item.judgment;

  return (
    <div className={`irow${open ? ' open' : ''}${j.active ? '' : ' off'}`}>
      <button
        type="button"
        className="head"
        aria-expanded={open}
        onClick={() => dispatch({ type: 'toggleExpanded', conditionId: item.condition.id })}
      >
        <TileIcon name={TYPE_ICON[item.product.type] ?? 'deposit'} size={21} />
        <span className="body">
          <b>{item.product.name}</b>
          <span>
            {!j.active
              ? j.inactiveReason
              : item.shift
                ? `카드 이용금액 월 ${formatWonShort(item.shift.before)} → ${formatWonShort(item.shift.after)} · 기준 ${formatWonShort(item.condition.metric.threshold ?? 0)} ${item.shift.kept ? '이상 유지' : '미달'}`
                : item.loss.basisLabel}
          </span>
        </span>
        <span className="tail">
          <Amount value={tag(-item.effectiveLoss.value, item.effectiveLoss.source)} signed short />
          <Glyph name="down" size={16} className="caret" />
        </span>
      </button>

      {open && (
        <div className="detail">
          {j.active && (
            <p className="plain">{plainEffect(item, d.center.shortName ?? d.center.name, d.trigger.verb)}</p>
          )}
          <div className="fields">
          <div className="f">
            <span className="k">확인 주기</span>
            <span className="v">
              {j.cycleLabel.value} <SourceTag source={j.cycleLabel.source} />
            </span>
          </div>
          <div className="f">
            <span className="k">{j.nextJudgmentDate.value === null ? '회복 시점' : '다음 우대 확인일'}</span>
            <span className="v">
              {j.nextJudgmentDate.value === null ? (
                <>
                  만기 {formatKoYMD(j.recoverAt!.value)} <SourceTag source={j.recoverAt!.source} />
                </>
              ) : (
                <>
                  {formatKoMD(j.nextJudgmentDate.value)} <SourceTag source={j.nextJudgmentDate.source} />
                </>
              )}
            </span>
          </div>
          {/* "충족" 이 무엇에 기대고 있는지. 실적 값이 없으면 가정이라고 적는다 */}
          <div className="f">
            <span className="k">실적 확인</span>
            <span className={`v${j.metricStatus === 'assumed' ? ' assumed' : ''}`}>
              {METRIC_STATUS_LABEL[j.metricStatus]}
              {j.metricStatus === 'verified' && <SourceTag source="holding" />}
              {j.metricStatus === 'user' && <SourceTag source="user" />}
            </span>
          </div>
          {item.loss.principal && (
            <div className="f">
              <span className="k">계산 원금</span>
              <span className="v">
                {formatWonShort(item.loss.principal.value)}{' '}
                <SourceTag source={item.loss.principal.source} />
              </span>
            </div>
          )}
          <div className="f">
            <span className="k">연간 손실</span>
            <span className="v">
              {formatWon(item.effectiveLoss.value)} <SourceTag source={item.effectiveLoss.source} />
            </span>
          </div>
          </div>
          <Clause condition={item.condition} />
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              dispatch({
                type: 'push',
                route: { name: 'evidence', triggerId, productId: item.product.id },
              })
            }
          >
            근거 원문 · 값 수정
            <Glyph name="chevron" size={14} />
          </button>
          {!j.active && <p className="note">지금도 못 받는 혜택이라 0원이에요.</p>}
          {d.capAdjustments.some((c) => c.productId === item.product.id) && (
            <p className="note">우대금리 상한이 있어 실제 변화는 아래 “우대 상한 조정”에 반영했어요.</p>
          )}
          {j.metricStatus === 'assumed' && (
            <p className="note warn">실적 정보가 없어 채운 것으로 계산했어요.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 비교 결과에서 "분석 과정 보기" 로 들어오는 화면. 항목별 영향(①②③) → 유지 조건 → 갈아타기 후보 → 체크리스트.
 * 절차의 기준 안(store.chosen)은 여기 후보 카드에서 고른다.
 */
export function Impact({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const center = d.center;
  const v = d.verdict;
  const pending = v.kind === 'pending';

  const toPlan = () => dispatch({ type: 'push', route: { name: 'actionplan', triggerId } });
  const toHub = () => dispatch({ type: 'popTo', name: 'hub' });

  return (
    <AppShell
      title="결과 상세"
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
      <div className="card targetcard">
        <TileIcon name={TYPE_ICON[center.type] ?? 'card'} size={24} />
        <span className="body">
          <b>
            {center.institution} {center.name}
          </b>
          <span>
            {center.facts.last4 && `(${center.facts.last4}) · `}
            {d.trigger.label}
          </span>
        </span>
      </div>

      <BasisStrip basis={d.basis} />

      {/* 나눠 쓰기: 남길 금액과 옮겨 갈 카드를 여기서 고른다 — 고른 값으로 아래 ①② 가 바뀐다 */}
      <SplitCard triggerId={triggerId} />

      {/* ① 상품 자체 변화 — 바꾸면 안 내게 되는 비용. 근거가 없으면 없다고 적는다 */}
      <h3 className="sectiontitle">
        <span className="no">1</span>상품 자체 변화
      </h3>
      <div className="impactlist">
        {d.savings.map((s) => (
          <div key={s.key} className="irow saving">
            <div className="head static">
              <span className="ico tint-save">
                <Glyph name="save" size={20} />
              </span>
              <span className="body">
                <b>{s.label}</b>
                <span>{s.note} · {s.basisLabel}</span>
              </span>
              <span className="tail">
                <Amount value={s.annualAmount} signed short />
              </span>
            </div>
          </div>
        ))}
        {d.savings.length === 0 && (
          <p className="empty small">
            {d.missing.length > 0
              ? `${withJosa(d.missing.join('·'), '을/를')} 알면 얻는 쪽을 계산할 수 있어요.`
              : '줄어드는 비용이 없어요.'}
          </p>
        )}
      </div>

      {/* ② 다른 상품 연결 영향 */}
      <h3 className="sectiontitle">
        <span className="no">2</span>연결된 상품에 미치는 영향
        <button
          type="button"
          className="link"
          onClick={() => dispatch({ type: 'push', route: { name: 'connections', triggerId } })}
        >
          관계도 보기
          <Glyph name="chevron" size={14} />
        </button>
      </h3>
      <div className="impactlist">
        {d.items.map((item) => (
          <ImpactRow key={item.condition.id} item={item} triggerId={triggerId} />
        ))}
        {d.capAdjustments.map((c) => {
          const p = d.items.find((i) => i.product.id === c.productId)?.product;
          return <CapRow key={`cap-${c.productId}`} cap={c} name={p?.shortName ?? p?.name ?? ''} />;
        })}
        {d.items.length === 0 && <p className="empty small">이 변경에 걸린 우대 조건이 없습니다.</p>}
      </div>

      {/* 비교 결과에서 본 숫자의 근거 — 절감·손실로 쪼개 보여주는 자리라 크게 다시 그리지 않는다 */}
      <div className={`totalcard${pending ? ' pending' : ''}`}>
        <div className="row">
          <span className="txt">
            <span className="lbl">{pending ? '확인된 항목의 변화 소계' : '연간 예상 손익 · 합계 근거'}</span>
            <span className="basis">
              절감 {formatWon(d.savingsTotal.value)} − 손실 {formatWon(d.total.value)}
            </span>
          </span>
          <Amount value={d.netAnnual} signed short size="lg" />
        </div>
        {pending && (
          <p className="note warn">{withJosa(d.missing.join('·'), '을/를')} 확인하기 전이라 결론은 보류예요.</p>
        )}
      </div>

      {/* ③ 변경 비용 — 일회성. 연 단위 합계와 같은 축에 올리지 않는다 */}
      {d.earlyTermination && (
        <>
          <h3 className="sectiontitle">
            <span className="no">3</span>변경 비용 · 일회성
          </h3>
          <div className="onetime">
            <span className="lbl">
              중도해지 이자 손실 <em>합계 미반영</em>
            </span>
            <Amount
              value={tag(-d.earlyTermination.loss.value, d.earlyTermination.loss.source)}
              signed
              short
              size="lg"
            />
            <span className="basis">
              {d.earlyTermination.basisLabel} <SourceTag source={d.earlyTermination.loss.source} />
            </span>
            <p className="note">해지할 때 한 번 나가는 돈이라 위 1년 합계에는 넣지 않았어요.</p>
          </div>
        </>
      )}

      <button
        type="button"
        className="btn ghost"
        onClick={() => dispatch({ type: 'push', route: { name: 'timeline', triggerId } })}
      >
        우대 확인일 · 변경 가능 구간 자세히 보기
        <Glyph name="chevron" size={14} />
      </button>

      {d.maintain.length > 0 && (
        <section className="card checklist maintain">
          <h3 className="cardtitle">유지를 택한다면 지킬 조건</h3>
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
        </section>
      )}

      <RecommendCard triggerId={triggerId} />

      <section className="card checklist">
        <h3 className="cardtitle">꼭 확인하세요</h3>
        <ul>
          {d.checklist.map((c) => (
            <li key={c.key}>
              <span className="mk" aria-hidden="true" />
              <span className="tx">
                {c.text} <SourceTag source={c.source} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="footnote">모든 금액은 1년 기준이에요.</p>
    </AppShell>
  );
}
