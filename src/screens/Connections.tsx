import { Highlight } from '../components/Highlight';
import { PhoneFrame, TabBar } from '../components/PhoneFrame';
import { SourceTag } from '../components/SourceTag';
import { formatWon } from '../lib/format';
import { formatRateDelta } from '../lib/money';
import type { Effect } from '../lib/types';
import { useStore } from '../state/store';

const W = 320;
const H = 270;
const CX = W / 2;
const CY = H / 2;
const RX = 114; // 위성 타원 반경
const RY = 98;
const R_CENTER = 34;
const R_SAT = 28;
const LABEL_T = 0.55; // 선 위 라벨 위치 (중앙 0 → 위성 1)

function effectLabel(e: Effect): string {
  if (e.kind === 'rate_delta') return formatRateDelta(e.value);
  return e.value >= 10000 ? `월 ${e.value / 10000}만원` : `월 ${e.value / 1000}천원`;
}

/** n 개의 위성을 타원 위에 고르게 놓는다. 첫 노드는 왼쪽 위(-135°). */
function satellitePos(i: number, n: number) {
  const angle = ((-135 + (i * 360) / n) * Math.PI) / 180;
  return { x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle) };
}

export function Connections() {
  const { state, derived: d, dispatch } = useStore();
  const { graph } = d;
  const selected = state.selectedConditionId;
  const selectedItem = d.items.find((i) => i.condition.id === selected) ?? null;

  return (
    <PhoneFrame title="내 금융 연결" tabbar={<TabBar active="연결" />}>
      <div className="graph">
        <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="금융 연결 관계도">
          {/* 선: 조건 배열을 순회해 그린다 */}
          {graph.satellites.map((s, i) => {
            const p = satellitePos(i, graph.satellites.length);
            const on = s.edge.conditionId === selected;
            // 라벨은 중앙 원 밖, 위성 원 안쪽 — 선의 LABEL_T 지점에 둔다
            const mid = { x: CX + (p.x - CX) * LABEL_T, y: CY + (p.y - CY) * LABEL_T };
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
                <text x={mid.x} y={mid.y + 3} textAnchor="middle" className="elabel">
                  {s.edge.metricLabel.value}
                </text>
              </g>
            );
          })}

          {/* 중앙: 변경 대상 상품 */}
          <circle cx={CX} cy={CY} r={R_CENTER} fill="var(--brand)" />
          <text x={CX} y={CY - 4} textAnchor="middle" className="ctitle">
            {graph.center.shortName ?? graph.center.name}
          </text>
          <text x={CX} y={CY + 9} textAnchor="middle" className="csub">
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
                <text x={p.x} y={p.y - 3} textAnchor="middle" className="stitle">
                  {s.product.shortName ?? s.product.name}
                </text>
                <text x={p.x} y={p.y + 9} textAnchor="middle" className="seffect">
                  {effectLabel(s.edge.effect.value)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="legend">
          선 {graph.edges.length}개는 모두 약관 문장에서 추출한 조건입니다 <SourceTag source="doc" />
          {graph.edges.length > 0 && <span className="hint"> · 선을 누르면 원문이 보입니다</span>}
        </div>
      </div>

      {selectedItem && (
        <div className="sheet">
          <div className="inst">{selectedItem.condition.sourceDoc}</div>
          <div className="clause-inline">
            <Highlight text={selectedItem.condition.sourceText} spans={selectedItem.condition.spans} />
          </div>
          <div className="sheet-row">
            <span className="meta">
              {selectedItem.product.name} ← {graph.center.name} · 신뢰도{' '}
              {Math.round(selectedItem.condition.confidence * 100)}%
            </span>
            <button
              type="button"
              className="link"
              onClick={() => dispatch({ type: 'showEvidence', productId: selectedItem.product.id })}
            >
              근거 보기
            </button>
          </div>
        </div>
      )}

      <div className="box">
        <div className="inst">이 통장이 유지하고 있는 혜택</div>
        <div className="pname">
          연 {formatWon(d.total.value)} <SourceTag source={d.total.source} />
        </div>
        <button type="button" className="meta link" onClick={() => dispatch({ type: 'navigate', screen: 4 })}>
          조건 {graph.edges.length}건 · 원문 보기
        </button>
      </div>

      <button type="button" className="cta" onClick={() => dispatch({ type: 'navigate', screen: 2 })}>
        {d.trigger.label}
      </button>
    </PhoneFrame>
  );
}
