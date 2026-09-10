// 단일 상태 객체. 네 화면이 전부 여기서 읽는다.
// 저장되는 것은 "기본 시나리오 + 사용자 수정 + 화면 위치" 뿐이고,
// 금액·날짜는 매 렌더마다 lib/derive 로 다시 계산한다. localStorage 없음.

import { createContext, useContext } from 'react';
import fixture from '../fixtures/scenario.json';
import { derive, type Derived } from '../lib/derive';
import { applyEdits, type ConditionEdit, type Edits } from '../lib/edits';
import type { Scenario } from '../lib/types';

export const BASE_SCENARIO = fixture as unknown as Scenario;

export type Screen = 1 | 2 | 3 | 4;

export interface AppState {
  edits: Edits;
  /** 삭제된 조건 id (관계도 선이 줄어드는지 보는 용도) */
  removed: string[];
  screen: Screen;
  /** 화면 4에서 보고 있는 상품 */
  evidenceProductId: string;
  /** 화면 1에서 누른 선 */
  selectedConditionId: string | null;
  /** 데스크톱: 네 화면 나란히 */
  showAll: boolean;
}

export type Action =
  | { type: 'navigate'; screen: Screen }
  | { type: 'back' }
  | { type: 'selectCondition'; conditionId: string | null }
  | { type: 'showEvidence'; productId: string }
  | { type: 'edit'; conditionId: string; edit: ConditionEdit }
  | { type: 'removeCondition'; conditionId: string }
  | { type: 'toggleShowAll' }
  | { type: 'reset' };

export function initialState(): AppState {
  const first = derive(applyEdits(BASE_SCENARIO, {})).graph.satellites[0];
  return {
    edits: {},
    removed: [],
    screen: 1,
    evidenceProductId: first ? first.product.id : BASE_SCENARIO.trigger.productId,
    selectedConditionId: null,
    showAll: false,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'navigate':
      return { ...state, screen: action.screen };
    case 'back':
      return { ...state, screen: state.screen > 1 ? ((state.screen - 1) as Screen) : 1 };
    case 'selectCondition':
      return { ...state, selectedConditionId: action.conditionId };
    case 'showEvidence':
      return { ...state, evidenceProductId: action.productId, screen: 4 };
    case 'edit':
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.conditionId]: { ...state.edits[action.conditionId], ...action.edit },
        },
      };
    case 'removeCondition':
      return state.removed.includes(action.conditionId)
        ? state
        : { ...state, removed: [...state.removed, action.conditionId] };
    case 'toggleShowAll':
      return { ...state, showAll: !state.showAll };
    case 'reset':
      return { ...initialState(), showAll: state.showAll };
  }
}

export interface Store {
  state: AppState;
  scenario: Scenario;
  derived: Derived;
  dispatch: (a: Action) => void;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreContext 밖에서 useStore 를 호출했다');
  return s;
}

/** 상태 → 유효 시나리오 → 파생값. 화면 밖에서도(테스트) 쓸 수 있게 분리. */
export function select(state: AppState): { scenario: Scenario; derived: Derived } {
  const scenario = applyEdits(BASE_SCENARIO, state.edits, state.removed);
  return { scenario, derived: derive(scenario) };
}
