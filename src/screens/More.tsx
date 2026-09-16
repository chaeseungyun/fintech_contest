import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { SOURCE_LABEL } from '../components/SourceTag';
import type { Source } from '../lib/types';
import { useStore, type Tab } from '../state/store';

const SOURCES: Source[] = ['doc', 'calc', 'holding', 'user'];

const MENU: { key: string; label: string; tab?: Tab }[] = [
  { key: 'account', label: '계좌 조회', tab: 'assets' },
  { key: 'card', label: '카드', tab: 'assets' },
  { key: 'loan', label: '대출', tab: 'assets' },
  { key: 'deposit', label: '예·적금', tab: 'assets' },
  { key: 'invest', label: '투자', tab: 'assets' },
  { key: 'insurance', label: '보험', tab: 'assets' },
  { key: 'benefit', label: '혜택', tab: 'benefits' },
  { key: 'autopay', label: '자동이체', tab: 'assets' },
  { key: 'ai', label: 'SwitchPoint AI' },
];

export function More() {
  const { state, scenario, dispatch } = useStore();
  const editCount = Object.values(state.edits).reduce((n, e) => n + Object.keys(e).length, 0);

  return (
    <AppShell title="전체">
      <div className="menugrid">
        {MENU.map((m) => (
          <button
            key={m.key}
            type="button"
            className="quick"
            onClick={() =>
              m.tab
                ? dispatch({ type: 'selectTab', tab: m.tab })
                : dispatch({ type: 'push', route: { name: 'switchpoint' } })
            }
          >
            <span className="ico">
              <Glyph name={m.key as never} size={23} />
            </span>
            <span className="qlabel">{m.label}</span>
          </button>
        ))}
      </div>

      <section className="card">
        <h3 className="cardtitle">화면에 붙는 출처 태그</h3>
        <ul className="legendlist">
          {SOURCES.map((s) => (
            <li key={s}>
              <span className={`tag t-${s}`}>{SOURCE_LABEL[s]}</span>
            </li>
          ))}
        </ul>
        <p className="note">
          모든 수치는 값과 출처를 같은 객체로 들고 다닙니다. 상세 화면에서 태그를 확인할 수 있습니다.
        </p>
      </section>

      <section className="card">
        <h3 className="cardtitle">데모 정보</h3>
        <div className="fields">
          <div className="f">
            <span className="k">시나리오</span>
            <span className="v">
              <span className="val">{scenario.meta.scenarioId}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">기준일</span>
            <span className="v">
              <span className="val">{scenario.meta.today}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">타임존</span>
            <span className="v">
              <span className="val">{scenario.meta.timezone}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">사용자 수정</span>
            <span className="v">
              <span className="val">{editCount}건 · 삭제 {state.removed.length}건</span>
            </span>
          </div>
        </div>
        <p className="note">{scenario.meta.note}</p>
        <button type="button" className="btn danger-text" onClick={() => dispatch({ type: 'reset' })}>
          데모 초기화
        </button>
      </section>
    </AppShell>
  );
}
