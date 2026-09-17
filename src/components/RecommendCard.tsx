import { Amount } from './Amount';
import { Glyph, TYPE_ICON } from './Glyph';
import { SourceTag } from './SourceTag';
import { formatWonShort } from '../lib/format';
import type { CandidateResult, ChainLink } from '../lib/recommend';
import { tag } from '../lib/types';
import { useStore } from '../state/store';

const names = (links: ChainLink[]) => links.map((l) => l.product.shortName ?? l.product.name).join('·');

function CandidateRow({ result }: { result: CandidateResult }) {
  const { state, derived: d, dispatch } = useStore();
  const { candidate: c } = result;
  const open = state.expandedCandidateId === c.id;
  const r = d.recommendation;

  return (
    <div className={`crow${open ? ' open' : ''}${result.recommended ? ' rec' : ''}`}>
      <button
        type="button"
        className="head"
        aria-expanded={open}
        onClick={() => dispatch({ type: 'toggleCandidate', candidateId: c.id })}
      >
        <span className={`ico tint-${TYPE_ICON[c.type] ?? 'card'}`}>
          <Glyph name={TYPE_ICON[c.type] ?? 'card'} size={21} />
        </span>
        <span className="body">
          <b>
            {c.institution} {c.name}
          </b>
          <span>{result.basisLabel}</span>
        </span>
        <span className="tail">
          {result.recommended && <em className="pick">추천</em>}
          <Amount value={result.netAfter} signed short />
          <Glyph name="down" size={16} className="caret" />
        </span>
      </button>

      {open && (
        <div className="detail">
          <div className="f">
            <span className="k">지금 {d.trigger.verb} 시 순손익</span>
            <span className="v">
              <Amount value={d.netAnnual} signed short showTag />
            </span>
          </div>
          {r.linkCount > 0 && (
            <div className="f">
              <span className="k">
                유지되는 연결
                {result.preserved.length > 0 && <span className="note">{names(result.preserved)}</span>}
              </span>
              <span className="v">
                {result.linkUnknown ? (
                  <em className="muted">확인 필요</em>
                ) : (
                  <Amount value={result.preservedLoss} signed short showTag />
                )}
              </span>
            </div>
          )}
          {result.broken.length > 0 && (
            <div className="f">
              <span className="k">
                끊기는 연결
                <span className="note">{names(result.broken)}</span>
              </span>
              <span className="v">
                <em className="muted">{formatWonShort(result.brokenLoss.value)} 그대로 잃음</em>
              </span>
            </div>
          )}
          {c.ownBenefits.length > 0 && (
            <div className="f">
              <span className="k">
                자체 혜택
                <span className="note">{c.ownBenefits.map((b) => b.label).join('·')}</span>
              </span>
              <span className="v">
                <Amount value={result.ownBenefit} signed short showTag />
              </span>
            </div>
          )}
          {d.trigger.savings.length > 0 && (
            <div className="f">
              <span className="k">{r.costLabel}</span>
              <span className="v">
                <Amount value={tag(-result.ownCost.value, result.ownCost.source)} signed short showTag />
              </span>
            </div>
          )}
          <div className="f">
            <span className="k">갈아탄 뒤 연 순손익</span>
            <span className="v">
              <Amount value={result.netAfter} signed short showTag />
            </span>
          </div>

          <p className="clause">“{c.satisfies.sourceText}”</p>
          <span className="src">{c.sourceDoc}</span>

          {result.linkUnknown && (
            <p className="note warn">
              연결 유지 여부를 약관에서 확정하지 못했습니다
              {c.satisfies.unsupportedReason ? ` (${c.satisfies.unsupportedReason})` : ''}. 아무 연결도
              유지되지 않는 것으로 보수적으로 계산했습니다.
            </p>
          )}
          {result.eligibility === 'unknown' && c.eligibility && (
            <p className="note warn">가입 자격은 확인이 필요합니다: “{c.eligibility.sourceText}”</p>
          )}
          {result.eligibility === 'unmet' && c.eligibility && (
            <p className="note danger">가입 자격 미충족: “{c.eligibility.sourceText}”</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 갈아타기 추천. 이미 계산한 손실을 문턱으로 삼아, 그걸 넘는 후보만 추천한다.
 * 후보가 하나도 없으면 아무것도 그리지 않는다.
 */
export function RecommendCard() {
  const { derived: d } = useStore();
  const r = d.recommendation;
  if (r.results.length === 0) return null;

  return (
    <section className={`card recommend${r.best ? '' : ' none'}`}>
      <h3 className="cardtitle">
        {r.headline.title}
        <SourceTag source={r.hurdle.source} />
      </h3>
      <p className="chartnote">{r.headline.body}</p>

      <div className="candlist">
        {r.results.map((res) => (
          <CandidateRow key={res.candidate.id} result={res} />
        ))}
      </div>

      <p className="note">
        지금 실적을 새 상품으로 그대로 옮긴다고 가정한 계산입니다.
        {r.linkCount > r.preservableCount && ' 가입 시점에 확정된 우대는 어떤 상품으로도 살리지 못합니다.'}
      </p>
    </section>
  );
}
