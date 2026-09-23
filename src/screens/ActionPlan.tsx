import { AppShell } from '../components/AppShell';
import { ContactSheet } from '../components/ContactSheet';
import { Glyph } from '../components/Glyph';
import type { ActionStep } from '../lib/actionplan';
import { editCount, useStore } from '../state/store';
import { EditBadge } from '../components/EditBadge';

/**
 * 실행 안내. 판단 다음 화면이다 — 해지를 대신 실행하지 않는다.
 * 순서·기한·창구·확인할 질문만 보여준다. 문구와 순서는 전부 derive().actionPlan 에서 온다.
 * 기준 안(대체 상품)은 사용자가 비교 결과에서 고른 것이다. 앱이 고른 후보로 절차를 짜지 않는다.
 */
/** 되돌릴 수 없는 손실을 알리는 단계 — 해지 단계보다 앞에 오고, 그냥 지나칠 수 없게 벽돌색으로 그린다 */
const LOSS_STEPS = new Set(['early', 'unrecoverable']);

function StepRow({ step, index }: { step: ActionStep; index: number }) {
  const loss = LOSS_STEPS.has(step.key);
  return (
    <li className={`pstep${loss ? ' loss' : ''}`}>
      <span className="no" aria-hidden="true">
        {index + 1}
      </span>
      <div className="body">
        <div className="title">
          <b>{step.title}</b>
          {step.whenLabel && <span className="when">{step.whenLabel}</span>}
        </div>
        <div className="text">
          <p className="detail">{step.detail}</p>
          {step.bullets.length > 0 && (
            <ul className="bullets">
              {step.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>

        {step.contact && <ContactSheet id={step.key} contact={step.contact} />}
      </div>
    </li>
  );
}

export function ActionPlan({ triggerId }: { triggerId: string }) {
  const { state, derived: d, dispatch } = useStore();
  const plan = d.actionPlan;

  return (
    <AppShell
      title="실행 안내"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        <button type="button" className="btn primary" onClick={() => dispatch({ type: 'selectTab', tab: 'home' })}>
          홈으로
        </button>
      }
    >
      <section className={`planhead ${plan.kind}`}>
        <span className="meta">
          {d.center.institution} {d.center.name} · {d.trigger.verb}
        </span>
        <h1>{plan.title}</h1>
        <p>{plan.summary}</p>
        <div className="basisrow">
          <span className="k">기준 안</span>
          <b>{plan.basis}</b>
          <EditBadge count={editCount(state)} />
          {d.recommendation.results.length > 0 && (
            <button type="button" className="link" onClick={() => dispatch({ type: 'back' })}>
              다른 안 고르기
              <Glyph name="chevron" size={13} />
            </button>
          )}
        </div>
      </section>

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
        우대 확인일 · 변경 가능 구간 다시 보기
        <Glyph name="chevron" size={14} />
      </button>

      {plan.notes.map((n) => (
        <p key={n} className="footnote">
          {n}
        </p>
      ))}
    </AppShell>
  );
}
