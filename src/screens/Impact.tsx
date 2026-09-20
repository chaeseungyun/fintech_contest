import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { BasisStrip } from '../components/BasisStrip';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import { formatKoMD, formatKoYMD, formatWon, formatWonShort } from '../lib/format';
import type { ImpactItem } from '../lib/derive';
import { METRIC_STATUS_LABEL } from '../lib/interpreter';
import { useStore } from '../state/store';
import { tag } from '../lib/types';

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
        <span className={`ico tint-${TYPE_ICON[item.product.type] ?? 'deposit'}`}>
          <Glyph name={TYPE_ICON[item.product.type] ?? 'deposit'} size={21} />
        </span>
        <span className="body">
          <b>{item.product.name}</b>
          <span>{j.active ? item.loss.basisLabel : j.inactiveReason}</span>
        </span>
        <span className="tail">
          <Amount value={tag(-item.effectiveLoss.value, item.effectiveLoss.source)} signed short />
          <Glyph name="down" size={16} className="caret" />
        </span>
      </button>

      {open && (
        <div className="detail">
          <div className="f">
            <span className="k">판정 주기</span>
            <span className="v">
              {j.cycleLabel.value} <SourceTag source={j.cycleLabel.source} />
            </span>
          </div>
          <div className="f">
            <span className="k">{j.nextJudgmentDate.value === null ? '회복 시점' : '다음 판정일'}</span>
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
          <p className="clause">“{item.condition.sourceText}”</p>
          <div className="links">
            <span className="src">{item.condition.sourceDoc}</span>
            <button
              type="button"
              className="link"
              onClick={() =>
                dispatch({
                  type: 'push',
                  route: { name: 'evidence', triggerId, productId: item.product.id },
                })
              }
            >
              근거 원문·값 수정
              <Glyph name="chevron" size={14} />
            </button>
          </div>
          {!j.active && <p className="note">지금도 받지 못하는 혜택이라 손실 0원으로 두었습니다.</p>}
          {j.metricStatus === 'assumed' && (
            <p className="note warn">
              실적 값이 없어 충족으로 가정했습니다. 근거 화면에서 기준을 바꾸거나 해당 없음으로 뺄 수 있습니다.
            </p>
          )}
          {j.recoverable && !j.countsForSafeAfter && j.active && (
            <p className="note">
              판정일이 다음 달({formatKoMD(j.nextJudgmentDate.value!)})이라 이번 달 안전 시점 계산에서
              뺐습니다.
            </p>
          )}
          {d.unsupported.some((u) => u.sourceDoc === item.condition.sourceDoc) && (
            <p className="note warn">
              이 약관에서 옮기지 못한 문장이 있습니다 · 근거 화면에서 확인하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Impact({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const center = d.center;
  const pending = d.verdict.kind === 'pending';

  return (
    <AppShell
      title="영향 분석"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        <button
          type="button"
          className="btn primary"
          onClick={() => dispatch({ type: 'push', route: { name: 'verdict', triggerId } })}
        >
          비교 결과 보기
        </button>
      }
    >
      <div className="card targetcard">
        <span className={`ico tint-${TYPE_ICON[center.type] ?? 'card'}`}>
          <Glyph name={TYPE_ICON[center.type] ?? 'card'} size={24} />
        </span>
        <span className="body">
          <b>
            {center.institution} {center.name}
          </b>
          <span>{center.facts.last4 ? `(${center.facts.last4})` : d.trigger.label}</span>
        </span>
      </div>

      <BasisStrip basis={d.basis} />

      {/* ① 상품 자체 변화 — 바꾸면 안 내게 되는 비용. 근거가 없으면 없다고 적는다 */}
      <h3 className="sectiontitle">
        <span className="no">1</span>상품 자체 변화
      </h3>
      <div className="impactlist">
        {d.savings.map((s) => (
          <div key={s.kind} className="irow saving">
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
              ? `${d.missing.join('·')}이 확인되지 않아 ${d.trigger.verb} 후 얻는 쪽은 계산에서 비워 두었습니다.`
              : `${d.trigger.verb}로 줄어드는 비용이 보유 상품 정보에 없습니다.`}
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
        {d.items.length === 0 && <p className="empty small">이 변경에 걸린 우대 조건이 없습니다.</p>}
      </div>

      <div className={`totalcard ${pending ? 'pending' : d.netAnnual.value >= 0 ? 'good' : 'bad'}`}>
        <span className="lbl">{pending ? '확인된 항목의 변화 소계' : '연간 예상 손익'}</span>
        <Amount value={d.netAnnual} signed short size="xl" />
        <span className="basis">
          (절감 {formatWonShort(d.savingsTotal.value)} − 손실 {formatWonShort(d.total.value)})
          <SourceTag source={d.netAnnual.source} />
        </span>
        {pending && (
          <p className="note warn">전체 비교 보류 — {d.missing.join('·')} 확인 필요. 이 소계만으로 유불리를 결론짓지 않습니다.</p>
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
            <p className="note">
              해지할 때 한 번 확정되는 금액이라 위 연 단위 합계에 더하지 않았습니다. 상품마다 만기가
              달라 같은 축에 올릴 수 없습니다.
            </p>
          </div>
        </>
      )}

      <button
        type="button"
        className="btn ghost"
        onClick={() => dispatch({ type: 'push', route: { name: 'timeline', triggerId } })}
      >
        판정일·안전 시점 자세히 보기
      </button>

      <p className="footnote">
        모든 금액은 연 단위입니다. 상품마다 만기가 달라 총액으로는 더할 수 없습니다.
        {d.items.some((i) => i.product.type === 'loan' && i.judgment.active) &&
          ' 대출은 첫해 기준이며 잔액이 줄면 차액도 줄어듭니다.'}
      </p>
    </AppShell>
  );
}
