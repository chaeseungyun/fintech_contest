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
  /** 중도해지이율. 약정이율 대신 이 이율이 예치기간에 적용된다 */
  earlyTerminationRate?: number;
  /** 카드 뒷자리 등 표시용 식별자 */
  last4?: string;
  /** 보험 보장 요약 */
  coverage?: string;
}

/**
 * 실행 안내에 쓰는 창구 정보. 가상 브랜드라 대표번호는 넣지 않는다 —
 * tel 이 비어 있으면 화면이 "각 사 공식 채널에서 확인" 으로 그린다.
 */
export interface Contact {
  dept: string;
  /** "영업점 창구", "앱 > 카드 > 해지" 처럼 실제로 밟는 경로 */
  channels: string[];
  hours: string;
  tel?: string;
  /** 창구에서 반드시 물어볼 것 */
  ask?: string[];
}

export interface Product {
  id: string;
  institution: string;
  name: string;
  shortName?: string;
  type: ProductType;
  facts: ProductFacts;
  contact?: Contact;
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

/** FinStay AI 의 분석 진입점 하나 */
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

/**
 * 갈아탈 후보 상품. 파이프라인(약관 추출)이 채우는 형태를 그대로 둔다 — 화면은 이 구조만 읽는다.
 * 보유 상품이 아니므로 facts 의 출처는 'holding' 이 아니라 'doc'(상품설명서) 이다.
 */
export interface Candidate {
  id: string;
  /**
   * replace — 변경 대상을 대신할 후보(갈아타기). forTriggers 로 묶인다.
   * add     — 보유 상품을 그대로 두고 더하는 후보(연계 가입). 트리거와 무관하게 상시 평가한다.
   * 없으면 replace.
   */
  mode?: CandidateMode;
  /** 어느 트리거의 대안인가. mode 가 add 면 비워 둔다 */
  forTriggers: string[];
  institution: string;
  name: string;
  shortName?: string;
  type: ProductType;
  /** 상품설명서에서 옮긴 사실. 연회비·보험료 등 비용은 트리거의 savings[].kind 로 읽는다 */
  facts: ProductFacts;
  sourceDoc: string;
  /** 이 상품이 기존 조건의 target 역할을 대신할 수 있는가 */
  satisfies: CandidateSatisfies;
  /** 후보 자체의 혜택. 기존 effect 형태를 재사용한다 */
  ownBenefits: OwnBenefit[];
  eligibility?: Eligibility;
  contact?: Contact;
}

export type CandidateMode = 'replace' | 'add';

export const candidateMode = (c: Candidate): CandidateMode => c.mode ?? 'replace';

/**
 * 후보가 유지시키는 실적 종류(metric.kind). "당행 신용카드" 같은 범위 문장을 파이프라인이
 * 해석해 넣는다. 못 옮기면 UNSUPPORTED — 계산은 아무것도 유지되지 않는다고 보수적으로 본다.
 */
export interface CandidateSatisfies {
  status: 'MAPPED' | 'UNSUPPORTED';
  kinds: string[];
  sourceText: string;
  unsupportedReason?: string;
  confidence: number;
}

export interface OwnBenefit {
  label: string;
  effect: Effect;
  sourceText: string;
  confidence: number;
}

/** 가입 자격. met 이 false 면 추천하지 않는다. UNSUPPORTED 면 "확인 필요"로 표시만 한다 */
export interface Eligibility {
  status: 'MAPPED' | 'UNSUPPORTED';
  sourceText: string;
  met?: boolean;
  unsupportedReason?: string;
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
  /** 갈아탈 후보. 없으면 추천 카드가 뜨지 않는다 */
  candidates?: Candidate[];
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

/** 이 트리거를 대신할 후보(replace). 등록 순서를 유지한다 — 정렬은 recommend 가 한다. */
export function candidatesFor(scenario: Scenario, triggerId: string): Candidate[] {
  return (scenario.candidates ?? [])
    .filter((c) => candidateMode(c) === 'replace')
    .filter((c) => c.forTriggers.includes(triggerId));
}

/** 보유 상품에 더할 후보(add). 트리거와 무관하다 — 상시 제안이다. */
export function addonCandidates(scenario: Scenario): Candidate[] {
  return (scenario.candidates ?? []).filter((c) => candidateMode(c) === 'add');
}
