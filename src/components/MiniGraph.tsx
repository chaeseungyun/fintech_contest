import type { Graph } from '../lib/graph';
import { TYPE_ICON } from './Glyph';
import { Glyph } from './Glyph';

const W = 320;
const H = 210;
const CX = 84;
const CY = H / 2;
const CW = 98;
const CH = 92;
const SX = 214;
const SR = 24;

/**
 * SwitchPoint AI 히어로의 연결 관계도.
 * 선은 graph.satellites 배열을 순회해 그린다 — SVG 를 손으로 박아두지 않는다.
 */
export function MiniGraph({ graph, nodeLabel }: { graph: Graph; nodeLabel: string }) {
  const sats = graph.satellites;
  const n = Math.max(1, sats.length);
  const spread = Math.min(70, 150 / n);
  const y = (i: number) => CY + (i - (n - 1) / 2) * spread * (n === 1 ? 0 : 1);

  return (
    <svg
      className="minigraph"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${nodeLabel} 변경이 ${sats.length}개 상품에 연결된 관계도`}
    >
      {sats.map((s, i) => {
        const ty = y(i);
        const x1 = CX + CW / 2;
        const x2 = SX - SR;
        const mid = (x1 + x2) / 2;
        return (
          <path
            key={`e-${s.edge.conditionId}`}
            className="mg-edge"
            d={`M ${x1} ${CY} C ${mid} ${CY}, ${mid} ${ty}, ${x2} ${ty}`}
          />
        );
      })}

      <g className="mg-center">
        <rect x={CX - CW / 2} y={CY - CH / 2} width={CW} height={CH} rx={22} />
        <foreignObject x={CX - CW / 2} y={CY - CH / 2} width={CW} height={CH}>
          <div className="mg-centerbody">
            <Glyph name={TYPE_ICON[graph.center.type] ?? 'card'} size={24} />
            <b>{nodeLabel}</b>
          </div>
        </foreignObject>
      </g>

      {sats.map((s, i) => {
        const ty = y(i);
        return (
          <g key={s.product.id} className="mg-sat">
            <circle cx={SX} cy={ty} r={SR} />
            <foreignObject x={SX - SR} y={ty - SR} width={SR * 2} height={SR * 2}>
              <div className="mg-satbody">
                <Glyph name={TYPE_ICON[s.product.type] ?? 'deposit'} size={22} />
              </div>
            </foreignObject>
            <text x={SX + SR + 8} y={ty + 4} className="mg-label">
              {s.product.shortName ?? s.product.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
