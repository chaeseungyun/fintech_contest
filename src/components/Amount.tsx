import { formatSignedWonShort, formatWon, formatWonShort } from '../lib/format';
import type { Tagged } from '../lib/types';
import { SourceTag } from './SourceTag';

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  value: Tagged<number>;
  /** 부호를 붙이고 색을 나눈다 (+ 파랑 / − 빨강) */
  signed?: boolean;
  /** 만원 단위로 줄인다 */
  short?: boolean;
  size?: Size;
  /** 출처 태그를 옆에 붙인다. 기본은 숨김 — 상세 화면에서만 켠다. */
  showTag?: boolean;
  prefix?: string;
  suffix?: string;
}

/**
 * 금액 표시. 값과 출처가 같은 객체(Tagged)로 들어오므로
 * 화면이 조건문으로 태그를 고르지 않는다.
 */
export function Amount({ value, signed, short, size = 'md', showTag, prefix, suffix }: Props) {
  const n = value.value;
  const text = signed
    ? formatSignedWonShort(n)
    : short
      ? formatWonShort(n)
      : formatWon(n);
  const tone = !signed ? '' : n > 0 ? ' up' : n < 0 ? ' down' : ' flat';

  return (
    <span className={`amt s-${size}${tone}`}>
      {prefix && <span className="pre">{prefix}</span>}
      <span className="num">{text}</span>
      {suffix && <span className="suf">{suffix}</span>}
      {showTag && <SourceTag source={value.source} />}
    </span>
  );
}
