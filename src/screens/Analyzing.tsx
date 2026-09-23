import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { useStore } from '../state/store';

/** 한 단계가 끝나는 데 걸리는 시간(ms). 계산 자체는 즉시 끝나고, 이건 진행 표시용이다. */
const STEP_MS = 500;
const FINISH_MS = 400;
/** 진행률 링 반지름 (viewBox 140 기준) */
const RING_R = 56;
/** 링과 숫자가 다음 값까지 차오르는 시간. 한 단계(STEP_MS) 안에 끝나야 멈춰 있는 틈이 없다 */
const FILL_MS = 450;

/**
 * 목표값까지 ease-out 으로 따라가는 값. 링과 퍼센트 숫자가 같은 값을 읽어 어긋나지 않는다.
 * 움직임 줄이기 설정이면 바로 목표값으로 간다.
 */
function useEased(target: number): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let id = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / FILL_MS);
      const v = a + (target - a) * (1 - (1 - k) ** 3);
      from.current = v;
      setValue(v);
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return value;
}

/**
 * 분석 중 화면. 단계 문구와 숫자는 derive() 가 이미 계산해 둔 결과(d.steps)를 읽는다 —
 * 연출을 위해 가짜 값을 만들지 않는다.
 */
export function Analyzing({ triggerId }: { triggerId: string }) {
  const { scenario, derived: d, dispatch } = useStore();
  const [done, setDone] = useState(0);
  const total = d.steps.length;

  // 결론부터 보여준다. 이유(항목별 영향)는 비교 결과에서 한 단계 들어간다.
  const goResult = () => dispatch({ type: 'replace', route: { name: 'verdict', triggerId } });

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
  const shown = useEased(pct);
  const C = 2 * Math.PI * RING_R;

  return (
    <AppShell
      title="분석 중"
      onBack={() => dispatch({ type: 'back' })}
      hideTabBar
      footer={
        // 하단 고정 — 카드가 쌓여도 버튼이 밀려 내려가지 않는다
        <button type="button" className="btn text" onClick={goResult}>
          결과 바로 보기
          <Glyph name="chevron" size={15} />
        </button>
      }
    >
      <div className="analyzing">
        <span className="targetchip">
          <Glyph name={d.trigger.icon} size={15} />
          {d.center.institution} {d.center.name} · {d.trigger.label}
        </span>

        <svg
          className="ring"
          viewBox="0 0 140 140"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="분석 진행률"
        >
          <circle className="track" cx="70" cy="70" r={RING_R} />
          <circle
            className="fill"
            cx="70"
            cy="70"
            r={RING_R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - shown / 100)}
            transform="rotate(-90 70 70)"
          />
          <text className="pct" x="70" y="66">
            {Math.round(shown)}%
          </text>
          <text className="stepno" x="70" y="86">
            {Math.min(done + 1, total)} / {total} 단계
          </text>
        </svg>

        {/* 상시 분석이 이미 찾아 둔 연결에 이 변경을 넣어 보는 것이다 — 처음 분석하는 것처럼 쓰지 않는다 */}
        <div className="head">
          <h1>
            {scenario.brand.service}가 미리 찾아 둔 연결로
            <br />
            손익을 계산하고 있습니다
          </h1>
          {/* 연출과 구현을 구분한다 — 약관을 방금 읽은 것처럼 보이지 않게 */}
          <p className="samplenote">시연용 샘플 조건 · 실시간 약관 추출·AI 호출 없음</p>
        </div>
      </div>

      {/* 시작한 단계만 카드로 하나씩 쌓는다. 카드는 처음부터 설명 줄 자리를 잡고 있어 완료돼도 높이가 변하지 않는다 */}
      <ol className="steps">
        {d.steps.slice(0, done + 1).map((s, i) => {
          const state = i < done ? 'done' : 'run';
          return (
            <li key={s.key} className={state}>
              <span className="mark" aria-hidden="true">
                {state === 'done' ? <Glyph name="check" size={13} /> : <i className="dot" />}
              </span>
              <span className="txt">
                <b>{s.label}</b>
                <span className="detail" aria-hidden={state !== 'done'}>
                  {s.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </AppShell>
  );
}
