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
  /** 카드 기본 적립·할인율 (0.007 = 0.7%) */
  rewardRate?: number;
  /** 매달 나가는 금액 (관리비 등 납부 항목) */
  monthlyAmount?: number;
  /** 우대금리 합계 상한 (0.01 = 1.0%p). 있으면 이 대출에 걸린 우대는 묶어서 상한까지만 계산한다 */
  preferentialCap?: number;
  /** 다른 보유 상품과 연결되지 않은 우대(신용등급 등). 상한 계산에만 들어간다 */
  fixedPreferential?: number;
  /** 지금 이 항목을 결제하는 카드. 결제 수단을 바꾸면 이 카드의 이용금액이 그만큼 준다 */
  paidBy?: string;
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

/**
 * rate_delta      원금 × |금리차|
 * monthly_benefit 월 금액 × 12
 * spend_rate      결제액 × 적립률 × 12. 결제액은 target 상품의 facts.monthlyAmount (관리비 카드 적립 등)
 */
export interface Effect {
  kind: 'rate_delta' | 'monthly_benefit' | 'spend_rate';
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
export type SavingKind = 'annual_fee' | 'monthly_premium' | 'rate_gain' | 'reward_diff' | 'new_card_fee';

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
  /** 리스트 제목: "카드 해지/변경". question 이 있으면 허브에서는 보조 줄로 내려간다 */
  label: string;
  /** 허브 행 제목 — 사용자가 스스로 할 질문: "톡톡카드를 해지하면 대출 이자가 늘까요?" */
  question?: string;
  /** 허브 맨 위에 따로 크게 두는 사례(관리비 계좌 납부). 배지 없이 자리만 먼저다 */
  featured?: boolean;
  icon: IconKey;
  /** 문장에 쓰는 동사: "해지", "변경" */
  verb: string;
  /** 변경 후에도 금액으로 계산하지 않는 것 (보장 상실 등) */
  caveat?: string;
  /**
   * 비교에 빠진 핵심 입력(새 대출 적용금리 등). 하나라도 있으면 전체 유불리를 판정하지 않고
   * "확인된 항목의 변화 소계" 만 낸다 — 반대편 숫자 없이 결론을 내지 않는다.
   */
  missing?: string[];
  savings: Saving[];
  /**
   * 변경 후 새로 충족되는 조건 id. 지금은 미적용이고, 바꾸면 켜진다(관리비 계좌 납부 → 대출 자동납부 우대).
   * 원금 × |금리차| 가 절감(①)에 "월마다 쌓이는" 항목으로 들어간다.
   */
  gains?: string[];
  /**
   * 이 변경으로 카드 이용금액이 옮겨 간다. 그 카드의 card_spend 조건을 옮긴 뒤 금액으로 다시 판정한다.
   * amountFrom 상품의 facts.monthlyAmount 만큼 cardId 카드에서 빠진다.
   */
  spendShift?: { cardId: string; amountFrom: string };
  /**
   * 대상 카드를 해지하지 않고 사용액 일부를 다른 카드로 옮긴다(나눠 쓰기). 걸린 조건은 사용액으로만 다시 판정하고,
   * 얼마를 남길지·어느 카드로 옮길지는 사용자가 고른다(store.split). 옮겨 갈 카드를 고르기 전에는 보류다.
   */
  split?: boolean;
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

export interface HomeData {
  userName: string;
  /** label 이 없으면 brand.service 를 쓴다 (`ai` 항목) */
  quickMenu: { key: IconKey; label?: string; tab?: string }[];
  bannerTitle: string;
  /** 홈 배너 둘째 줄 — 기능 설명이 아니라 사용자의 질문. 없으면 brand.serviceTagline */
  bannerQuestion?: string;
}

export interface Brand {
  short: string;
  service: string;
  serviceTagline: string;
  /** 이 기능이 들어가 있는 은행. 홈 상단은 은행, 내부 배너는 서비스명이다 */
  bank: string;
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
  /** 용어 풀이. 키는 화면에 나오는 용어 그대로, 값은 쉬운 말 한두 문장 (Term 컴포넌트) */
  glossary?: Record<string, string>;
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
