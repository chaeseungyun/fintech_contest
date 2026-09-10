import { useMemo, useReducer } from 'react';
import { SOURCE_LABEL } from './components/SourceTag';
import { formatKoYMD } from './lib/format';
import type { Source } from './lib/types';
import { Connections } from './screens/Connections';
import { Evidence } from './screens/Evidence';
import { Impact } from './screens/Impact';
import { Timing } from './screens/Timing';
import { initialState, reducer, select, StoreContext, type Screen } from './state/store';

const SCREENS: { n: Screen; title: string; el: JSX.Element }[] = [
  { n: 1, title: '내 금융 연결', el: <Connections /> },
  { n: 2, title: '변경 영향', el: <Impact /> },
  { n: 3, title: '시점', el: <Timing /> },
  { n: 4, title: '근거', el: <Evidence /> },
];

const SOURCES: Source[] = ['doc', 'calc', 'holding', 'user'];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { scenario, derived } = useMemo(() => select(state), [state]);
  const store = useMemo(() => ({ state, scenario, derived, dispatch }), [state, scenario, derived]);
  const editCount = Object.values(state.edits).reduce((n, e) => n + Object.keys(e).length, 0);

  return (
    <StoreContext.Provider value={store}>
      <header className="topbar">
        <div className="brand">
          <b>급여통장 변경 — 연쇄 영향 분석</b>
          <span className="today">오늘 {formatKoYMD(derived.today)} 고정 · 시나리오 {scenario.meta.scenarioId}</span>
        </div>
        <div className="controls">
          {editCount > 0 && <span className="pill">수정 {editCount}건 반영 중</span>}
          <button type="button" className="tb" onClick={() => dispatch({ type: 'toggleShowAll' })}>
            {state.showAll ? '한 화면씩 보기' : '4화면 나란히'}
          </button>
          <button type="button" className="tb danger" onClick={() => dispatch({ type: 'reset' })}>
            데모 초기화
          </button>
        </div>
      </header>

      {state.showAll ? (
        <main className="stage all">
          {SCREENS.map((s) => (
            <section key={s.n} className="slot">
              <h3>
                {s.n} · {s.title}
              </h3>
              {s.el}
            </section>
          ))}
        </main>
      ) : (
        <main className="stage single">
          <section className="slot">
            {SCREENS.find((s) => s.n === state.screen)!.el}
            <nav className="dots" aria-label="화면 이동">
              {SCREENS.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  className={s.n === state.screen ? 'on' : undefined}
                  onClick={() => dispatch({ type: 'navigate', screen: s.n })}
                >
                  {s.n} {s.title}
                </button>
              ))}
            </nav>
          </section>
        </main>
      )}

      <footer className="legend-bar">
        {SOURCES.map((s) => (
          <span key={s} className={`tag t-${s}`}>
            {SOURCE_LABEL[s]}
          </span>
        ))}
        <span className="note">{scenario.meta.note}</span>
      </footer>
    </StoreContext.Provider>
  );
}
