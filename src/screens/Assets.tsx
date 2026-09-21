import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import { formatRate, formatWon } from '../lib/format';
import { amountOf, assetGroups, totalAssets, totalDebt } from '../lib/portfolio';
import type { Product } from '../lib/types';
import { useStore } from '../state/store';

/** 상품 카드의 보조 설명. facts 에서만 만든다. */
function subtitle(p: Product): string {
  const f = p.facts;
  const bits: string[] = [p.institution];
  if (f.appliedRate !== undefined) bits.push(`적용금리 ${formatRate(f.appliedRate)}`);
  if (f.remainingMonths !== undefined) bits.push(`잔여 ${f.remainingMonths}개월`);
  if (f.maturity !== undefined) bits.push(`만기 ${f.maturity}`);
  if (f.annualFee !== undefined) bits.push(`연회비 ${formatWon(f.annualFee)}`);
  if (f.monthlyPremium !== undefined) bits.push(`월 보험료 ${formatWon(f.monthlyPremium)}`);
  if (f.activeCount !== undefined) bits.push(`${f.activeCount}건 등록`);
  if (f.coverage) bits.push(f.coverage);
  return bits.join(' · ');
}

export function Assets() {
  const { scenario } = useStore();
  const groups = assetGroups(scenario);
  const assets = totalAssets(scenario);
  const debt = totalDebt(scenario);

  return (
    <AppShell title="자산">
      <div className="card summarycard">
        <span className="lbl">
          총 자산 <SourceTag source={assets.source} />
        </span>
        <Amount value={assets} short size="xl" />
        <span className="sub">
          대출 잔액 <Amount value={debt} short />
        </span>
      </div>

      {groups.map((g) => (
        <section key={g.key} className="card">
          <h3 className="cardtitle">
            {g.label}
            {g.amount.value > 0 && <Amount value={g.amount} short />}
          </h3>
          <div className="plist">
            {g.products.map((p) => (
              <div key={p.id} className="prow">
                <span className={`ico tint-${TYPE_ICON[p.type] ?? 'deposit'}`}>
                  <Glyph name={TYPE_ICON[p.type] ?? 'deposit'} size={20} />
                </span>
                <span className="body">
                  <b>{p.name}</b>
                  <span>{subtitle(p)}</span>
                </span>
                {amountOf(p) > 0 && (
                  <span className="tail">
                    <Amount value={{ value: amountOf(p), source: 'holding' }} short />
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="footnote">
        보유 상품 정보는 마이데이터 연동 샘플입니다.
      </p>
    </AppShell>
  );
}
