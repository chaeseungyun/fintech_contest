import { Amount } from './Amount';
import { ContactSheet } from './ContactSheet';
import { Glyph, TYPE_ICON } from './Glyph';
import { SourceTag } from './SourceTag';
import { planBasisLabel, toContact } from '../lib/actionplan';
import { formatWonShort } from '../lib/format';
import type { CandidateResult, ChainLink } from '../lib/recommend';
import { tag } from '../lib/types';
import { useStore } from '../state/store';

const names = (links: ChainLink[]) => links.map((l) => l.product.shortName ?? l.product.name).join('·');

function CandidateRow({ result, triggerId }: { result: CandidateResult; triggerId: string }) {
  const { state, derived: d, dispatch } = useStore();
  const { candidate: c } = result;
  const open = state.expandedCandidateId === c.id;
  const chosen = d.chosen?.candidate.id === c.id;
  const r = d.recommendation;
  const contact = toContact(c.institution, c.contact);

  // 절차의 기준 안으로 고른다. 앱이 대신 고르지 않는다 — 여기서 누른 것만 실행 안내가 따른다.
  const choose = () => {
    dispatch({ type: 'chooseCandidate', triggerId, candidateId: c.id });
    dispatch({ type: 'push', route: { name: 'actionplan', triggerId } });
  };

  return (
    <div className={`crow${open ? ' open' : ''}${result.recommended ? ' rec' : ''}${chosen ? ' chosen' : ''}`}>
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
          {chosen ? <em className="pick on">절차 기준</em> : result.recommended && <em className="pick">이득</em>}
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

          <div className="rowactions">
            {contact && (
              <ContactSheet
                id={`cand:${c.id}`}
                contact={contact}
                label="신청 경로 보기"
                intro={`신청은 ${c.institution} 공식 채널에서 직접 합니다. 이 앱은 가입을 대신 처리하지 않습니다.`}
              />
            )}
            <button type="button" className="choosebtn" onClick={choose}>
              이 안으로 절차 보기
              <Glyph name="chevron" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 갈아타기 비교. 이미 계산한 손실을 문턱으로 삼아, 그걸 넘는 후보에 "이득" 을 붙인다.
 * 후보가 하나도 없으면 아무것도 그리지 않는다.
 * 절차의 기준 안은 사용자가 고른다 — "새 상품 없이" 도 하나의 안이다.
 */
export function RecommendCard({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const r = d.recommendation;
  if (r.results.length === 0) return null;
  const noneChosen = d.chosen === null;

  const chooseNone = () => {
    dispatch({ type: 'chooseCandidate', triggerId, candidateId: null });
    dispatch({ type: 'push', route: { name: 'actionplan', triggerId } });
  };

  return (
    <section className={`card recommend${r.best ? '' : ' none'}`}>
      <h3 className="cardtitle">
        {r.headline.title}
        <SourceTag source={r.hurdle.source} />
      </h3>
      <p className="chartnote">{r.headline.body}</p>

      <div className="candlist">
        {r.results.map((res) => (
          <CandidateRow key={res.candidate.id} result={res} triggerId={triggerId} />
        ))}

        <div className={`crow plain${noneChosen ? ' chosen' : ''}`}>
          <button type="button" className="head" onClick={chooseNone}>
            <span className="ico tint-deposit">
              <Glyph name="arrow" size={19} />
            </span>
            <span className="body">
              <b>{planBasisLabel(null, d.trigger)}</b>
              <span>대체 상품 없이 정리할 때의 절차</span>
            </span>
            <span className="tail">
              {noneChosen && <em className="pick on">절차 기준</em>}
              <Glyph name="chevron" size={16} />
            </span>
          </button>
        </div>
      </div>

      <p className="note">
        지금 실적을 새 상품으로 그대로 옮긴다고 가정한 계산입니다.
        {r.linkCount > r.preservableCount && ' 가입 시점에 확정된 우대는 어떤 상품으로도 살리지 못합니다.'}
      </p>
    </section>
  );
}
