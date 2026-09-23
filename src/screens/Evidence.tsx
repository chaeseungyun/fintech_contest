import { useId, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Glyph } from '../components/Glyph';
import { Clause } from '../components/Clause';
import { SourceTag } from '../components/SourceTag';
import type { ImpactItem } from '../lib/derive';
import { evidenceFields, toEditValue, type EditKind, type EvidenceField } from '../lib/evidence';
import type { ConditionEdit } from '../lib/edits';
import { productById, unsupportedForDocs } from '../lib/graph';
import { BASE_SCENARIO, useStore } from '../state/store';

/** 수정 종류 → store.edits 에 저장되는 키 */
const EDIT_KEY: Record<EditKind, keyof ConditionEdit> = { effect: 'effectValue', cycle: 'dayOfMonth', threshold: 'threshold' };

interface Editing {
  conditionId: string;
  kind: EditKind;
  draft: string;
}

function FieldRow({
  field,
  item,
  editing,
  onStart,
  onChange,
  onCommit,
  onCancel,
  onRevert,
}: {
  field: EvidenceField;
  item: ImpactItem;
  editing: Editing | null;
  onStart: (kind: EditKind, raw: number) => void;
  onChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onRevert: () => void;
}) {
  const isEditing =
    editing !== null && editing.conditionId === item.condition.id && editing.kind === field.edit?.kind;
  const inputId = useId();

  return (
    <div className="f">
      <label className="k" htmlFor={inputId}>
        {field.label}
        {field.note && <span className="note">{field.note}</span>}
      </label>
      <span className="v">
        {isEditing && field.edit ? (
          <span className="editbox">
            <input
              id={inputId}
              type="number"
              autoFocus
              value={editing.draft}
              min={field.edit.min}
              max={field.edit.max}
              step={field.edit.step}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommit();
                if (e.key === 'Escape') onCancel();
              }}
            />
            <span className="unit">{field.edit.unit}</span>
            <button type="button" className="ok" onClick={onCommit}>
              확인
            </button>
            <button type="button" className="cancel" onClick={onCancel}>
              취소
            </button>
          </span>
        ) : (
          <>
            <span className="val">{field.display.value}</span>
            {field.edit && field.display.source === 'user' ? (
              <button type="button" className="edit" onClick={onRevert}>
                원래 값으로
              </button>
            ) : (
              field.edit && (
                <button type="button" className="edit" onClick={() => onStart(field.edit!.kind, field.edit!.raw)}>
                  수정
                </button>
              )
            )}
          </>
        )}
        <SourceTag source={field.display.source} />
      </span>
    </div>
  );
}

export function Evidence({ productId }: { triggerId: string; productId: string }) {
  const { state, scenario, derived: d, dispatch } = useStore();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [active, setActive] = useState(productId);

  const holders = d.graph.satellites.map((s) => s.product);
  const product = holders.find((p) => p.id === active) ?? holders[0];
  const items = product ? d.items.filter((i) => i.product.id === product.id) : [];
  // 이 트리거에서 "해당 없음" 으로 뺀 조건. 기본 시나리오에서 찾는다 — 유효 시나리오엔 이미 없고,
  // 마지막 조건을 빼면 그 상품 칩도 사라지므로 상품이 아니라 변경 대상 기준으로 모은다
  const removedHere = BASE_SCENARIO.conditions.filter(
    (c) => state.removed.includes(c.id) && c.binds?.target === d.center.id,
  );
  const unsupported = unsupportedForDocs(
    scenario,
    items.map((i) => i.condition.sourceDoc),
  );

  const commit = (item: ImpactItem) => {
    if (!editing) return;
    const raw = Number(editing.draft);
    if (!Number.isFinite(raw) || raw < 0) {
      setEditing(null);
      return;
    }
    const value = toEditValue(item, editing.kind, raw);
    const edit =
      editing.kind === 'effect'
        ? { effectValue: value }
        : editing.kind === 'cycle'
          ? { dayOfMonth: Math.min(31, Math.max(1, Math.round(value))) }
          : { threshold: value };
    dispatch({ type: 'edit', conditionId: item.condition.id, edit });
    setEditing(null);
  };

  return (
    <AppShell title="약관 근거" onBack={() => dispatch({ type: 'back' })} hideTabBar>
      <div className="chips">
        {holders.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${p.id === product?.id ? ' on' : ''}`}
            onClick={() => {
              setEditing(null);
              setActive(p.id);
            }}
          >
            {p.shortName ?? p.name}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <div key={item.condition.id} className="card">
          <Clause condition={item.condition} />

          <div className="fields">
            {evidenceFields(item, d.center).map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                item={item}
                editing={editing}
                onStart={(kind, raw) =>
                  setEditing({ conditionId: item.condition.id, kind, draft: String(raw) })
                }
                onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
                onCommit={() => commit(item)}
                onCancel={() => setEditing(null)}
                onRevert={() =>
                  dispatch({ type: 'revert', conditionId: item.condition.id, key: EDIT_KEY[field.edit!.kind] })
                }
              />
            ))}
          </div>

          <button
            type="button"
            className="btn danger-text"
            onClick={() => dispatch({ type: 'removeCondition', conditionId: item.condition.id })}
          >
            이 조건은 내 상품에 해당 없음
          </button>
        </div>
      ))}

      {items.length === 0 && <p className="empty">이 상품에 걸린 조건이 없습니다.</p>}

      {removedHere.map((c) => (
        <div key={c.id} className="card offcard">
          <p>
            “해당 없음” 으로 뺀 조건입니다 · {c.sourceDoc}
            {c.binds && ` · ${productById(BASE_SCENARIO, c.binds.holder).name}`}
            <button
              type="button"
              className="link"
              onClick={() => dispatch({ type: 'restoreCondition', conditionId: c.id })}
            >
              되돌리기
            </button>
          </p>
        </div>
      ))}

      {unsupported.length > 0 && (
        <div className="card unsup">
          <h3 className="cardtitle">
            <Glyph name="info" size={16} />이 약관에서 {unsupported.length}건을 조건으로 옮기지 못했습니다
          </h3>
          {unsupported.map((u) => (
            <div key={u.id} className="unsupitem">
              <span className="tg">{u.unsupportedReason}</span>
              <span className="conf">신뢰도 {Math.round(u.confidence * 100)}%</span>
              <p>{u.sourceText}</p>
            </div>
          ))}
        </div>
      )}

      <p className="footnote">
        값을 수정하면 화면 전체가 다시 계산됩니다. 수정한 값에는 &lsquo;사용자 확인&rsquo; 태그가 붙습니다.
      </p>
    </AppShell>
  );
}
