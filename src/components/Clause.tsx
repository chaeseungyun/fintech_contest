import type { Condition } from '../lib/types';
import { Highlight } from './Highlight';

/**
 * 약관 원문 블록. "약관에서 뽑았다" 를 눈으로 보여주는 자리라 크게 쓴다.
 * 결과 상세·근거·관계도가 같은 컴포넌트를 쓴다 — 추출 구간(spans)에 형광 면, 아래에 제외 항목.
 */
export function Clause({ condition }: { condition: Condition }) {
  const meta = [condition.exclude && condition.exclude.length > 0 && `제외 · ${condition.exclude.join(', ')}`].filter(
    Boolean,
  );
  return (
    <div className="clause">
      <span className="doc">{condition.sourceDoc}</span>
      <p>
        “<Highlight text={condition.sourceText} spans={condition.spans} />”
      </p>
      {meta.length > 0 && <span className="meta">{meta.join('  |  ')}</span>}
    </div>
  );
}
