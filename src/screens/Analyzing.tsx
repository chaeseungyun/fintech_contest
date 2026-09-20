import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { useStore } from '../state/store';

/** 한 단계가 끝나는 데 걸리는 시간(ms). 계산 자체는 즉시 끝나고, 이건 진행 표시용이다. */
const STEP_MS = 500;
const FINISH_MS = 400;

/**
 * 분석 중 화면. 단계 문구와 숫자는 derive() 가 이미 계산해 둔 결과(d.steps)를 읽는다 —
 * 연출을 위해 가짜 값을 만들지 않는다.
 */
export function Analyzing({ triggerId }: { triggerId: string }) {
  const { scenario, derived: d, dispatch } = useStore();
  const [done, setDone] = useState(0);
  const total = d.steps.length;

  const goResult = () => dispatch({ type: 'replace', route: { name: 'impact', triggerId } });

  useEffect(() => {
    if (done >= total) {
      const t = setTimeout(goResult, FINISH_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, total]);

  const pct = Math.round((done / total) * 100);

  return (
    <AppShell title="분석 중" onBack={() => dispatch({ type: 'back' })} hideTabBar>
      <div className="analyzing">
        <div className="orb" aria-hidden="true">
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="core">
            <Glyph name="ai" size={30} />
          </span>
        </div>

        <h2>
          {scenario.brand.service}가
          <br />
          연결된 영향을 분석하고 있습니다
        </h2>
        <p className="target">
          {d.center.institution} {d.center.name} · {d.trigger.label}
        </p>

        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>

        <ol className="steps">
          {d.steps.map((s, i) => {
            const state = i < done ? 'done' : i === done ? 'run' : 'wait';
            return (
              <li key={s.key} className={state}>
                <span className="mark" aria-hidden="true">
                  {state === 'done' ? <Glyph name="check" size={15} /> : <i className="dot" />}
                </span>
                <span className="txt">
                  <b>{s.label}</b>
                  {state === 'done' && <span className="detail">{s.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>

        <button type="button" className="btn text" onClick={goResult}>
          결과 바로 보기
        </button>
      </div>
    </AppShell>
  );
}
