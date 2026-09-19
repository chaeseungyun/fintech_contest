import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { SourceTag } from '../components/SourceTag';
import type { ActionStep } from '../lib/actionplan';
import { useStore } from '../state/store';

/**
 * 실행 안내. 판단 다음 화면이다 — 해지를 대신 실행하지 않는다.
 * 순서·기한·창구·확인할 질문만 보여준다. 문구와 순서는 전부 derive().actionPlan 에서 온다.
 */
function StepRow({ step, index }: { step: ActionStep; index: number }) {
  const { state, dispatch } = useStore();
  const open = state.expandedStepKey === step.key;

  return (
    <li className={`pstep${open ? ' open' : ''}`}>
      <span className="no" aria-hidden="true">
        {index + 1}
      </span>
      <div className="body">
        <b>{step.title}</b>
        {step.whenLabel && (
          <span className="when">
            <Glyph name="clock" size={13} />
            {step.whenLabel}
            {step.when && <SourceTag source={step.when.source} />}
          </span>
        )}
        <p className="detail">
          {step.detail} <SourceTag source={step.source} />
        </p>

        {step.bullets.length > 0 && (
          <ul className="bullets">
            {step.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}

        {step.contact && (
          <>
            <button
              type="button"
              className="contactbtn"
              aria-expanded={open}
              onClick={() => dispatch({ type: 'toggleStep', stepKey: step.key })}
            >
              <Glyph name="phone" size={15} />
              {step.contact.institution} 창구 정보
              <Glyph name="down" size={14} className="caret" />
            </button>

            {open && (
              <div className="contact">
                <div className="f">
                  <span className="k">담당</span>
                  <span className="v">
                    <span className="val">{step.contact.dept}</span>
                  </span>
                </div>
                <div className="f">
                  <span className="k">신청 경로</span>
                  <span className="v">
                    <span className="val">{step.contact.channels.join(' / ')}</span>
                  </span>
                </div>
                <div className="f">
                  <span className="k">운영 시간</span>
                  <span className="v">
                    <span className="val">{step.contact.hours}</span>
                  </span>
                </div>
                <div className="f">
                  <span className="k">대표번호</span>
                  <span className="v">
                    {step.contact.tel ? (
                      <span className="val">{step.contact.tel}</span>
                    ) : (
                      <em className="muted">공식 앱·홈페이지에서 확인</em>
                    )}
                  </span>
                </div>
                {step.contact.ask.length > 0 && (
                  <div className="ask">
                    <b>창구에서 꼭 물어볼 것</b>
                    <ul>
                      {step.contact.ask.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function ActionPlan({ triggerId }: { triggerId: string }) {
  const { derived: d, dispatch } = useStore();
  const plan = d.actionPlan;

  return (
    <AppShell
      title="실행 안내"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'back' })}>
          판단 결과로 돌아가기
        </button>
      }
    >
      <div className={`planhead ${plan.kind}`}>
        <span className="mark" aria-hidden="true">
          <Glyph name={plan.kind === 'keep' ? 'check' : 'arrow'} size={22} />
        </span>
        <h2>{plan.title}</h2>
        <p>{plan.summary}</p>
      </div>

      <ol className="planlist">
        {plan.steps.map((s, i) => (
          <StepRow key={s.key} step={s} index={i} />
        ))}
      </ol>

      <button
        type="button"
        className="btn ghost"
        onClick={() => dispatch({ type: 'push', route: { name: 'timeline', triggerId } })}
      >
        판정일·안전 시점 다시 보기
      </button>

      <section className="card">
        <h3 className="cardtitle">
          이 안내가 하지 않는 일
          <Glyph name="info" size={16} />
        </h3>
        <p className="note">
          {d.trigger.verb} 신청은 각 금융사에 직접 해야 합니다. 이 앱은 손익을 계산하고 순서를
          안내할 뿐, 계약을 대신 처리하지 않습니다.
        </p>
      </section>

      {plan.notes.map((n) => (
        <p key={n} className="footnote">
          {n}
        </p>
      ))}
    </AppShell>
  );
}
