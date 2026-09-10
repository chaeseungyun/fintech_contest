import type { ReactNode } from 'react';

interface Props {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  tabbar?: ReactNode;
}

/** 폰 프레임. CSS 로만 그린다. */
export function PhoneFrame({ title, onBack, children, tabbar }: Props) {
  return (
    <div className="phone">
      <div className="status">
        <span>9:41</span>
        <span>LTE</span>
      </div>
      <div className="navbar">
        {onBack && (
          <button type="button" className="back" onClick={onBack} aria-label="뒤로">
            〈
          </button>
        )}
        <span>{title}</span>
      </div>
      <div className="body">{children}</div>
      {tabbar}
      <div className="home" aria-hidden="true" />
    </div>
  );
}

export function TabBar({ active }: { active: string }) {
  const tabs = ['자산', '연결', '지출', '내정보'];
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div key={t} className={t === active ? 'on' : undefined}>
          {t}
        </div>
      ))}
    </div>
  );
}
