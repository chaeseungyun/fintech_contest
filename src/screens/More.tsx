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
        <h3 className="cardtitle">숫자 옆 표시</h3>
        <ul className="legendlist">
          {SOURCES.map((s) => (
            <li key={s}>
              <span className={`tag t-${s}`}>{SOURCE_LABEL[s]}</span>
            </li>
          ))}
        </ul>
        <p className="note">
          표시가 없는 숫자는 앱이 계산한 값이에요.
        </p>
      </section>

      <section className="card">
        <h3 className="cardtitle">데모 정보</h3>
        <div className="fields">
          <div className="f">
            <span className="k">기준일</span>
            <span className="v">
              <span className="val">{scenario.meta.today}</span>
            </span>
          </div>
          <div className="f">
            <span className="k">사용자 수정</span>
            <span className="v">
              <span className="val">{edits}건</span>
            </span>
          </div>
        </div>
        <button type="button" className="btn danger-text" onClick={() => dispatch({ type: 'reset' })}>
          데모 초기화
        </button>
      </section>
    </AppShell>
  );
}
