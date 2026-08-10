/** Editor for the four SHACL logical operators (`shaclNot`, `shaclAnd`,
 *  `shaclOr`, `shaclXone`) — i.e. the `nested-specs` value shape.
 *
 *  Each operator holds a list of nested-shape slots. A slot is either:
 *  - **Reference** to an existing NodeConstraint / PropertyConstraint in the
 *    diagram (`{ ref }`) — pick once, reuse across shapes.
 *  - **Inline** anonymous shape (`{ specs }`) — a recursive bag of constraint
 *    specs edited via the shared `SpecsListEditor`. Inline shapes are not
 *    materialised as canvas nodes; they live inside the parent constraint's
 *    spec value and round-trip through the JSON converter unchanged.
 *
 *  Visual indentation grows with depth; past depth 3 we show a hint
 *  suggesting the user extract the shape into a separate constraint node
 *  for legibility.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import type { KGConstraintSpec, KGNestedShape, KnowledgeGraphData, KGNodeData } from './types';
import { describeSpecList } from './describeConstraints';
// SpecsListEditor lives in ConstraintSpecsEditor.tsx, which in turn renders
// NestedSpecsEditor for `nested-specs` value shapes. The cycle is fine at
// runtime because both imports are only used inside render functions —
// module evaluation finishes before any component renders.
import { SpecsListEditor } from './ConstraintSpecsEditor';

/** `intro` is the English default; the live text comes from
 *  `editors.kg.constraints.describe.<kind>` -- the same sentences the
 *  natural-language preview uses, so both read identically. */
const KIND_LABELS: Record<string, { intro: string; addLabel: string; allowAdd: boolean }> = {
  shaclNot: { intro: 'Must NOT satisfy', addLabel: '', allowAdd: false },
  shaclAnd: { intro: 'Must satisfy ALL of', addLabel: '+ Add shape', allowAdd: true },
  shaclOr: { intro: 'Must satisfy ANY of', addLabel: '+ Add shape', allowAdd: true },
  shaclXone: { intro: 'Must satisfy EXACTLY ONE of', addLabel: '+ Add shape', allowAdd: true },
};

/** Operator -> heading key. Reuses the `describe.*` phrasing with an empty
 *  `shapes` value so the intro reads as a bare lead-in. */
const KIND_INTRO_KEYS: Record<string, string> = {
  shaclNot: 'editors.kg.constraints.nested.introNot',
  shaclAnd: 'editors.kg.constraints.nested.introAnd',
  shaclOr: 'editors.kg.constraints.nested.introOr',
  shaclXone: 'editors.kg.constraints.nested.introXone',
};

interface NestedSpecsEditorProps {
  kind: string;
  value: KGNestedShape[];
  onChange: (next: KGNestedShape[]) => void;
  model: KnowledgeGraphData;
  /** Constraint-node kind of the OWNER (top-level) constraint, propagated
   *  down so deeply-nested editors still filter the catalog appropriately. */
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  /** When the owner is a PropertyConstraint with a known target property
   *  kind, propagated down so datatype-only constraints stay hidden for
   *  object-property contexts. */
  targetPropertyKind?: 'Object' | 'Datatype';
  /** Top-level constraint-node id. Used by the Reference slot picker to
   *  exclude the owner from the candidate set (no self-references). */
  ownerNodeId: string;
  depth: number;
}

export const NestedSpecsEditor: React.FC<NestedSpecsEditorProps> = ({
  kind,
  value,
  onChange,
  model,
  nodeType,
  targetPropertyKind,
  ownerNodeId,
  depth,
}) => {
  const { t } = useTranslation();
  const labels = KIND_LABELS[kind] ?? { intro: kind, addLabel: '+ Add shape', allowAdd: true };
  // Unknown operators fall back to the raw discriminator, as elsewhere.
  const intro = KIND_INTRO_KEYS[kind]
    ? t(KIND_INTRO_KEYS[kind], { defaultValue: labels.intro })
    : labels.intro;

  const setSlot = (index: number, next: KGNestedShape) => {
    const copy = value.slice();
    copy[index] = next;
    onChange(copy);
  };
  const removeSlot = (index: number) => {
    const copy = value.slice();
    copy.splice(index, 1);
    onChange(copy);
  };
  const addInline = () => onChange([...value, { specs: [] }]);

  // For shaclNot we always render exactly one slot. If `value` is empty (e.g.
  // imported as-is from a malformed source), synthesise an empty inline slot
  // for editing.
  const slots: KGNestedShape[] =
    kind === 'shaclNot' && value.length === 0 ? [{ specs: [] }] : value;

  return (
    <div
      className="space-y-2 rounded-md border-l-4 border-purple-300/70 bg-purple-50/30 p-2 dark:bg-purple-950/15"
      style={{ marginLeft: Math.min(depth * 4, 24) }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-200">
        {intro}
      </div>

      {depth >= 3 && (
        <p className="text-[11px] italic text-amber-700 dark:text-amber-400">
          {t('editors.kg.constraints.nested.deeplyNested')}
        </p>
      )}

      <ul className="space-y-2">
        {slots.map((slot, i) => (
          <NestedSlot
            key={i}
            slot={slot}
            model={model}
            nodeType={nodeType}
            targetPropertyKind={targetPropertyKind}
            ownerNodeId={ownerNodeId}
            depth={depth}
            removable={labels.allowAdd}
            onChange={(next) => setSlot(i, next)}
            onRemove={() => removeSlot(i)}
          />
        ))}
      </ul>

      {labels.allowAdd && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={addInline}
        >
          <Plus className="size-3.5" />
          {t('editors.kg.constraints.nested.addShape')}
        </Button>
      )}
    </div>
  );
};

interface NestedSlotProps {
  slot: KGNestedShape;
  model: KnowledgeGraphData;
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  targetPropertyKind?: 'Object' | 'Datatype';
  ownerNodeId: string;
  depth: number;
  removable: boolean;
  onChange: (next: KGNestedShape) => void;
  onRemove: () => void;
}

const NestedSlot: React.FC<NestedSlotProps> = ({
  slot,
  model,
  nodeType,
  targetPropertyKind,
  ownerNodeId,
  depth,
  removable,
  onChange,
  onRemove,
}) => {
  const { t } = useTranslation();
  const isRef = 'ref' in slot;
  const mode: 'inline' | 'ref' = isRef ? 'ref' : 'inline';

  const switchToInline = () => {
    if (mode === 'inline') return;
    onChange({ specs: [] });
  };
  const switchToRef = () => {
    if (mode === 'ref') return;
    const currentSpecs = 'specs' in slot ? slot.specs : [];
    if (
      currentSpecs.length > 0 &&
      // NOTE: window.confirm's OK/Cancel buttons follow the browser locale,
      // not the app's -- only the message can be translated here.
      !window.confirm(t('editors.kg.constraints.nested.confirmSwitchToRef'))
    ) {
      return;
    }
    onChange({ ref: '' });
  };

  return (
    <li className="rounded-md border border-purple-200/70 bg-white/40 p-2 dark:bg-purple-950/20">
      <div className="mb-1 flex items-center gap-1">
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5 text-[10px]">
          <button
            type="button"
            onClick={switchToInline}
            className={
              'rounded px-1.5 py-0.5 ' +
              (mode === 'inline'
                ? 'bg-purple-200 font-medium text-purple-900 dark:bg-purple-800 dark:text-purple-100'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t('editors.kg.constraints.nested.inline')}
          </button>
          <button
            type="button"
            onClick={switchToRef}
            className={
              'rounded px-1.5 py-0.5 ' +
              (mode === 'ref'
                ? 'bg-purple-200 font-medium text-purple-900 dark:bg-purple-800 dark:text-purple-100'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t('editors.kg.constraints.nested.reference')}
          </button>
        </div>
        <div className="flex-1" />
        {removable && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={t('editors.kg.constraints.nested.removeSlot')}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      {mode === 'ref' ? (
        <RefPicker
          model={model}
          nodeType={nodeType}
          ownerNodeId={ownerNodeId}
          value={'ref' in slot ? slot.ref : ''}
          onChange={(ref) => onChange({ ref })}
        />
      ) : (
        <InlineSpecs
          specs={'specs' in slot ? slot.specs : []}
          onChange={(specs) => onChange({ specs })}
          model={model}
          nodeType={nodeType}
          targetPropertyKind={targetPropertyKind}
          ownerNodeId={ownerNodeId}
          depth={depth + 1}
        />
      )}
    </li>
  );
};

// --- Reference picker -------------------------------------------------------

const RefPicker: React.FC<{
  model: KnowledgeGraphData;
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  ownerNodeId: string;
  value: string;
  onChange: (ref: string) => void;
}> = ({ model, nodeType, ownerNodeId, value, onChange }) => {
  const { t } = useTranslation();
  // Same kind as the owner — a NodeConstraint's logical operator references
  // NodeShapes; a PropertyConstraint's references PropertyShapes. Self-refs
  // are filtered to prevent trivial cycles.
  const candidates: KGNodeData[] = model.nodes.filter(
    (n) => n.nodeType === nodeType && n.id !== ownerNodeId,
  );
  const datalistId = `nested-ref-${Math.random().toString(36).slice(2, 8)}`;
  const selected = candidates.find((n) => n.id === value);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">
        {/* The SHACL type name is interpolated, never translated. */}
        {t('editors.kg.constraints.nested.pickExisting', {
          type: nodeType === 'nodeConstraint' ? 'NodeConstraint' : 'PropertyConstraint',
        })}
      </Label>
      <Input
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('editors.kg.constraints.nested.refPlaceholder')}
        className="h-7 text-xs"
      />
      <datalist id={datalistId}>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label || c.id}
          </option>
        ))}
      </datalist>
      {selected && (
        <p className="text-[11px] italic text-muted-foreground">
          → <span className="font-medium not-italic">{selected.label || selected.id}</span>
        </p>
      )}
      {value && !selected && (
        <p className="text-[11px] italic text-destructive">
          {t('editors.kg.constraints.nested.noneWithId', {
            type: nodeType === 'nodeConstraint' ? 'NodeConstraint' : 'PropertyConstraint',
          })}
        </p>
      )}
    </div>
  );
};

// --- Inline specs editor ----------------------------------------------------

const InlineSpecs: React.FC<{
  specs: KGConstraintSpec[];
  onChange: (next: KGConstraintSpec[]) => void;
  model: KnowledgeGraphData;
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  targetPropertyKind?: 'Object' | 'Datatype';
  ownerNodeId: string;
  depth: number;
}> = ({ specs, onChange, model, nodeType, targetPropertyKind, ownerNodeId, depth }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[11px] italic text-muted-foreground">
        {describeSpecList(t, specs)}
      </p>
      <SpecsListEditor
        specs={specs}
        onChange={onChange}
        nodeType={nodeType}
        targetPropertyKind={targetPropertyKind}
        ownerNodeId={ownerNodeId}
        model={model}
        depth={depth}
      />
    </div>
  );
};
