import { AppShell } from '../components/AppShell';
import { ContactSheet } from '../components/ContactSheet';
import { Glyph } from '../components/Glyph';
import type { ActionStep } from '../lib/actionplan';
import { useStore } from '../state/store';

/**
 * 실행 안내. 판단 다음 화면이다 — 해지를 대신 실행하지 않는다.
 * 순서·기한·창구·확인할 질문만 보여준다. 문구와 순서는 전부 derive().actionPlan 에서 온다.
 * 기준 안(대체 상품)은 사용자가 비교 결과에서 고른 것이다. 앱이 고른 후보로 절차를 짜지 않는다.
 */
function StepRow({ step, index }: { step: ActionStep; index: number }) {
  return (
    <li className="pstep">
      <span className="no" aria-hidden="true">
        {index + 1}
      </span>
      <div className="body">
        <b>{step.title}</b>
        {step.whenLabel && (
          <span className="when">
            <Glyph name="clock" size={13} />
            {step.whenLabel}
          </span>
        )}
        <p className="detail">{step.detail}</p>

        {step.bullets.length > 0 && (
          <ul className="bullets">
            {step.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}

        {step.contact && <ContactSheet id={step.key} contact={step.contact} />}
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
          비교 결과로 돌아가기
        </button>
      }
    >
      <div className={`planhead ${plan.kind}`}>
        <span className="mark" aria-hidden="true">
          <Glyph name={plan.kind === 'switch' ? 'arrow' : plan.kind === 'pending' ? 'info' : 'check'} size={22} />
        </span>
        <h2>{plan.title}</h2>
        <p>{plan.summary}</p>
        <div className="basisrow">
          <span className="k">기준 안</span>
          <b>{plan.basis}</b>
          {d.recommendation.results.length > 0 && (
            <button type="button" className="link" onClick={() => dispatch({ type: 'back' })}>
              다른 안 고르기
              <Glyph name="chevron" size={13} />
            </button>
          )}
        </div>
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

      {plan.notes.map((n) => (
        <p key={n} className="footnote">
          {n}
        </p>
      ))}
    </AppShell>
  );
}
