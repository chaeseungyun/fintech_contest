import { Amount } from './Amount';
import { ContactSheet } from './ContactSheet';
import { Glyph, TileIcon, TYPE_ICON } from './Glyph';
import { SourceTag } from './SourceTag';
import { toContact } from '../lib/actionplan';
import type { AddonProposal, AddonResult } from '../lib/addon';
import { tag } from '../lib/types';
import { useStore } from '../state/store';

/**
 * 연계 가입 제안. 갈아타기 카드와 다르다 — 지금 상품을 그대로 두고 "더하면" 이득인 후보다.
 * 금액은 전부 addonProposals() 가 계산한 값이다. 후보가 없으면 아무것도 그리지 않는다.
 */
function AddonRow({ result }: { result: AddonResult }) {
  const { state, dispatch } = useStore();
  const { candidate: c } = result;
  const open = state.expandedCandidateId === c.id;
  const contact = toContact(c.institution, c.contact);

  return (
    <div className={`crow${open ? ' open' : ''}${result.recommended ? ' rec' : ''}`}>
      <button
        type="button"
        className="head"
        aria-expanded={open}
        onClick={() => dispatch({ type: 'toggleCandidate', candidateId: c.id })}
      >
        <TileIcon name={TYPE_ICON[c.type] ?? 'card'} size={21} />
        <span className="body">
          <b>
            {c.institution} {c.name}
          </b>
          <span>{result.basisLabel}</span>
        </span>
        <span className="tail">
          {result.recommended && <em className="pick">제안</em>}
          <Amount value={result.netGain} signed short />
          <Glyph name="down" size={16} className="caret" />
        </span>
      </button>

      {open && (
        <div className="detail">
          {result.unlocked.length > 0 && (
            <div className="f">
              <span className="k">
                다시 적용되는 조건
                <span className="note">
                  {result.unlocked.map((u) => u.product.shortName ?? u.product.name).join('·')}
                </span>
              </span>
              <span className="v">
                <Amount value={result.unlockedGain} signed short showTag />
              </span>
            </div>
          )}
          <div className="f">
            <span className="k">
              이 상품 자체 혜택
              <span className="note">{c.ownBenefits.map((b) => b.label).join('·')}</span>
            </span>
            <span className="v">
              <Amount value={result.ownBenefit} signed short showTag />
            </span>
          </div>
          <div className="f">
            <span className="k">유지 비용</span>
            <span className="v">
              <Amount value={tag(-result.ownCost.value, result.ownCost.source)} signed short showTag />
            </span>
          </div>
          <div className="f">
            <span className="k">더했을 때 연 순이득</span>
            <span className="v">
              <Amount value={result.netGain} signed short showTag />
            </span>
          </div>

          <div className="clause">
            <span className="doc">{c.sourceDoc}</span>
            <p>“{c.satisfies.sourceText}”</p>
          </div>

          {result.eligibility === 'unknown' && c.eligibility && (
            <p className="note warn">가입 자격은 확인이 필요합니다: “{c.eligibility.sourceText}”</p>
          )}
          {result.eligibility === 'unmet' && c.eligibility && (
            <p className="note danger">가입 자격 미충족: “{c.eligibility.sourceText}”</p>
          )}

          {contact && (
            <ContactSheet
              id={`addon:${c.id}`}
              contact={contact}
              label="신청 경로 보기"
              intro={`신청은 ${c.institution} 공식 채널에서 직접 합니다. 이 앱은 가입을 대신 처리하지 않습니다.`}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function AddonCard({ proposal, title }: { proposal: AddonProposal; title?: string }) {
  if (proposal.results.length === 0) return null;
  const best = proposal.best;

  return (
    <section className={`card recommend addon${best ? '' : ' none'}`}>
      <h3 className="cardtitle">
        <span className="ico tint-save addmark">
          <Glyph name="plus" size={15} />
        </span>
        {title ?? '지금 조합에 더하면 이득인 상품'}
        {best && <SourceTag source={best.netGain.source} />}
      </h3>
      <p className="chartnote">
        {best
          ? `보유 상품은 그대로 두고 더했을 때의 연 순이득입니다. 유지 비용을 빼고 이득이 남는 후보만 제안합니다.`
          : '지금 더해서 이득이 남는 후보가 없습니다.'}
      </p>

      <div className="candlist">
        {proposal.results.map((r) => (
          <AddonRow key={r.candidate.id} result={r} />
        ))}
      </div>

      {proposal.inactiveCount > 0 && (
        <p className="note">
          실적 미달로 꺼져 있는 조건 {proposal.inactiveCount}건을 후보가 대신 채울 수 있는지까지 함께 계산했습니다.
        </p>
      )}
    </section>
  );
}
