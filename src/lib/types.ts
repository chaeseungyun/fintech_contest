// scenario.json 의 형태와 화면 전반에서 쓰는 공통 타입.

export type ISODate = string; // 'YYYY-MM-DD'

export type Op = 'RECUR' | 'ROLLING' | 'COUNT' | 'PERMANENT';

/** 출처 태그. 값과 같은 객체에 담긴다. */
export type Source = 'doc' | 'calc' | 'holding' | 'user';

export interface Tagged<T> {
  value: T;
  source: Source;
}

export const tag = <T>(value: T, source: Source): Tagged<T> => ({ value, source });

export type ProductType =
  | 'deposit_account'
  | 'savings'
  | 'term_deposit'
  | 'investment'
  | 'loan'
  | 'credit_card'
  | 'insurance'
  | 'autopay';

/** 홈·자산 탭에서 자산 합계에 들어가는 상품 종류 */
export const ASSET_TYPES: ProductType[] = ['deposit_account', 'savings', 'term_deposit', 'investment'];

export interface ProductFacts {
  balance?: number;
  remainingMonths?: number;
  repaymentType?: string;
  baseRate?: number;
  appliedRate?: number;
  monthlySpendCurrent?: number;
  annualFee?: number;
  monthlyPremium?: number;
  activeCount?: number;
  principal?: number;
  openedAt?: ISODate;
  maturity?: ISODate;
  /** 카드 뒷자리 등 표시용 식별자 */
  last4?: string;
  /** 보험 보장 요약 */
  coverage?: string;
}

export interface Product {
  id: string;
  institution: string;
  name: string;
  shortName?: string;
  type: ProductType;
  facts: ProductFacts;
}

export interface Span {
  field: string;
  start: number;
  end: number;
}

export interface Effect {
  kind: 'rate_delta' | 'monthly_benefit';
  value: number;
}

export interface Binds {
  holder: string;
  target: string;
  effect: Effect;
}

export interface Anchor {
  anchor: string;
  dayOfMonth?: number;
}

export interface ExprParams {
  every?: string;
  window?: string;
  metric?: string;
  threshold?: number;
  n?: number;
  of?: string;
  from?: Anchor;
  checkOn?: Anchor;
  settleOn?: Anchor;
  fixedAt?: Anchor;
  until?: Anchor;
}

export interface Expr {
  op: Op;
  params: ExprParams;
}

export interface Metric {
  kind: string;
  threshold: number | null;
  period?: string;
  currentValue?: number;
  source: string;
}

/** 조건 안의 값이 어디서 왔는지. 사용자가 수정하면 'user'로 바뀐다. */
export interface Provenance {
  effect: Source;
  cycle: Source;
  threshold: Source;
}

export interface Condition {
  id: string;
  sourceDoc: string;
  sourceText: string;
  spans?: Span[];
  status: 'MAPPED' | 'UNSUPPORTED';
  unsupportedReason?: string;
  expr: Expr | null;
  metric?: Metric;
  binds: Binds | null;
  exclude?: string[];
  confidence: number;
  provenance?: Provenance;
}

export interface MappedCondition extends Condition {
  status: 'MAPPED';
  expr: Expr;
  metric: Metric;
  binds: Binds;
}

export const isMapped = (c: Condition): c is MappedCondition =>
  c.status === 'MAPPED' && c.expr !== null && c.binds !== null && c.metric !== undefined;

/**
 * 변경을 실행했을 때 없어지는 비용 = 절감.
 * 금액은 대상 상품의 facts 에서 읽는다 — 화면이나 JSON 에 숫자를 따로 적지 않는다.
 */
export type SavingKind = 'annual_fee' | 'monthly_premium';

export interface Saving {
  kind: SavingKind;
  label: string;
  note: string;
}

/** 화면에서 쓰는 아이콘 키. 실제 그림은 components/Glyph 가 그린다. */
export type IconKey =
  | 'account'
  | 'card'
  | 'loan'
  | 'invest'
  | 'insurance'
  | 'benefit'
  | 'ai'
  | 'grid'
  | 'deposit'
  | 'autopay';

/** SwitchPoint AI 의 분석 진입점 하나 */
export interface Trigger {
  id: string;
  productId: string;
  action: string;
  /** 리스트 제목: "카드 해지/변경" */
  label: string;
  /** 리스트 설명: "연회비, 혜택, 연결된 우대조건" */
  sublabel: string;
  icon: IconKey;
  /** 관계도 중앙 노드 문구: "카드 해지/변경" */
  nodeLabel: string;
  /** 문장에 쓰는 동사: "해지", "변경" */
  verb: string;
  /** 변경 후에도 금액으로 계산하지 않는 것 (보장 상실 등) */
  caveat?: string;
  savings: Saving[];
}

export interface HomeSpendPoint {
  month: string;
  amount: number;
}

export interface HomeData {
  userName: string;
  greeting: string;
  /** 최근 소비 추이. 마지막 원소가 이번 달 */
  spend: HomeSpendPoint[];
  quickMenu: { key: IconKey; label: string; tab?: string }[];
  bannerTitle: string;
  bannerBody: string;
}

export interface Brand {
  group: string;
  short: string;
  service: string;
  serviceTagline: string;
}

export interface Scenario {
  meta: { scenarioId: string; today: ISODate; timezone: string; note?: string };
  brand: Brand;
  home: HomeData;
  triggers: Trigger[];
  defaultTriggerId: string;
  products: Product[];
  conditions: Condition[];
  /** 테스트 검증용. 화면에서 읽지 않는다. */
  expected?: unknown;
}

export function triggerById(scenario: Scenario, id: string): Trigger {
  const t = scenario.triggers.find((x) => x.id === id);
  if (!t) throw new Error(`trigger ${id} 를 찾을 수 없다`);
  return t;
}

export function defaultTrigger(scenario: Scenario): Trigger {
  return triggerById(scenario, scenario.defaultTriggerId);
}
