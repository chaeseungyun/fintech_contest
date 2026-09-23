import { Glyph } from './Glyph';
import type { ActionContact } from '../lib/actionplan';
import { useStore } from '../state/store';

/**
 * 창구 정보. 실행 안내의 각 단계와 추천·제안 카드의 후보 행이 같은 블록을 쓴다.
 * "신청하기" 가 아니다 — 어디서 무엇을 물어보며 신청하는지만 보여준다. 이 앱은 가입을 처리하지 않는다.
 * 연락처는 products[].contact · candidates[].contact 에서만 온다. 번호가 없으면 없다고 그린다.
 */
export function ContactSheet({
  id,
  contact,
  label,
  intro,
}: {
  /** 화면 안에서 유일한 펼침 키 */
  id: string;
  contact: ActionContact;
  /** 버튼 문구. 기본은 "{금융사} 창구 정보" */
  label?: string;
  /** 펼쳤을 때 맨 위 한 줄 */
  intro?: string;
}) {
  const { state, dispatch } = useStore();
  const open = state.expandedStepKey === id;

  return (
    <>
      <button
        type="button"
        className="contactbtn"
        aria-expanded={open}
        onClick={() => dispatch({ type: 'toggleStep', stepKey: id })}
      >
        <Glyph name="phone" size={15} />
        {label ?? `${contact.institution} 창구 정보`}
        <Glyph name="down" size={14} className="caret" />
      </button>

      {open && (
        <div className="contactsheet">
          {intro && <p className="intro">{intro}</p>}
          <div className="f">
            <span className="k">담당</span>
            <span className="v">
              <span className="val">{contact.dept}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">신청 경로</span>
            <span className="v">
              <span className="val">{contact.channels.join(' / ')}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">운영 시간</span>
            <span className="v">
              <span className="val">{contact.hours}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">대표번호</span>
            <span className="v">
              {contact.tel ? (
                <span className="val">{contact.tel}</span>
              ) : (
                <em className="muted">공식 앱·홈페이지에서 확인</em>
              )}
            </span>
          </div>
          {contact.ask.length > 0 && (
            <div className="ask">
              <b>창구에서 꼭 물어볼 것</b>
              <ul>
                {contact.ask.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {/* 가상 브랜드라 부서·시간도 샘플이다. 확인된 값처럼 보이지 않게 적어 둔다 */}
          <p className="sample">
            {!contact.tel && '전화번호는 데이터에 없습니다 · 공식 앱·홈페이지에서 확인 · '}
            시연용 샘플 창구 정보 · 부서·운영 시간도 샘플입니다
          </p>
        </div>
      )}
    </>
  );
}
