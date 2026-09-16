import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import { formatKoMD, formatKoYMD, formatWon, formatWonShort } from '../lib/format';
import type { ImpactItem } from '../lib/derive';
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

  return (
    <AppShell
      title="분석 결과"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        <button
          type="button"
          className="btn primary"
          onClick={() => dispatch({ type: 'push', route: { name: 'verdict', triggerId } })}
        >
          최종 판단 보기
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
        {d.savings.length > 0 && (
          <span className="tail">
            <em>{d.savings[0].label}</em>
            <Amount value={d.savings[0].annualAmount} short />
          </span>
        )}
      </div>

      <h3 className="sectiontitle">
        연결된 금융상품에 미치는 영향
        <button
          type="button"
          className="iconbtn"
          aria-label="연결 관계도 보기"
          onClick={() => dispatch({ type: 'push', route: { name: 'connections', triggerId } })}
        >
          <Glyph name="info" size={17} />
        </button>
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

        {d.items.map((item) => (
          <ImpactRow key={item.condition.id} item={item} triggerId={triggerId} />
        ))}

        {d.items.length === 0 && d.savings.length === 0 && (
          <p className="empty">이 변경에 걸린 우대 조건이 없습니다.</p>
        )}
      </div>

      <div className={`totalcard ${d.netAnnual.value >= 0 ? 'good' : 'bad'}`}>
        <span className="lbl">연간 예상 손익</span>
        <Amount value={d.netAnnual} signed short size="xl" />
        <span className="basis">
          (절감 {formatWonShort(d.savingsTotal.value)} − 손실 {formatWonShort(d.total.value)})
          <SourceTag source={d.netAnnual.source} />
        </span>
      </div>

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
