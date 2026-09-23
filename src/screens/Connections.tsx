import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { Clause } from '../components/Clause';
import { SourceTag } from '../components/SourceTag';
import { formatRateDelta } from '../lib/money';
import type { Effect } from '../lib/types';
import { useStore } from '../state/store';

const W = 320;
const H = 280;
const CX = W / 2;
const CY = H / 2;
const RX = 116;
const RY = 100;
const R_CENTER = 36;
const R_SAT = 30;
const LABEL_T = 0.64;

function effectLabel(e: Effect): string {
  if (e.kind === 'rate_delta') return formatRateDelta(e.value);
  return e.value >= 10000 ? `월 ${e.value / 10000}만원` : `월 ${e.value / 1000}천원`;
}

/** n 개의 위성을 타원 위에 고르게 놓는다. 첫 노드는 왼쪽 위(-135°). */
function satellitePos(i: number, n: number) {
  const angle = ((-135 + (i * 360) / n) * Math.PI) / 180;
  return { x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle) };
}

export function Connections({ triggerId }: { triggerId: string }) {
  const { state, derived: d, dispatch } = useStore();
  const { graph } = d;
  const selected = state.selectedConditionId;
  const selectedItem = d.items.find((i) => i.condition.id === selected) ?? null;

  return (
    <AppShell title="연결 관계도" onBack={() => dispatch({ type: 'back' })} hideTabBar>
      <div className="card graphcard">
        <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="금융 연결 관계도">
          {/* 선: 조건 배열을 순회해 그린다 */}
          {graph.satellites.map((s, i) => {
            const p = satellitePos(i, graph.satellites.length);
            const on = s.edge.conditionId === selected;
            return (
              <g
                key={s.edge.conditionId}
                className={`edge${on ? ' on' : ''}`}
                onClick={() =>
                  dispatch({ type: 'selectCondition', conditionId: on ? null : s.edge.conditionId })
                }
              >
                <line x1={CX} y1={CY} x2={p.x} y2={p.y} className="hit" />
                <line x1={CX} y1={CY} x2={p.x} y2={p.y} className="vis" />
              </g>
            );
          })}

          {/* 중앙: 변경 대상 상품 */}
          <circle cx={CX} cy={CY} r={R_CENTER} className="centernode" />
          <text x={CX} y={CY - 3} textAnchor="middle" className="ctitle">
            {graph.center.shortName ?? graph.center.name}
          </text>
          <text x={CX} y={CY + 11} textAnchor="middle" className="csub">
            {graph.center.institution}
          </text>

          {/* 위성: 영향받는 상품 */}
          {graph.satellites.map((s, i) => {
            const p = satellitePos(i, graph.satellites.length);
            const on = s.edge.conditionId === selected;
            return (
              <g
                key={s.product.id}
                className={`sat${on ? ' on' : ''}`}
                onClick={() =>
                  dispatch({ type: 'selectCondition', conditionId: on ? null : s.edge.conditionId })
                }
              >
                <circle cx={p.x} cy={p.y} r={R_SAT} />
                <text x={p.x} y={p.y - 2} textAnchor="middle" className="stitle">
                  {s.product.shortName ?? s.product.name}
                </text>
                <text x={p.x} y={p.y + 11} textAnchor="middle" className="seffect">
                  {effectLabel(s.edge.effect.value)}
                </text>
              </g>
            );
          })}
          {/* 라벨은 노드에 가리지 않도록 맨 마지막에 그린다 */}
          {graph.satellites.map((s, i) => {
            const p = satellitePos(i, graph.satellites.length);
            const on = s.edge.conditionId === selected;
            const mid = { x: CX + (p.x - CX) * LABEL_T, y: CY + (p.y - CY) * LABEL_T };
            return (
              <text
                key={`l-${s.edge.conditionId}`}
                x={mid.x}
                y={mid.y + 3}
                textAnchor="middle"
                className={`elabel${on ? ' on' : ''}`}
              >
                {s.edge.metricLabel.value}
              </text>
            );
          })}
        </svg>

        <p className="legend">
          선 {graph.edges.length}개는 모두 약관 문장에서 추출한 조건입니다
          {graph.edges.length > 0 && <span className="hint"> · 선을 누르면 원문이 보입니다</span>}
        </p>
      </div>

      {selectedItem && (
        <div className="card sheet">
          <Clause condition={selectedItem.condition} />
          <div className="sheetrow">
            <span className="meta">
              <Glyph name={TYPE_ICON[selectedItem.product.type] ?? 'deposit'} size={15} />
              {selectedItem.product.name} ← {graph.center.name}
            </span>
            <button
              type="button"
              className="link"
              onClick={() =>
                dispatch({
                  type: 'push',
                  route: { name: 'evidence', triggerId, productId: selectedItem.product.id },
                })
              }
            >
              근거 보기
              <Glyph name="chevron" size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="cardtitle">
          이 상품이 유지하고 있는 혜택
          <SourceTag source={d.total.source} />
        </h3>
        <Amount value={d.total} short size="lg" prefix="연" />
        <p className="note">조건 {graph.edges.length}건 · 회복 불가 {d.unrecoverable.length}건</p>
      </div>
    </AppShell>
  );
}
