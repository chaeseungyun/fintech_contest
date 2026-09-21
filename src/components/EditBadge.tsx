/** 사용자가 손댄 값이 있으면 그 수를 드러낸다. 0이면 아무것도 그리지 않는다. */
export function EditBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="tag t-user">사용자 수정 {count}건</span>;
}
