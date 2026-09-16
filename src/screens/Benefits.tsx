import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import { cycleLabel } from '../lib/interpreter';
import { annualLossOf, benefitLabel } from '../lib/money';
import { productById } from '../lib/graph';
import { isMapped, tag } from '../lib/types';
import { sumAnnual } from '../lib/money';
import { useStore } from '../state/store';

/**
 * 혜택 탭. MAPPED 조건 전부를 "지금 받고 있는 우대"로 본다.
 * holder 가 혜택을 받는 상품, target 이 그 조건을 떠받치는 상품이다.
 */
export function Benefits() {
  const { scenario, dispatch } = useStore();
  const rows = scenario.conditions.filter(isMapped).map((c) => {
    const holder = productById(scenario, c.binds.holder);
    const target = productById(scenario, c.binds.target);
    return { c, holder, target, annual: annualLossOf(c, holder) };
  });
  rows.sort((a, b) => b.annual - a.annual);
  const total = sumAnnual(rows.map((r) => r.annual));

  return (
    <AppShell title="혜택">
      <div className="card summarycard">
        <span className="lbl">
          지금 받고 있는 우대 혜택 <SourceTag source={total.source} />
        </span>
        <Amount value={total} short size="xl" prefix="연" />
        <span className="sub">
          약관에서 추출한 조건 {rows.length}건 <SourceTag source="doc" />
        </span>
      </div>

      <div className="plist card">
        {rows.map(({ c, holder, target, annual }) => (
          <div key={c.id} className="prow">
            <span className={`ico tint-${TYPE_ICON[holder.type] ?? 'deposit'}`}>
              <Glyph name={TYPE_ICON[holder.type] ?? 'deposit'} size={20} />
            </span>
            <span className="body">
              <b>{holder.name}</b>
              <span>
                {benefitLabel(c, holder)} · {cycleLabel(c)}
              </span>
              <span className="dep">
                {target.shortName ?? target.name} 유지 조건
              </span>
            </span>
            <span className="tail">
              <Amount value={tag(annual, 'calc')} short />
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn primary"
        onClick={() => dispatch({ type: 'push', route: { name: 'switchpoint' } })}
      >
        변경하면 어떻게 되는지 분석하기
      </button>

      <p className="footnote">
        혜택 하나가 다른 상품의 유지 조건에 걸려 있습니다. 그 상품을 바꾸면 이 혜택도 함께 움직입니다.
      </p>
    </AppShell>
  );
}
