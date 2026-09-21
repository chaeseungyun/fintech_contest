import { AppShell } from '../components/AppShell';
import { QuickMenu } from '../components/QuickMenu';
import { SOURCE_LABEL } from '../components/SourceTag';
import type { Source } from '../lib/types';
import { editCount, useStore } from '../state/store';

const SOURCES: Source[] = ['doc', 'holding', 'user'];

export function More() {
  const { state, scenario, dispatch } = useStore();
  const edits = editCount(state);

  return (
    <AppShell title="전체">
      {/* 홈과 같은 목록. 자기 자신(전체)으로 가는 항목만 뺀다 */}
      <QuickMenu exclude={['more']} />

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
          모든 수치는 값과 출처를 같은 객체로 들고 다닙니다. 태그가 없는 값은 이 앱의 계산 결과입니다.
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
              <span className="val">{edits}건</span>
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
