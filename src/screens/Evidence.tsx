import { useState } from 'react';
import { Highlight } from '../components/Highlight';
import { PhoneFrame } from '../components/PhoneFrame';
import { SourceTag } from '../components/SourceTag';
import type { ImpactItem } from '../lib/derive';
import { evidenceFields, toEditValue, type EditKind, type EvidenceField } from '../lib/evidence';
import { unsupportedForDocs } from '../lib/graph';
import { useStore } from '../state/store';

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
}: {
  field: EvidenceField;
  item: ImpactItem;
  editing: Editing | null;
  onStart: (kind: EditKind, raw: number) => void;
  onChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const isEditing =
    editing !== null && editing.conditionId === item.condition.id && editing.kind === field.edit?.kind;

  return (
    <div className="f">
      <span className="k">
        {field.label}
        {field.note && <span className="note">{field.note}</span>}
      </span>
      <span className="r">
        {isEditing && field.edit ? (
          <span className="editbox">
            <input
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
            <span className="v">{field.display.value}</span>
            {field.edit && (
              <button type="button" className="edit" onClick={() => onStart(field.edit!.kind, field.edit!.raw)}>
                수정
              </button>
            )}
          </>
        )}
        <br />
        <SourceTag source={field.display.source} />
      </span>
    </div>
  );
}

export function Evidence() {
  const { state, scenario, derived: d, dispatch } = useStore();
  const [editing, setEditing] = useState<Editing | null>(null);

  const holders = d.graph.satellites.map((s) => s.product);
  const product = holders.find((p) => p.id === state.evidenceProductId) ?? holders[0];
  const items = product ? d.items.filter((i) => i.product.id === product.id) : [];
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

  const idx = product ? holders.findIndex((p) => p.id === product.id) : -1;
  const nextProduct = holders.length ? holders[(idx + 1) % holders.length] : null;

  return (
    <PhoneFrame
      title={`근거 · ${product?.name ?? ''}`}
      onBack={() => dispatch({ type: 'navigate', screen: 3 })}
    >
      <div className="chips">
        {holders.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${p.id === product?.id ? ' on' : ''}`}
            onClick={() => {
              setEditing(null);
              dispatch({ type: 'showEvidence', productId: p.id });
            }}
          >
            {p.shortName ?? p.name}
          </button>
        ))}
      </div>

      {items.map((item) => (
        <div key={item.condition.id}>
          <div className="clause">
            <div className="inst" style={{ marginBottom: '.35rem' }}>
              {item.condition.sourceDoc}
            </div>
            <Highlight text={item.condition.sourceText} spans={item.condition.spans} />
            {item.condition.exclude && item.condition.exclude.length > 0 && (
              <div className="excl">제외: {item.condition.exclude.join(', ')}</div>
            )}
          </div>

          <div className="box tight">
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
              />
            ))}
          </div>
        </div>
      ))}

      {unsupported.length > 0 && (
        <div className="unsup">
          이 약관에서 {unsupported.length}건을 조건으로 옮기지 못했습니다
          {unsupported.map((u) => (
            <div key={u.id} className="unsup-item">
              <span className="tg">{u.unsupportedReason}</span> · 신뢰도 {Math.round(u.confidence * 100)}%
              <div className="unsup-text">{u.sourceText}</div>
            </div>
          ))}
        </div>
      )}

      {nextProduct && holders.length > 1 && (
        <button
          type="button"
          className="btn text"
          style={{ marginTop: '.6rem' }}
          onClick={() => {
            setEditing(null);
            dispatch({ type: 'showEvidence', productId: nextProduct.id });
          }}
        >
          다른 상품의 근거 보기 → {nextProduct.shortName ?? nextProduct.name}
        </button>
      )}
    </PhoneFrame>
  );
}
