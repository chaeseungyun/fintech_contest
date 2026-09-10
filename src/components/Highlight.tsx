import type { Span } from '../lib/types';

interface Props {
  text: string;
  spans?: Span[];
}

/** 약관 원문에 spans 로 하이라이트. 겹치는 span 은 앞의 것을 우선한다. */
export function Highlight({ text, spans = [] }: Props) {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const parts: JSX.Element[] = [];
  let cursor = 0;
  sorted.forEach((s, i) => {
    const start = Math.max(s.start, cursor);
    const end = Math.min(s.end, text.length);
    if (end <= start) return;
    if (start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    parts.push(
      <mark key={`m${i}`} data-field={s.field} title={s.field}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}
