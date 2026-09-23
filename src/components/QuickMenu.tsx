import { Glyph } from './Glyph';
import { useStore, type Tab } from '../state/store';

/**
 * 홈 퀵메뉴와 전체 탭 메뉴 그리드. 항목은 scenario.home.quickMenu 하나에서 온다 —
 * 두 화면이 각자 목록을 갖지 않는다. `ai` 항목의 이름은 brand.service 에서 읽는다.
 */
export function QuickMenu({ exclude = [] }: { exclude?: Tab[] }) {
  const { scenario, dispatch } = useStore();
  const items = scenario.home.quickMenu.filter((q) => !q.tab || !exclude.includes(q.tab as Tab));

  return (
    <div className="quickgrid">
      {items.map((q) => (
        <button
          key={q.key}
          type="button"
          className={q.key === 'ai' ? 'quick ai' : 'quick'}
          onClick={() =>
            q.tab
              ? dispatch({ type: 'selectTab', tab: q.tab as Tab, section: q.key })
              : dispatch({ type: 'push', route: { name: 'hub' } })
          }
        >
          <span className="ico">
            <Glyph name={q.key} size={23} />
          </span>
          <span className="qlabel">{q.label ?? scenario.brand.service}</span>
        </button>
      ))}
    </div>
  );
}
