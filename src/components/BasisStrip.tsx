import { formatKoMD } from '../lib/format';
import type { ComparisonBasis } from '../lib/derive';

/**
 * 금액 옆에 항상 붙는 비교 기준 한 줄. "무엇 vs 무엇 · 기간 · 기준일 · 가정".
 * 값은 derive().basis 에서만 온다 — 화면이 문장을 지어내지 않는다.
 */
export function BasisStrip({ basis, compact }: { basis: ComparisonBasis; compact?: boolean }) {
  return (
    <dl className={`basisstrip${compact ? ' compact' : ''}`} aria-label="비교 기준">
      {!compact && (
        <div>
          <dt>비교</dt>
          <dd>
            <b>{basis.change}</b> vs {basis.versus}
          </dd>
        </div>
      )}
      <div>
        <dt>기간</dt>
        <dd>{basis.period}</dd>
      </div>
      <div>
        <dt>기준일</dt>
        <dd>{formatKoMD(basis.asOf)}</dd>
      </div>
      {!compact && (
        <div>
          <dt>가정</dt>
          <dd>{basis.assumption}</dd>
        </div>
      )}
    </dl>
  );
}
