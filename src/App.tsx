import { useMemo, useReducer } from 'react';
import { ActionPlan } from './screens/ActionPlan';
import { Analyzing } from './screens/Analyzing';
import { Assets } from './screens/Assets';
import { Benefits } from './screens/Benefits';
import { Connections } from './screens/Connections';
import { Evidence } from './screens/Evidence';
import { Home } from './screens/Home';
import { Impact } from './screens/Impact';
import { More } from './screens/More';
import { Hub } from './screens/Hub';
import { Timeline } from './screens/Timeline';
import { Verdict } from './screens/Verdict';
import {
  currentRoute,
  initialState,
  reducer,
  select,
  StoreContext,
  type AppState,
  type Route,
  type Tab,
} from './state/store';

const TAB_SCREEN: Record<Tab, () => JSX.Element> = {
  home: Home,
  assets: Assets,
  benefits: Benefits,
  more: More,
};

function renderRoute(route: Route): JSX.Element {
  switch (route.name) {
    case 'hub':
      return <Hub />; // App 이 시트로 따로 그린다. 여기로는 오지 않는다
    case 'analyzing':
      return <Analyzing triggerId={route.triggerId} />;
    case 'impact':
      return <Impact triggerId={route.triggerId} />;
    case 'verdict':
      return <Verdict triggerId={route.triggerId} />;
    case 'actionplan':
      return <ActionPlan triggerId={route.triggerId} />;
    case 'timeline':
      return <Timeline />;
    case 'connections':
      return <Connections triggerId={route.triggerId} />;
    case 'evidence':
      return <Evidence triggerId={route.triggerId} productId={route.productId} />;
  }
}

function screenFor(state: AppState): JSX.Element {
  const route = currentRoute(state);
  if (route) return renderRoute(route);
  const Tabbed = TAB_SCREEN[state.tab];
  return <Tabbed />;
}

/** React 18 타입에 inert 가 없다. 빈 문자열이면 DOM 에 그대로 붙는다 — 시트 뒤 화면에 포커스가 가지 않게 */
const INERT = { inert: '' } as object;

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { scenario, derived } = useMemo(() => select(state), [state]);
  const store = useMemo(() => ({ state, scenario, derived, dispatch }), [state, scenario, derived]);
  // 허브는 바텀시트다 — 아래 화면을 언마운트하지 않고 그대로 비친다
  const sheet = currentRoute(state)?.name === 'hub';
  const base = sheet ? { ...state, stack: state.stack.slice(0, -1) } : state;
  const baseRoute = currentRoute(base);

  return (
    <StoreContext.Provider value={store}>
      <div className="stage">
        <div className="phone">
          <div className="screen" key={baseRoute ? baseRoute.name : base.tab} {...(sheet ? INERT : {})}>
            {screenFor(base)}
          </div>
          {sheet && <Hub />}
        </div>
      </div>
    </StoreContext.Provider>
  );
}
