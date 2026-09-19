import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph } from '../components/Glyph';
import { derive } from '../lib/derive';
import { watchSummary } from '../lib/watch';
import { useStore } from '../state/store';

/** 상품 탭. 변경을 검토할 수 있는 상품(=트리거)을 모아 보여준다. */
export function Products() {
  const { scenario, dispatch } = useStore();
  const watch = watchSummary(scenario);

  return (
    <AppShell title="상품">
      <p className="tabintro">
        {scenario.brand.service}가 보유 상품 {watch.productCount}개를 상시 분석하고 있습니다. 항목을
        고르면 유지·변경 손익을 바로 계산합니다.
      </p>

      <div className="triggerlist">
        {scenario.triggers.map((t) => {
          const d = derive(scenario, t.id);
          const product = d.center;
          return (
            <button
              key={t.id}
              type="button"
              className="triggerrow tall"
              onClick={() => dispatch({ type: 'push', route: { name: 'analyzing', triggerId: t.id } })}
            >
              <span className={`ico tint-${t.icon}`}>
                <Glyph name={t.icon} size={22} />
              </span>
              <span className="body">
                <b>
                  {product.institution} {product.name}
                </b>
                <span>{t.label} · 연결 조건 {d.graph.edges.length}건</span>
              </span>
              <span className="tail">
                <Amount value={d.netAnnual} signed short />
                <Glyph name="chevron" size={18} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="footnote">금액은 지금 실행했을 때의 연 기준 순손익입니다.</p>
    </AppShell>
  );
}
