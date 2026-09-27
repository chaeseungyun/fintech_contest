import { useId, useState } from 'react';
import { CUSTOM_CARD_ID, type KeepChoice } from '../lib/derive';
import { formatRate, formatWon, formatWonShort } from '../lib/format';
import { useStore } from '../state/store';
import { SourceTag } from './SourceTag';

/**
 * 나눠 쓰기 선택기. 이 카드에 얼마를 남길지, 나머지를 어느 카드로 옮길지를 고른다.
 * 금액은 전부 derive().split 에서 읽는다 — "필요한 만큼" 도 계산 결과다(걸린 카드 실적 기준 중 가장 큰 값).
 * 옮겨 갈 카드는 앱이 고르지 않는다. 고르기 전에는 비교 결과가 보류다.
 */
export function SplitCard({ triggerId }: { triggerId: string }) {
  const { derived: d, state, dispatch } = useStore();
  const split = d.split;
  const [typing, setTyping] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!split) return null;

  const cardName = d.center.shortName ?? d.center.name;
  const setKeep = (keep: KeepChoice) => dispatch({ type: 'setSplit', triggerId, patch: { keep } });
  const pick = (toCardId: string) => dispatch({ type: 'setSplit', triggerId, patch: { toCardId } });
  const custom = typeof split.keep === 'number';

  const commitTyped = () => {
    const won = Math.round(Number(typing) * 10_000);
    if (Number.isFinite(won) && won >= 0) setKeep(won);
    setTyping(null);
  };

  return (
    <section className="card splitcard">
      <h3 className="cardtitle">나눠 쓰는 방법</h3>
      <p className="note">
        지금 {cardName} 월 {formatWonShort(split.before.value)} <SourceTag source={split.before.source} /> · 연결된 실적 조건을
        지키려면 월 {formatWonShort(split.needed.value)}이 필요합니다.
      </p>

      <span className="lbl">{cardName}에 남길 금액</span>
      <div className="chips" role="radiogroup" aria-label={`${cardName}에 남길 금액`}>
        <button
          type="button"
          role="radio"
          aria-checked={split.keep === 'needed'}
          className={`chip${split.keep === 'needed' ? ' on' : ''}`}
          onClick={() => setKeep('needed')}
        >
          필요한 만큼만 · {formatWonShort(split.needed.value)}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={split.keep === 'all'}
          className={`chip${split.keep === 'all' ? ' on' : ''}`}
          onClick={() => setKeep('all')}
        >
          전부 옮기기
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          className={`chip${custom ? ' on' : ''}`}
          onClick={() => setTyping(String(Math.round(split.kept.value / 10_000)))}
        >
          {custom ? `직접 · ${formatWonShort(split.kept.value)}` : '직접 입력'}
        </button>
      </div>
      {typing !== null && (
        <span className="editbox">
          <input
            type="number"
            aria-label="남길 금액 (만원)"
            autoFocus
            min={0}
            step={5}
            value={typing}
            onChange={(e) => setTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTyped();
              if (e.key === 'Escape') setTyping(null);
            }}
          />
          <span className="unit">만원</span>
          <button type="button" className="ok" onClick={commitTyped}>
            확인
          </button>
        </span>
      )}
      <p className="note">
        월 {formatWonShort(split.moved.value)}을 옮기고 {formatWonShort(split.kept.value)}을 남깁니다.
      </p>

      <span className="lbl">옮겨 갈 카드</span>
      <div className="destlist" role="radiogroup" aria-label="옮겨 갈 카드">
        {split.destinations.map((dst) => {
          const on = split.dest?.id === dst.id;
          return (
            <button
              key={dst.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`destrow${on ? ' on' : ''}`}
              onClick={() => pick(dst.id)}
            >
              <span className="body">
                <b>{dst.name}</b>
                <span>
                  {dst.institution} · 적립 {formatRate(dst.rewardRate.value)} · 연회비{' '}
                  {dst.annualFee.value > 0 ? formatWon(dst.annualFee.value) : '없음'}
                </span>
              </span>
              <SourceTag source={dst.rewardRate.source} />
            </button>
          );
        })}
      </div>
      {split.dest === null && <p className="note warn">옮겨 갈 카드를 고르면 비교가 끝납니다.</p>}

      {adding ? (
        <CustomCardForm
          initial={state.customCard}
          onSave={(card) => {
            dispatch({ type: 'setCustomCard', card });
            pick(CUSTOM_CARD_ID);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setAdding(true)}>
            {state.customCard ? '직접 입력한 카드 고치기' : '다른 카드 직접 입력 (타행 등)'}
          </button>
          {state.customCard && (
            <button type="button" className="btn text" onClick={() => dispatch({ type: 'setCustomCard', card: null })}>
              지우기
            </button>
          )}
        </div>
      )}
      <p className="note">
        직접 입력한 카드는 {d.center.institution} 상품의 우대 실적으로 인정되지 않는 것으로 계산합니다. 옮긴 금액은{' '}
        {cardName}의 실적에서 빠집니다.
      </p>
    </section>
  );
}

/** 카드 3개 값. 적립률 0% 초과 10% 이하, 연회비 0원 이상만 받는다 — 계산이 깨지는 값을 막는다 */
function CustomCardForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { name: string; rewardRate: number; annualFee: number } | null;
  onSave: (card: { name: string; rewardRate: number; annualFee: number }) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [rate, setRate] = useState(initial ? String(Math.round(initial.rewardRate * 1000) / 10) : '');
  const [fee, setFee] = useState(initial ? String(initial.annualFee) : '0');
  const r = Number(rate);
  const f = Number(fee);
  const valid = name.trim() !== '' && r > 0 && r <= 10 && Number.isInteger(f) && f >= 0;

  return (
    <form
      className="customform"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ name: name.trim(), rewardRate: r / 100, annualFee: f });
      }}
    >
      <label htmlFor={`${id}-n`}>카드 이름</label>
      <input id={`${id}-n`} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      <label htmlFor={`${id}-r`}>기본 적립·할인율 (%)</label>
      <input
        id={`${id}-r`}
        type="number"
        min={0.1}
        max={10}
        step={0.1}
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      <label htmlFor={`${id}-f`}>연회비 (원 · 이미 가진 카드면 0)</label>
      <input id={`${id}-f`} type="number" min={0} step={1000} value={fee} onChange={(e) => setFee(e.target.value)} />
      {!valid && <p className="note">이름, 0.1~10% 사이의 적립률, 0원 이상의 연회비를 넣어 주세요.</p>}
      <div className="row">
        <button type="submit" className="btn primary" disabled={!valid}>
          이 카드로 비교
        </button>
        <button type="button" className="btn text" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
