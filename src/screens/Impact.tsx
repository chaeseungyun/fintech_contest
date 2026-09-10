import { PhoneFrame } from '../components/PhoneFrame';
import { SourceTag } from '../components/SourceTag';
import type { Derived, ImpactItem } from '../lib/derive';
import { formatKoMD, formatKoYMD, formatWon } from '../lib/format';
import { useStore } from '../state/store';

const shortName = (i: ImpactItem) => i.product.shortName ?? i.product.name;

function Verdict({ d }: { d: Derived }) {
  const { recoverable, unrecoverable, timing } = d;
  const names = recoverable.map(shortName).join('·');

  if (recoverable.length === 0 && unrecoverable.length === 0) {
    return (
      <div className="verdict">
        <div className="hd">지금 사라지는 혜택이 없습니다</div>
        <p>현재 조건을 충족하고 있는 혜택이 없어 변경해도 손실이 없습니다.</p>
      </div>
    );
  }

  const unrec = unrecoverable.map((u) => (
    <b key={u.condition.id}>
      {' '}
      {u.product.name} 우대는 만기({formatKoYMD(u.judgment.recoverAt!.value)})까지 회복되지 않습니다.
    </b>
  ));

  if (recoverable.length === 0) {
    return (
      <div className="verdict">
        <div className="hd">시점을 맞춰도 지킬 수 없는 혜택입니다</div>
        <p>{unrec}</p>
      </div>
    );
  }

  return (
    <div className="verdict">
      <div className="hd">
        {recoverable.length}건은 시점을 맞추면 지킬 수 있습니다
      </div>
      {timing.alreadySafe ? (
        <p>
          이번 달 판정은 이미 모두 끝났습니다. 지금 옮겨도 {names} 혜택은 다음 판정일까지 유지됩니다.
          {unrecoverable.length > 0 && <> 다만{unrec}</>}
        </p>
      ) : (
        <p>
          <b>{formatKoMD(timing.safeAfter.value)}</b> 이후에 옮기면 이번 달 판정은 이미 끝나 {names} 혜택이
          유지됩니다.
          {unrecoverable.length > 0 && <> 다만{unrec}</>}
          <SourceTag source={timing.safeAfter.source} />
        </p>
      )}
    </div>
  );
}

export function Impact() {
  const { derived: d, dispatch } = useStore();
  const hasLoan = d.items.some((i) => i.product.type === 'loan' && i.judgment.active);

  return (
    <PhoneFrame title={`${d.center.name} 변경`} onBack={() => dispatch({ type: 'navigate', screen: 1 })}>
      <div className="alert">
        <div className="hd">
          {d.affectedCount > 0
            ? `${d.affectedCount}개 상품의 혜택이 함께 사라집니다`
            : '함께 사라지는 혜택이 없습니다'}
        </div>
        <div className="big">연 {formatWon(d.total.value)}</div>
        <div className="per">
          변경 시 예상 손실 <SourceTag source={d.total.source} />
        </div>
      </div>

      <div className="box tight">
        {d.items.map((item) => (
          <div key={item.condition.id} className={`imp${item.judgment.active ? '' : ' off'}`}>
            <div className="l">
              <b>{item.product.name}</b>
              <span>
                {item.product.institution} · {item.loss.basisLabel}
              </span>
              {item.judgment.inactiveReason && <span className="why">{item.judgment.inactiveReason}</span>}
            </div>
            <div className="r">
              {formatWon(item.effectiveLoss.value)}
              <div className="rt">
                <SourceTag source={item.effectiveLoss.source} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Verdict d={d} />

      <p className="foot">
        연간 기준 금액입니다.
        {hasLoan && ' 주택담보대출은 첫해 기준이며 잔액이 줄면 차액도 줄어듭니다.'}
      </p>

      <button
        type="button"
        className="btn primary"
        onClick={() => dispatch({ type: 'navigate', screen: 3 })}
      >
        {d.timing.alreadySafe
          ? '지금 변경해도 됩니다 · 시점 보기'
          : `${formatKoMD(d.timing.safeAfter.value)} 이후로 미루기`}
      </button>
      <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'navigate', screen: 3 })}>
        그래도 변경하기
      </button>
      <button type="button" className="btn text" onClick={() => dispatch({ type: 'navigate', screen: 3 })}>
        언제 무엇이 깨지나요
      </button>
    </PhoneFrame>
  );
}
