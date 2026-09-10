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

export interface ProductFacts {
  balance?: number;
  remainingMonths?: number;
  repaymentType?: string;
  baseRate?: number;
  appliedRate?: number;
  monthlySpendCurrent?: number;
  annualFee?: number;
  activeCount?: number;
  principal?: number;
  openedAt?: ISODate;
  maturity?: ISODate;
}

export interface Product {
  id: string;
  institution: string;
  name: string;
  shortName?: string;
  type: 'deposit_account' | 'loan' | 'credit_card' | 'autopay' | 'term_deposit';
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

export interface Scenario {
  meta: { scenarioId: string; today: ISODate; timezone: string; note?: string };
  trigger: { productId: string; action: string; label: string };
  products: Product[];
  conditions: Condition[];
  /** 테스트 검증용. 화면에서 읽지 않는다. */
  expected?: unknown;
}
