import { useEffect, type ReactNode } from 'react';
import { useStore } from '../state/store';

/**
 * 처음 보는 사람이 막히는 용어. 점선 밑줄 버튼이고, 누르면 scenario.glossary 의 쉬운 말 한두 문장이 시트로 뜬다.
 * 풀이가 없는 용어는 그냥 글자로 둔다 — 눌러도 아무 일 없는 버튼을 만들지 않는다.
 */
export function Term({ term, children }: { term: string; children?: ReactNode }) {
  const { scenario, dispatch } = useStore();
  const label = children ?? term;
  if (!scenario.glossary?.[term]) return <>{label}</>;
  return (
    <button
      type="button"
      className="term"
      aria-haspopup="dialog"
      onClick={() => dispatch({ type: 'openTerm', term })}
    >
      {label}
    </button>
  );
}

/** 용어 풀이 시트. App 이 폰 프레임 맨 위에 그린다 — 허브 시트 위에도 뜬다 */
export function TermSheet() {
  const { state, scenario, dispatch } = useStore();
  const term = state.term;
  const text = term ? scenario.glossary?.[term] : undefined;

  useEffect(() => {
    if (!term) return;
    const opener = document.activeElement as HTMLElement | null;
    const close = () => dispatch({ type: 'closeTerm' });
    // 캡처 단계에서 먹는다 — 아래 허브 시트의 Escape 까지 닫히지 않게
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus();
    };
  }, [term, dispatch]);

  if (!term || !text) return null;
  const close = () => dispatch({ type: 'closeTerm' });
  return (
    <div className="sheetlayer termlayer">
      <button type="button" className="scrim" aria-label="닫기" tabIndex={-1} onClick={close} />
      <section className="bottomsheet termsheet" role="dialog" aria-modal="true" aria-labelledby="term-title">
        <span className="grab" aria-hidden="true" />
        <h2 id="term-title">{term}</h2>
        <p>{text}</p>
        <button type="button" className="btn primary" autoFocus onClick={close}>
          확인
        </button>
      </section>
    </div>
  );
}
