// 실행 안내. 판단이 끝난 뒤 "그래서 무엇을 어떤 순서로 하면 되는가" 를 낸다.
// 여기서 새로 계산하는 값은 없다 — 안전 시점·회복 시점·갈아타기 결과·중도해지 손실을
// 이미 나온 값 그대로 받아 순서로 엮을 뿐이다. 그래서 순수 함수로 남는다.
//
// 이 화면은 해지를 대신 실행하지 않는다. 어디에 무엇을 언제 신청하는지, 창구에서 무엇을
// 확인해야 하는지를 적는다. 연락처는 상품 데이터(contact)에서만 온다 — 번호를 지어내지 않는다.
//
// 안내하는 절차는 판정과 무관하게 해지(변경) 절차 하나다. 유지에는 절차가 없다 — 그대로 두면
// 된다. 판정이 keep 이면 머리글에 "지금은 유지가 유리하다" 를 적고, 그래도 바꿔야 할 때
// 손해를 가장 줄이는 순서를 낸다. pending 이면 "전체 비교는 보류 중" 을 적는다.
//
// 대체 상품은 앱이 고른 best 가 아니라 **사용자가 고른 것**(chosen) 이다. 고르지 않았으면
// "새 상품 없이" 로 안내한다. 앱이 고른 후보를 기준으로 절차를 짜지 않는다.

import { formatKoMD, formatKoYMD, formatMD, formatWonShort, withJosa } from './format';
import type { SafeTiming } from './interpreter';
import type { EarlyTermination } from './money';
import type { CandidateResult } from './recommend';
import type { Contact, ISODate, Product, Source, Tagged, Trigger } from './types';

export type PlanKind = 'keep' | 'switch' | 'pending';

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
  /** "스마트카드 발급 가능 여부와 우대 인정 조건을 확인합니다" */
  title: string;
  detail: string;
  /** 제목 아래 붙는 목록. 없으면 빈 배열 */
  bullets: string[];
  /** "10월 1일부터 · 이번 달 판정 종료 후" — 기한이 없으면 null */
  whenLabel: string | null;
  when: Tagged<ISODate> | null;
  contact: ActionContact | null;
  source: Source;
}

export interface ActionPlan {
  kind: PlanKind;
  title: string;
  summary: string;
  /** 이 절차가 어느 안을 기준으로 하는가: "스마트카드로 갈아타기" / "새 상품 없이 해지" */
  basis: string;
  steps: ActionStep[];
  notes: string[];
  /** 대표번호가 비어 있는 창구가 하나라도 있는가 */
  telMissing: boolean;
}

/** 회복 불가 조건 한 줄. derive 가 ImpactItem 에서 만들어 넘긴다 */
export interface PlanLink {
  productName: string;
  /** "우대금리 0.25%p" — 어떤 혜택이 사라지는지 */
  perk: string;
  recoverAt: ISODate | null;
}

/** 이번 달 판정이 남은 항목 한 줄. 기다리는 단계에서 "그 뒤 확인할 것" 으로 적는다 */
export interface PlanDue {
  productName: string;
  date: ISODate;
}

export interface ActionPlanInput {
  kind: PlanKind;
  trigger: Trigger;
  center: Product;
  timing: SafeTiming;
  /** 사용자가 고른 대체 상품. 고르지 않았으면 null — "새 상품 없이" 로 안내한다 */
  chosen: CandidateResult | null;
  /** 되돌릴 수 없는 항목 */
  unrecoverable: PlanLink[];
  /** 이번 달 판정이 남은 항목 (안전 시점 계산에 들어간 것) */
  dueThisMonth: PlanDue[];
  /** 비교에 빠진 핵심 입력. 있으면 kind 가 pending */
  missing: string[];
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

/** 절차의 기준 안. 화면 머리글과 후보 행의 "선택됨" 표시가 같은 문구를 쓴다 */
export function planBasisLabel(chosen: CandidateResult | null, trigger: Trigger): string {
  return chosen ? `${withJosa(shortOf(chosen.candidate), '으로/로')} 갈아타기` : `새 상품 없이 ${trigger.verb}`;
}

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
    summary: summaryOf(input),
    basis: planBasisLabel(input.chosen, input.trigger),
    steps,
    notes,
    telMissing,
  };
}

function summaryOf(input: ActionPlanInput): string {
  const verb = input.trigger.verb;
  switch (input.kind) {
    case 'keep':
      return `확인된 조건에서는 유지하는 쪽이 유리합니다. 그래도 ${verb}해야 한다면 손해를 가장 줄이는 순서입니다.`;
    case 'pending':
      return `${input.missing.join('·')}이 확인되지 않아 전체 비교는 보류 중입니다. 그래도 ${verb}한다면 확인된 항목 기준으로 손해를 줄이는 순서입니다.`;
    case 'switch': {
      const preserved = input.chosen?.preserved.length ?? 0;
      if (preserved > 0) {
        return `순서를 지키면 연결 ${preserved}건을 살린 채 ${verb}할 수 있습니다. 위에서부터 차례로 진행하세요.`;
      }
      return `${verb} 전에 확인할 것과 신청 절차입니다. 위에서부터 차례로 진행하세요.`;
    }
  }
}

// ── 절차 ──────────────────────────────────────────────────────────────
// 순서의 핵심: 새 상품의 발급·인정 조건을 먼저 확인하고 → 이번 달 판정이 끝난 뒤 →
// 미확인·비가역 손실을 짚고 → 기존 상품을 정리한다. 경고는 해지 단계보다 앞에 온다.

function switchSteps(input: ActionPlanInput): ActionStep[] {
  const { center, trigger, timing, chosen, unrecoverable, dueThisMonth, missing, earlyTermination } = input;
  const name = shortOf(center);
  const steps: ActionStep[] = [];

  // 비교에 빠진 입력이 있으면 그것부터 — 미확인 항목의 경고는 해지 단계보다 앞에 온다
  if (missing.length > 0) {
    steps.push({
      key: 'missing',
      title: '확인되지 않은 입력을 먼저 채웁니다',
      detail: `아래 값이 없어 ${trigger.verb} 후 얻는 쪽을 계산하지 못했습니다. 확인되면 같은 기간으로 다시 비교합니다.`,
      bullets: missing,
      whenLabel: '지금',
      when: null,
      contact: null,
      source: 'holding',
    });
  }

  if (chosen) {
    const newName = shortOf(chosen.candidate);
    const bullets: string[] = [];
    if (chosen.eligibility !== 'ok') bullets.push('가입 자격이 약관에서 확정되지 않았습니다 — 발급 가능 여부를 먼저 확인');
    if (chosen.linkUnknown) bullets.push('우대 인정 여부가 약관에서 확정되지 않았습니다 — 인정 조건을 서면으로 확인');
    steps.push({
      key: 'new-first',
      title: `${newName} 발급 가능 여부와 우대 인정 조건을 확인합니다`,
      detail:
        chosen.preserved.length > 0
          ? `발급이 확인되면 먼저 만들고, 그다음 ${withJosa(name, '을/를')} 정리합니다. 순서를 바꾸면 연결 ${chosen.preserved.length}건이 먼저 끊깁니다.`
          : `발급이 확인되면 먼저 만들고, 그다음 ${withJosa(name, '을/를')} 정리합니다.`,
      bullets,
      whenLabel: '지금',
      when: null,
      contact: toContact(chosen.candidate.institution, chosen.candidate.contact),
      source: chosen.netAfter.source,
    });

    if (chosen.preserved.length > 0) {
      steps.push({
        key: 'move-metrics',
        title: '자동납부·결제계좌를 옮기고 인정 시점을 확인합니다',
        detail: '옮긴 실적이 언제부터 인정되는지 확인해야 아래 조건이 끊기지 않고 이어집니다.',
        bullets: chosen.preserved.map(
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
      detail: `이번 달 우대 확인이 ${formatKoMD(
        timing.safeAfter.value,
      )}에 끝나 이번 달 우대가 확정됩니다. 그 전에 실행하면 이번 달 혜택이 함께 빠집니다. 지난 뒤에는 아래 우대가 실제로 적용됐는지 확인하세요.`,
      bullets: dueThisMonth.map((d) => `${d.productName} — ${formatMD(d.date)} 확인 결과 우대가 적용됐는지`),
      whenLabel: `${formatKoMD(timing.safeFrom.value)}부터 · 이번 달 우대 확인 완료 후`,
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

  if (unrecoverable.length > 0) {
    steps.push({
      key: 'unrecoverable',
      title: `${trigger.verb}하면 되돌아오지 않는 우대를 확인합니다`,
      detail: `${withJosa(name, '을/를')} 보유한 조건으로 가입 때 확정된 우대라, ${withJosa(name, '을/를')} 다시 만들어도 만기 전에는 되돌아오지 않습니다. 이걸 감수할지 정한 뒤 다음 단계로 가세요.`,
      bullets: unrecoverable.map(
        (l) => `${l.productName}의 ${l.perk} — ${l.recoverAt ? `만기 ${formatKoYMD(l.recoverAt)}까지 이 우대 없이` : '만기 정보 없음'}`,
      ),
      whenLabel: null,
      when: null,
      contact: null,
      source: 'holding',
    });
  }

  steps.push({
    key: 'execute',
    title: `${withJosa(name, '을/를')} ${trigger.verb} 신청합니다`,
    detail: `${center.institution}에 직접 신청해야 합니다. 이 앱은 신청을 대신 처리하지 않습니다.`,
    bullets: [],
    whenLabel: timing.alreadySafe ? '지금 가능' : `${formatKoMD(timing.safeFrom.value)} 이후 · 우대 확인 완료 후`,
    when: timing.alreadySafe ? null : timing.safeFrom,
    contact: toContact(center.institution, center.contact),
    source: 'holding',
  });

  return steps;
}
