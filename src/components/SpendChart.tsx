import type { SpendSummary } from '../lib/portfolio';

/** 홈의 소비 추이 미니 차트. 마지막 막대가 이번 달. */
export function SpendChart({ summary }: { summary: SpendSummary }) {
  const last = summary.points.length - 1;
  return (
    <div className="spark" role="img" aria-label="최근 소비 추이">
      {summary.points.map((p, i) => (
        <span
          key={p.month}
          className={i === last ? 'bar on' : 'bar'}
          style={{ height: `${Math.max(8, (p.amount / summary.max) * 100)}%` }}
          title={`${p.month} ${p.amount.toLocaleString('ko-KR')}원`}
        />
      ))}
    </div>
  );
}
