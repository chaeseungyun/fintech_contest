import type { Source } from '../lib/types';

export const SOURCE_LABEL: Record<Source, string> = {
  doc: '약관에서 추출',
  calc: '계산 결과',
  holding: '보유 상품 정보',
  user: '사용자 확인',
};

/** 출처 태그. source 값 하나로 색과 문구가 결정된다 — 화면에서 조건문으로 고르지 않는다. */
export function SourceTag({ source }: { source: Source }) {
  return <span className={`tag t-${source}`}>{SOURCE_LABEL[source]}</span>;
}
