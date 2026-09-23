import { formatDotYMD } from '../lib/format';
import type { ComparisonBasis } from '../lib/derive';
import { editCount, useStore } from '../state/store';
import { EditBadge } from './EditBadge';

/**
 * 금액 옆에 항상 붙는 비교 기준 한 줄. "무엇 vs 무엇 · 기간 · 기준일 · 가정".
 * 값은 derive().basis 에서만 온다 — 화면이 문장을 지어내지 않는다.
 */
export function BasisStrip({ basis }: { basis: ComparisonBasis }) {
  const { state } = useStore();
  return (
    <p className="basisstrip" aria-label="비교 기준">
      <span>
        {basis.change} vs {basis.versus}
      </span>
      <span>{basis.period}</span>
      <span className="mono">기준일 {formatDotYMD(basis.asOf)}</span>
      <span>{basis.assumption}</span>
      <EditBadge count={editCount(state)} />
    </p>
  );
}
