// 홈·자산 탭이 읽는 보유 현황. products 배열 하나에서 전부 집계한다.

import type { Product, Scenario, Tagged } from './types';
import { ASSET_TYPES, tag } from './types';

export interface AssetGroup {
  key: string;
  label: string;
  products: Product[];
  amount: Tagged<number>;
}

/** 상품 종류별 잔액. 예금은 principal, 나머지는 balance. 금액이 없으면 0. */
export function amountOf(product: Product): number {
  return product.facts.balance ?? product.facts.principal ?? 0;
}

const GROUPS: { key: string; label: string; types: Product['type'][] }[] = [
  { key: 'deposit', label: '입출금·예적금', types: ['deposit_account', 'savings', 'term_deposit'] },
  { key: 'invest', label: '투자', types: ['investment'] },
  { key: 'card', label: '카드', types: ['credit_card'] },
  { key: 'loan', label: '대출', types: ['loan'] },
  { key: 'insurance', label: '보험', types: ['insurance'] },
  { key: 'autopay', label: '자동이체', types: ['autopay'] },
];

export function assetGroups(scenario: Scenario): AssetGroup[] {
  return GROUPS.map((g) => {
    const products = scenario.products.filter((p) => g.types.includes(p.type));
    return {
      key: g.key,
      label: g.label,
      products,
      amount: tag(products.reduce((sum, p) => sum + amountOf(p), 0), 'calc'),
    };
  }).filter((g) => g.products.length > 0);
}

/** 총 자산 = 예금·적금·투자 잔액 합계. 대출은 빼지 않는다(부채는 따로 보여준다). */
export function totalAssets(scenario: Scenario): Tagged<number> {
  const sum = scenario.products
    .filter((p) => ASSET_TYPES.includes(p.type))
    .reduce((acc, p) => acc + amountOf(p), 0);
  return tag(sum, 'calc');
}

export function totalDebt(scenario: Scenario): Tagged<number> {
  const sum = scenario.products
    .filter((p) => p.type === 'loan')
    .reduce((acc, p) => acc + amountOf(p), 0);
  return tag(sum, 'calc');
}
