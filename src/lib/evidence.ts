// 화면 4의 값 목록. 각 항목이 출처 태그와 수정 가능 여부를 함께 들고 온다.
// 화면은 이 배열을 순회해 그리기만 한다.

import type { ImpactItem } from './derive';
import { formatKoYMD, formatWon } from './format';
import { metricNoun } from './interpreter';
import { formatRateDelta, principalLabel } from './money';
import type { Product, Tagged } from './types';
import { tag } from './types';

export type EditKind = 'effect' | 'cycle' | 'threshold';

export interface EditSpec {
  kind: EditKind;
  /** 입력창에 보일 숫자 */
  raw: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface EvidenceField {
  key: string;
  label: string;
  display: Tagged<string>;
  edit?: EditSpec;
  /** 값 아래 작은 설명 */
  note?: string;
}

const CYCLE_EDITABLE = new Set(['RECUR', 'COUNT']);

export function evidenceFields(item: ImpactItem, target: Product): EvidenceField[] {
  const { condition, product, loss, judgment, effectiveLoss } = item;
  const effect = loss.effect;
  const fields: EvidenceField[] = [];

  // 감면 폭
  if (effect.value.kind === 'rate_delta') {
    fields.push({
      key: 'effect',
      label: '감면 폭',
      display: tag(formatRateDelta(effect.value.value), effect.source),
      edit: { kind: 'effect', raw: Math.abs(effect.value.value) * 100, unit: '%p', min: 0, max: 20, step: 0.05 },
    });
  } else {
    fields.push({
      key: 'effect',
      label: '월 혜택',
      display: tag(`월 ${formatWon(effect.value.value)}`, effect.source),
      edit: { kind: 'effect', raw: effect.value.value, unit: '원', min: 0, step: 1000 },
    });
  }

  // 판정 주기
  const cycleField: EvidenceField = { key: 'cycle', label: '확인 주기', display: judgment.cycleLabel };
  if (CYCLE_EDITABLE.has(condition.expr.op)) {
    const dom =
      condition.expr.op === 'RECUR'
        ? condition.expr.params.from?.dayOfMonth
        : condition.expr.params.checkOn?.dayOfMonth;
    if (dom !== undefined) cycleField.edit = { kind: 'cycle', raw: dom, unit: '일', min: 1, max: 31, step: 1 };
  }
  fields.push(cycleField);

  // 실적 기준
  const metric = condition.metric;
  const unit = metric.kind === 'autopay_count' ? '건' : '원';
  if (metric.threshold !== null) {
    const prov = condition.provenance?.threshold ?? 'doc';
    fields.push({
      key: 'threshold',
      label: '실적 기준',
      display: tag(
        unit === '원' ? `월 ${formatWon(metric.threshold)}` : `${metric.threshold}${unit}`,
        prov,
      ),
      edit: { kind: 'threshold', raw: metric.threshold, unit, min: 0, step: unit === '원' ? 10000 : 1 },
      note: `${metricNoun(metric.kind)} 기준`,
    });
  }
  if (metric.currentValue !== undefined) {
    fields.push({
      key: 'current',
      label: '현재 실적',
      display: tag(
        unit === '원' ? `월 ${formatWon(metric.currentValue)}` : `${metric.currentValue}${unit}`,
        'holding',
      ),
      note: judgment.inactiveReason ?? undefined,
    });
  }

  // 걸린 상품 — binds.target. 연쇄가 어디서 나왔는지 드러나는 자리
  fields.push({ key: 'target', label: '걸린 상품', display: tag(target.name, 'doc') });

  // 원금
  if (loss.principal) {
    fields.push({
      key: 'principal',
      label: principalLabel(product),
      display: tag(formatWon(loss.principal.value), loss.principal.source),
    });
  }

  // 판정일 / 회복 시점
  if (judgment.nextJudgmentDate.value !== null) {
    fields.push({
      key: 'next',
      label: '다음 우대 확인일',
      display: tag(formatKoYMD(judgment.nextJudgmentDate.value), judgment.nextJudgmentDate.source),
    });
  } else if (judgment.recoverAt) {
    fields.push({
      key: 'recoverAt',
      label: '회복 시점',
      display: tag(`만기 ${formatKoYMD(judgment.recoverAt.value)}`, judgment.recoverAt.source),
      note: '매달 확인 없음 · 만기까지 고정',
    });
  }

  // 연간 손실
  fields.push({
    key: 'loss',
    label: '연간 손실',
    display: tag(formatWon(effectiveLoss.value), effectiveLoss.source),
    note: !judgment.active
      ? `실적 미충족이라 현재도 미적용 (충족 시 ${formatWon(loss.annualLoss.value)})`
      : loss.periodNote ?? undefined,
  });

  return fields;
}

/** 입력창의 숫자를 저장용 값으로 바꾼다. */
export function toEditValue(item: ImpactItem, kind: EditKind, raw: number): number {
  if (kind === 'effect' && item.loss.effect.value.kind === 'rate_delta') {
    const sign = Math.sign(item.loss.effect.value.value) || -1;
    return (sign * raw) / 100;
  }
  return raw;
}
