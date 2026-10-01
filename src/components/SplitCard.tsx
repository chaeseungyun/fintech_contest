import { useId, useState } from 'react';
import { CUSTOM_CARD_ID, type CustomCard, type KeepChoice } from '../lib/derive';
import { formatDotYMD, formatRate, formatWon, formatWonShort } from '../lib/format';
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
        지금 월 {formatWonShort(split.before.value)} · 우대를 지키려면 월 {formatWonShort(split.needed.value)}
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
      <p className="note">월 {formatWonShort(split.moved.value)} 옮기기</p>

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
                  {dst.minSpend && ` · 실적 ${formatWonShort(dst.minSpend.value)} 이상`}
                  {dst.monthlyCap && ` · 월 한도 ${formatWonShort(dst.monthlyCap.value)}`}
                  {dst.loanRecognized && ' · 대출 실적 인정'}
                </span>
                {(dst.origin || dst.asOf) && (
                  <span className="origin">
                    {[dst.origin, dst.asOf && `${formatDotYMD(dst.asOf)} 기준`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <SourceTag source={dst.rewardRate.source} />
            </button>
          );
        })}
      </div>
      {split.dest === null && <p className="note warn">옮겨 갈 카드를 골라 주세요.</p>}

      {adding ? (
        <CustomCardForm
          initial={state.customCard}
          today={d.today}
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
        직접 입력한 카드는 ‘대출 카드 실적으로 인정’을 고른 경우에만 대출 우대 실적에 넣어 계산해요.
      </p>
    </section>
  );
}

const fromWon = (won: number | null | undefined, unit: number) => (won ? String(won / unit) : '');
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 직접 입력 카드. 비교에 필요한 값(제안서 8쪽) — 이름·적립률·연회비는 필수, 나머지는 비우면 "조건 없음 / 모름".
 * 적립률 0% 초과 10% 이하, 금액은 0원 이상 정수만 받는다 — 계산이 깨지는 값을 막는다.
 */
function CustomCardForm({
  initial,
  today,
  onSave,
  onCancel,
}: {
  initial: CustomCard | null;
  today: string;
  onSave: (card: CustomCard) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [asOf, setAsOf] = useState(initial?.asOf ?? today);
  const [rate, setRate] = useState(initial ? String(Math.round(initial.rewardRate * 1000) / 10) : '');
  const [minSpend, setMinSpend] = useState(fromWon(initial?.minSpend, 10_000));
  const [cap, setCap] = useState(fromWon(initial?.monthlyCap, 1));
  const [fee, setFee] = useState(initial ? String(initial.annualFee) : '0');
  const [loan, setLoan] = useState<NonNullable<CustomCard['loanRecognized']>>(initial?.loanRecognized ?? 'unknown');
  const r = Number(rate);
  const f = Number(fee);
  const m = minSpend.trim() === '' ? 0 : Number(minSpend);
  const c = cap.trim() === '' ? null : Number(cap);
  const valid =
    name.trim() !== '' &&
    r > 0 &&
    r <= 10 &&
    Number.isInteger(f) &&
    f >= 0 &&
    m >= 0 &&
    Number.isFinite(m) &&
    (c === null || (Number.isInteger(c) && c > 0)) &&
    ISO.test(asOf);

  return (
    <form
      className="customform"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({
          name: name.trim(),
          rewardRate: r / 100,
          annualFee: f,
          origin: origin.trim() || undefined,
          asOf,
          minSpend: Math.round(m * 10_000),
          monthlyCap: c,
          loanRecognized: loan,
        });
      }}
    >
      <label htmlFor={`${id}-n`}>카드 이름</label>
      <input id={`${id}-n`} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      <label htmlFor={`${id}-o`}>출처 (선택)</label>
      <input
        id={`${id}-o`}
        value={origin}
        maxLength={30}
        placeholder="예: 카드사 상품설명서"
        onChange={(e) => setOrigin(e.target.value)}
      />
      <label htmlFor={`${id}-d`}>기준일</label>
      <input id={`${id}-d`} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
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
      <label htmlFor={`${id}-m`}>전월 실적 기준 (만원 · 없으면 비움)</label>
      <input id={`${id}-m`} type="number" min={0} step={10} value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
      <label htmlFor={`${id}-c`}>월 적립·할인 한도 (원 · 없으면 비움)</label>
      <input id={`${id}-c`} type="number" min={0} step={1000} value={cap} onChange={(e) => setCap(e.target.value)} />
      <label htmlFor={`${id}-f`}>연회비 (원 · 이미 가진 카드면 0)</label>
      <input id={`${id}-f`} type="number" min={0} step={1000} value={fee} onChange={(e) => setFee(e.target.value)} />
      <span className="lbl">대출 카드 실적으로 인정</span>
      <div className="chips" role="radiogroup" aria-label="대출 카드 실적으로 인정">
        {(
          [
            ['unknown', '모름'],
            ['yes', '인정'],
            ['no', '인정 안 됨'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={loan === k}
            className={`chip${loan === k ? ' on' : ''}`}
            onClick={() => setLoan(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {!valid && (
        <p className="note">이름, 0.1~10% 사이의 적립률, 0원 이상의 연회비를 넣어 주세요. 한도는 비우거나 0보다 크게요.</p>
      )}
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
