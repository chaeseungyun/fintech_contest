import type { ReactNode } from 'react';
import { Glyph } from './Glyph';
import { TABS, useStore, type Tab } from '../state/store';

interface Props {
  /** 네비바 제목. 홈처럼 제목이 없는 화면은 생략한다. */
  title?: string;
  onBack?: () => void;
  /** 네비바 오른쪽 버튼들 */
  actions?: ReactNode;
  /** 헤더를 화면이 직접 그리는 경우(홈) */
  header?: ReactNode;
  /** 하단 고정 버튼 영역 */
  footer?: ReactNode;
  /** 탭바를 감출 화면(분석 흐름) */
  hideTabBar?: boolean;
  children: ReactNode;
}

export function AppShell({
  title,
  onBack,
  actions,
  header,
  footer,
  hideTabBar,
  children,
}: Props) {
  const { state, dispatch } = useStore();

  return (
    <div className="app">
      <div className="statusbar">
        <span className="time">9:41</span>
        <span className="sig" aria-hidden="true">
          <i className="bars" />
          <i className="wifi" />
          <i className="batt" />
        </span>
      </div>

      {header ?? (
        <div className="navbar">
          {onBack ? (
            <button type="button" className="navbtn" onClick={onBack} aria-label="뒤로">
              <Glyph name="back" size={22} />
            </button>
          ) : (
            <span className="navbtn ghost" aria-hidden="true" />
          )}
          <h1>{title}</h1>
          <span className="navactions">{actions}</span>
        </div>
      )}

      <main className="appbody">{children}</main>

      {footer && <div className="appfooter">{footer}</div>}

      {!hideTabBar && (
        <nav className="tabbar" aria-label="주요 메뉴">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === state.tab && state.stack.length === 0 ? 'on' : undefined}
              aria-current={t.id === state.tab && state.stack.length === 0 ? 'page' : undefined}
              onClick={() => dispatch({ type: 'selectTab', tab: t.id as Tab })}
            >
              <Glyph name={t.icon as never} size={22} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="homebar" aria-hidden="true">
        <i />
      </div>
    </div>
  );
}
