import { AppShell } from '../components/AppShell';
import { Amount } from '../components/Amount';
import { Glyph, TYPE_ICON } from '../components/Glyph';
import { Clause } from '../components/Clause';
import { SourceTag } from '../components/SourceTag';
import { formatRateDelta } from '../lib/money';
import { formatRate } from '../lib/format';
import type { Satellite } from '../lib/graph';
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
  if (e.kind === 'spend_rate') return `적립 ${formatRate(e.value)}`;
  return e.value >= 10000 ? `월 ${e.value / 10000}만원` : `월 ${e.value / 1000}천원`;
}

/** 한 노드에 걸린 조건들의 효과 합. 종류가 섞이면 첫 조건 것만 쓴다(현재 데이터엔 없음) */
function satEffect(s: Satellite): Effect {
  const [first] = s.edges;
  const same = s.edges.every((e) => e.effect.value.kind === first.effect.value.kind);
  if (!same) return first.effect.value;
  return { kind: first.effect.value.kind, value: s.edges.reduce((a, e) => a + e.effect.value.value, 0) };
}

/** "카드 실적 조건" · 같은 라벨이 여럿이면 "카드 실적 조건 2건" */
function satLabel(s: Satellite): string {
  const labels = [...new Set(s.edges.map((e) => e.metricLabel.value))];
  return labels.length === 1 && s.edges.length > 1 ? `${labels[0]} ${s.edges.length}건` : labels.join('·');
}

/** 노드를 누를 때마다 그 노드의 조건을 하나씩 넘기고, 마지막 다음엔 선택을 푼다 */
function nextSelection(s: Satellite, selected: string | null): string | null {
  const i = s.edges.findIndex((e) => e.conditionId === selected);
  if (i < 0) return s.edges[0].conditionId;
  return i + 1 < s.edges.length ? s.edges[i + 1].conditionId : null;
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
            const on = s.edges.some((e) => e.conditionId === selected);
            return (
              <g
                key={s.product.id}
                className={`edge${on ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'selectCondition', conditionId: nextSelection(s, selected) })}
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
            const on = s.edges.some((e) => e.conditionId === selected);
            return (
              <g
                key={s.product.id}
                className={`sat${on ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'selectCondition', conditionId: nextSelection(s, selected) })}
              >
                <circle cx={p.x} cy={p.y} r={R_SAT} />
                <text x={p.x} y={p.y - 2} textAnchor="middle" className="stitle">
                  {s.product.shortName ?? s.product.name}
                </text>
                <text x={p.x} y={p.y + 11} textAnchor="middle" className="seffect">
                  {effectLabel(satEffect(s))}
                </text>
              </g>
            );
          })}
          {/* 라벨은 노드에 가리지 않도록 맨 마지막에 그린다 */}
          {graph.satellites.map((s, i) => {
            const p = satellitePos(i, graph.satellites.length);
            const on = s.edges.some((e) => e.conditionId === selected);
            const mid = { x: CX + (p.x - CX) * LABEL_T, y: CY + (p.y - CY) * LABEL_T };
            return (
              <text
                key={`l-${s.product.id}`}
                x={mid.x}
                y={mid.y + 3}
                textAnchor="middle"
                className={`elabel${on ? ' on' : ''}`}
              >
                {satLabel(s)}
              </text>
            );
          })}
        </svg>

        <p className="legend">
          {graph.edges.length > 0 && '선을 누르면 약관 원문이 보여요'}
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
