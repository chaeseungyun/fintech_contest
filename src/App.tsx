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
      return <Hub />;
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { scenario, derived } = useMemo(() => select(state), [state]);
  const store = useMemo(() => ({ state, scenario, derived, dispatch }), [state, scenario, derived]);
  const route = currentRoute(state);

  return (
    <StoreContext.Provider value={store}>
      <div className="stage">
        <div className="phone" key={route ? route.name : state.tab}>
          {screenFor(state)}
        </div>
      </div>
    </StoreContext.Provider>
  );
}
