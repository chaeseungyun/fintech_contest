// 실행 안내. 판단이 끝난 뒤 "그래서 무엇을 어떤 순서로 하면 되는가" 를 낸다.
// 여기서 새로 계산하는 값은 없다 — 안전 시점·회복 시점·갈아타기 결과·중도해지 손실을
// 이미 나온 값 그대로 받아 순서로 엮을 뿐이다. 그래서 순수 함수로 남는다.
//
// 이 화면은 해지를 대신 실행하지 않는다. 어디에 무엇을 언제 신청하는지, 창구에서 무엇을
// 확인해야 하는지를 적는다. 연락처는 상품 데이터(contact)에서만 온다 — 번호를 지어내지 않는다.
//
// 안내하는 절차는 판정과 무관하게 해지(변경) 절차 하나다. 유지에는 절차가 없다 — 그대로 두면
// 된다. 판정이 keep 이면 머리글에 "지금은 유지가 유리하다" 를 적고, 그래도 바꿔야 할 때
// 손해를 가장 줄이는 순서를 낸다.

import { formatKoMD, formatKoYMD, formatWonShort, withJosa } from './format';
import type { SafeTiming } from './interpreter';
import type { EarlyTermination } from './money';
import type { CandidateResult } from './recommend';
import type { Contact, ISODate, Product, Source, Tagged, Trigger } from './types';

export type PlanKind = 'keep' | 'switch';

export interface ActionContact {
  institution: string;
  dept: string;
  channels: string[];
  hours: string;
  /** 가상 브랜드라 데모 데이터에는 비어 있다. 화면이 "공식 채널에서 확인" 으로 그린다 */
  tel: string | null;
  /** 창구에서 반드시 물어볼 것 */
  ask: string[];
}

export interface ActionStep {
  key: string;
  /** "새 카드를 먼저 발급합니다" */
  title: string;
  detail: string;
  /** 제목 아래 붙는 목록. 없으면 빈 배열 */
  bullets: string[];
  /** "9월 30일 이후" — 기한이 없으면 null */
  whenLabel: string | null;
  when: Tagged<ISODate> | null;
  contact: ActionContact | null;
  source: Source;
}

export interface ActionPlan {
  kind: PlanKind;
  title: string;
  summary: string;
  steps: ActionStep[];
  notes: string[];
  /** 대표번호가 비어 있는 창구가 하나라도 있는가 */
  telMissing: boolean;
}

/** 회복 불가 조건 한 줄. derive 가 ImpactItem 에서 만들어 넘긴다 */
export interface PlanLink {
  productName: string;
  recoverAt: ISODate | null;
}

export interface ActionPlanInput {
  kind: PlanKind;
  trigger: Trigger;
  center: Product;
  timing: SafeTiming;
  /** 갈아타기 추천 1순위. 없으면 null */
  best: CandidateResult | null;
  /** 되돌릴 수 없는 항목 */
  unrecoverable: PlanLink[];
  earlyTermination: EarlyTermination | null;
}

export function toContact(institution: string, contact: Contact | undefined): ActionContact | null {
  if (!contact) return null;
  return {
    institution,
    dept: contact.dept,
    channels: contact.channels,
    hours: contact.hours,
    tel: contact.tel ?? null,
    ask: contact.ask ?? [],
  };
}

const shortOf = (p: { shortName?: string; name: string }) => p.shortName ?? p.name;

export function buildActionPlan(input: ActionPlanInput): ActionPlan {
  const steps = switchSteps(input);
  const name = shortOf(input.center);
  const verb = input.trigger.verb;

  const notes = [
    '이 안내는 약관에서 추출한 조건과 보유 상품 정보로 만든 순서입니다. 실제 처리 기준과 소요 기간은 각 금융사 약관을 따릅니다.',
  ];
  if (input.trigger.caveat) notes.push(input.trigger.caveat);

  const telMissing = steps.some((s) => s.contact !== null && s.contact.tel === null);
  if (telMissing) {
    notes.push(
      '대표번호는 데모 데이터에 넣지 않았습니다. 각 금융사 공식 앱·홈페이지에 안내된 번호를 확인하세요.',
    );
  }

  return {
    kind: input.kind,
    title: `${name} ${verb} 절차`,
    summary:
      input.kind === 'keep'
        ? `지금은 유지하는 쪽이 유리합니다. 그래도 ${verb}해야 한다면 손해를 가장 줄이는 순서입니다.`
        : switchSummary(input),
    steps,
    notes,
    telMissing,
  };
}

function switchSummary(input: ActionPlanInput): string {
  const verb = input.trigger.verb;
  const preserved = input.best?.preserved.length ?? 0;
  if (preserved > 0) {
    return `순서를 지키면 연결 ${preserved}건을 살린 채 ${verb}할 수 있습니다. 위에서부터 차례로 진행하세요.`;
  }
  return `${verb} 전에 확인할 것과 신청 절차입니다. 위에서부터 차례로 진행하세요.`;
}

// ── 절차 ──────────────────────────────────────────────────────────────

function switchSteps(input: ActionPlanInput): ActionStep[] {
  const { center, trigger, timing, best, unrecoverable, earlyTermination } = input;
  const name = shortOf(center);
  const steps: ActionStep[] = [];

  if (best) {
    const newName = shortOf(best.candidate);
    steps.push({
      key: 'new-first',
      title: `${withJosa(newName, '을/를')} 먼저 만듭니다`,
      detail:
        best.preserved.length > 0
          ? `순서를 바꾸면 연결 ${best.preserved.length}건이 먼저 끊깁니다. 새 상품이 있어야 실적이 이어집니다.`
          : `${withJosa(name, '을/를')} 정리하기 전에 대체 상품을 확보합니다.`,
      bullets: [],
      whenLabel: '지금',
      when: null,
      contact: toContact(best.candidate.institution, best.candidate.contact),
      source: best.netAfter.source,
    });

    if (best.preserved.length > 0) {
      steps.push({
        key: 'move-metrics',
        title: '실적을 새 상품으로 옮깁니다',
        detail: '자동납부와 결제계좌를 옮겨야 아래 조건이 그대로 인정됩니다.',
        bullets: best.preserved.map(
          (l) => `${l.product.shortName ?? l.product.name} — ${l.condition.sourceDoc}`,
        ),
        whenLabel: null,
        when: null,
        contact: null,
        source: 'doc',
      });
    }
  }

  if (!timing.alreadySafe) {
    steps.push({
      key: 'wait',
      title: `${formatKoMD(timing.safeAfter.value)}까지 기다립니다`,
      detail: `이번 달 판정이 ${formatKoMD(
        timing.safeAfter.value,
      )}에 끝납니다. 그 전에 실행하면 이번 달 혜택이 함께 빠집니다.`,
      bullets: [],
      whenLabel: `${formatKoMD(timing.safeFrom.value)}부터 안전`,
      when: timing.safeFrom,
      contact: null,
      source: timing.safeAfter.source,
    });
  }

  if (earlyTermination) {
    steps.push({
      key: 'early',
      title: '중도해지 이자 손실을 먼저 확인합니다',
      detail: `${earlyTermination.basisLabel} 기준으로 약 ${formatWonShort(
        earlyTermination.loss.value,
      )}의 이자를 덜 받습니다. 해지 시 한 번 확정되는 금액이라 연 단위 손익과 따로 봅니다.`,
      bullets: [],
      whenLabel: null,
      when: null,
      contact: null,
      source: earlyTermination.loss.source,
    });
  }

  steps.push({
    key: 'execute',
    title: `${withJosa(name, '을/를')} ${trigger.verb} 신청합니다`,
    detail: `${center.institution}에 직접 신청해야 합니다. 이 앱은 신청을 대신 처리하지 않습니다.`,
    bullets: [],
    whenLabel: timing.alreadySafe ? '지금 가능' : `${formatKoMD(timing.safeFrom.value)} 이후`,
    when: timing.alreadySafe ? null : timing.safeFrom,
    contact: toContact(center.institution, center.contact),
    source: 'holding',
  });

  if (unrecoverable.length > 0) {
    steps.push({
      key: 'unrecoverable',
      title: '되돌릴 수 없는 항목을 확인합니다',
      detail: '가입 시점에 확정된 우대라 다시 가입해도 만기 전에는 복구되지 않습니다.',
      bullets: unrecoverable.map(
        (l) => `${l.productName} — ${l.recoverAt ? `${formatKoYMD(l.recoverAt)}까지` : '복구 불가'}`,
      ),
      whenLabel: null,
      when: null,
      contact: null,
      source: 'holding',
    });
  }

  return steps;
}
