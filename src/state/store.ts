// 단일 상태 객체. 모든 화면이 여기서 읽는다.
// 저장되는 것은 "기본 시나리오 + 사용자 수정 + 화면 위치" 뿐이고,
// 금액·날짜는 매 렌더마다 lib/derive 로 다시 계산한다. localStorage 없음.

import { createContext, useContext } from 'react';
import fixture from '../fixtures/scenario.json';
import { derive, type Derived } from '../lib/derive';
import { applyEdits, type ConditionEdit, type Edits } from '../lib/edits';
import type { Scenario } from '../lib/types';

export const BASE_SCENARIO = fixture as unknown as Scenario;

/** 하단 탭바. 홈이 기본 */
export type Tab = 'home' | 'assets' | 'benefits' | 'more';

export const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'assets', label: '자산', icon: 'invest' },
  { id: 'benefits', label: '혜택', icon: 'benefit' },
  { id: 'more', label: '전체', icon: 'grid' },
];

/** 탭 위에 쌓이는 화면. 뒤로가기는 이 스택을 하나씩 걷어낸다. */
export type Route =
  | { name: 'hub' }
  | { name: 'analyzing'; triggerId: string }
  | { name: 'impact'; triggerId: string }
  | { name: 'verdict'; triggerId: string }
  | { name: 'actionplan'; triggerId: string }
  | { name: 'timeline'; triggerId: string }
  | { name: 'connections'; triggerId: string }
  | { name: 'evidence'; triggerId: string; productId: string };

export interface AppState {
  edits: Edits;
  /** 삭제된 조건 id (관계도 선이 줄어드는지 보는 용도) */
  removed: string[];
  tab: Tab;
  stack: Route[];
  /** 관계도에서 누른 선 */
  selectedConditionId: string | null;
  /** 화면 3에서 펼친 상세 항목 */
  expandedConditionId: string | null;
  /** 최종 판단 화면의 갈아타기 후보 중 펼친 것 */
  expandedCandidateId: string | null;
  /** 펼친 창구 정보(ContactSheet). 실행 안내 단계·추천/제안 후보 행이 같은 키 공간을 쓴다 */
  expandedStepKey: string | null;
}

export type Action =
  | { type: 'selectTab'; tab: Tab }
  | { type: 'push'; route: Route }
  | { type: 'replace'; route: Route }
  | { type: 'back' }
  | { type: 'popTo'; name: Route['name'] }
  | { type: 'selectCondition'; conditionId: string | null }
  | { type: 'toggleExpanded'; conditionId: string }
  | { type: 'toggleCandidate'; candidateId: string }
  | { type: 'edit'; conditionId: string; edit: ConditionEdit }
  | { type: 'removeCondition'; conditionId: string }
  | { type: 'toggleStep'; stepKey: string }
  | { type: 'reset' };

export function initialState(): AppState {
  return {
    edits: {},
    removed: [],
    tab: 'home',
    stack: [],
    selectedConditionId: null,
    expandedConditionId: null,
    expandedCandidateId: null,
    expandedStepKey: null,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'selectTab':
      return { ...state, tab: action.tab, stack: [], selectedConditionId: null };
    case 'push':
      return { ...state, stack: [...state.stack, action.route], expandedStepKey: null };
    case 'replace':
      return { ...state, stack: [...state.stack.slice(0, -1), action.route], expandedStepKey: null };
    case 'back':
      return { ...state, stack: state.stack.slice(0, -1), selectedConditionId: null };
    case 'popTo': {
      const i = state.stack.findIndex((r) => r.name === action.name);
      return i < 0 ? state : { ...state, stack: state.stack.slice(0, i + 1) };
    }
    case 'selectCondition':
      return { ...state, selectedConditionId: action.conditionId };
    case 'toggleExpanded':
      return {
        ...state,
        expandedConditionId: state.expandedConditionId === action.conditionId ? null : action.conditionId,
      };
    case 'toggleCandidate':
      return {
        ...state,
        expandedCandidateId: state.expandedCandidateId === action.candidateId ? null : action.candidateId,
        expandedStepKey: null,
      };
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
    case 'toggleStep':
      return { ...state, expandedStepKey: state.expandedStepKey === action.stepKey ? null : action.stepKey };
    case 'reset':
      return initialState();
  }
}

export const currentRoute = (state: AppState): Route | null =>
  state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;

/** 지금 화면이 다루고 있는 트리거. 스택이 비어 있으면 기본 트리거. */
export function activeTriggerId(state: AppState, scenario: Scenario): string {
  for (let i = state.stack.length - 1; i >= 0; i -= 1) {
    const r = state.stack[i];
    if ('triggerId' in r) return r.triggerId;
  }
  return scenario.defaultTriggerId;
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
  return { scenario, derived: derive(scenario, activeTriggerId(state, scenario)) };
}
