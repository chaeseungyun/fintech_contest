import { AddonCard } from '../components/AddonCard';
import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { addonProposals } from '../lib/addon';
import { formatKoMD, formatMD } from '../lib/format';
import { benefitLabel } from '../lib/money';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

/**
 * 혜택 탭 = 상시 분석 화면.
 * "지금 얼마 받고 있는가" 만이 아니라 "무엇이 언제 판정되는가" 까지 같이 본다.
 * 숫자와 날짜는 전부 watchSummary() 가 계산한 값이다.
 */
export function Benefits() {
  const { scenario, dispatch } = useStore();
  const watch = watchSummary(scenario);
  const addons = addonProposals(scenario);

  return (
    <AppShell title="혜택">
      <div className="card summarycard">
        <span className="lbl">
          지금 받고 있는 우대 혜택
        </span>
        <Amount value={watch.activeTotal} short size="xl" prefix="연" />
        <span className="sub">
          약관에서 추출한 조건 {watch.linkCount}건 · 상품 {watch.productCount}개
        </span>
      </div>

      <div className={`monitorbar${watch.nextDate ? '' : ' clear'}`}>
        <span className="ico" aria-hidden="true">
          <Glyph name="clock" size={18} />
        </span>
        <span className="tx">
          {watch.nextDate
            ? `가장 이른 판정일은 ${formatKoMD(watch.nextDate)}입니다. 이번 달에 ${watch.dueSoon.length}건이 남았습니다.`
            : '이번 달 판정은 모두 끝났습니다. 지금 바꿔도 이번 달 혜택은 지킵니다.'}
        </span>
      </div>

      <div className="plist card">
        {watch.rows.map((r) => {
          const date = r.judgment.nextJudgmentDate.value;
          return (
            <div key={r.condition.id} className={`prow${r.judgment.active ? '' : ' off'}`}>
              <span className={`ico tint-${TYPE_ICON[r.holder.type] ?? 'deposit'}`}>
                <Glyph name={TYPE_ICON[r.holder.type] ?? 'deposit'} size={20} />
              </span>
              <span className="body">
                <b>{r.holder.name}</b>
                <span>
                  {benefitLabel(r.condition, r.holder)} · {r.judgment.cycleLabel.value}
                </span>
                <span className="dep">
                  {r.target.shortName ?? r.target.name} 유지 조건 · {r.requirement}
                </span>
              </span>
              <span className="tail">
                <Amount value={r.annualBenefit} short />
                <em className={`due${r.dueThisMonth && r.judgment.active ? ' soon' : ''}`}>
                  {r.judgment.active
                    ? date
                      ? `${formatMD(date)} 판정`
                      : '만기까지 고정'
                    : '실적 미달'}
                </em>
              </span>
            </div>
          );
        })}
      </div>

      <AddonCard proposal={addons} title="지금 보유 상품에 더하면 이득인 상품" />

      <button
        type="button"
        className="btn primary"
        onClick={() => dispatch({ type: 'push', route: { name: 'hub' } })}
      >
        유지·변경 손익 분석하기
      </button>

      <p className="footnote">
        혜택 하나가 다른 상품의 유지 조건에 걸려 있습니다. 그 상품을 바꾸면 이 혜택도 함께 움직입니다.
        판정일이 지나야 그 달의 우대가 확정됩니다.
      </p>
    </AppShell>
  );
}
