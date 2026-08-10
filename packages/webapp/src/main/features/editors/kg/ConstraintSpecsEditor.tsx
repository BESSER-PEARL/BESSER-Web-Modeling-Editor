/** Constraint editor used inside the KG inspector for NodeConstraint and
 *  PropertyConstraint nodes.
 *
 *  Rendered as a single self-contained block — the parent inspector hands it
 *  the current constraint node, the list of specs, and a setter; the editor
 *  takes care of:
 *
 *  - showing a live natural-language preview at the top,
 *  - rendering quick-add templates (one click → pre-filled spec rows),
 *  - showing the existing spec list with inline value editors,
 *  - opening a categorised picker (filtered by node type + target property
 *    kind) for new specs,
 *  - inline validation (red banner) on contradictory pairs like
 *    min > max cardinality / minLength > maxLength.
 *
 *  Heavy by lines but flat by structure: each `valueShape` from
 *  `constraint-catalog.ts` has its own tiny inline editor. Adding a new
 *  constraint kind is a matter of (a) appending an entry to the catalog,
 *  (b) extending the `describeSpec` helper, and (c) handling the new
 *  `valueShape` here.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  KGConstraintSpec,
  KGNestedShape,
  KGNodeData,
  KnowledgeGraphData,
} from './types';
import {
  KG_CONSTRAINT_TARGET_CLASS,
  KG_CONSTRAINT_TARGET_PROPERTY,
} from './types';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CONSTRAINT_BY_KIND,
  filterCatalog,
  templatesFor,
  type ConstraintCategory,
  type ConstraintCatalogEntry,
} from './constraint-catalog';
import { describeSpec, describeSpecList } from './describeConstraints';
import { NestedSpecsEditor } from './NestedSpecsEditor';

const XSD_DATATYPES: Array<{ value: string; label: string; group: string }> = [
  { value: 'http://www.w3.org/2001/XMLSchema#string', label: 'string', group: 'Text' },
  { value: 'http://www.w3.org/2001/XMLSchema#normalizedString', label: 'normalizedString', group: 'Text' },
  { value: 'http://www.w3.org/2001/XMLSchema#token', label: 'token', group: 'Text' },
  { value: 'http://www.w3.org/2001/XMLSchema#anyURI', label: 'anyURI', group: 'Text' },
  { value: 'http://www.w3.org/2001/XMLSchema#integer', label: 'integer', group: 'Numeric' },
  { value: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger', label: 'nonNegativeInteger', group: 'Numeric' },
  { value: 'http://www.w3.org/2001/XMLSchema#positiveInteger', label: 'positiveInteger', group: 'Numeric' },
  { value: 'http://www.w3.org/2001/XMLSchema#decimal', label: 'decimal', group: 'Numeric' },
  { value: 'http://www.w3.org/2001/XMLSchema#double', label: 'double', group: 'Numeric' },
  { value: 'http://www.w3.org/2001/XMLSchema#float', label: 'float', group: 'Numeric' },
  { value: 'http://www.w3.org/2001/XMLSchema#date', label: 'date', group: 'Date/Time' },
  { value: 'http://www.w3.org/2001/XMLSchema#dateTime', label: 'dateTime', group: 'Date/Time' },
  { value: 'http://www.w3.org/2001/XMLSchema#time', label: 'time', group: 'Date/Time' },
  { value: 'http://www.w3.org/2001/XMLSchema#boolean', label: 'boolean', group: 'Boolean' },
  { value: 'http://www.w3.org/2001/XMLSchema#base64Binary', label: 'base64Binary', group: 'Binary' },
  { value: 'http://www.w3.org/2001/XMLSchema#hexBinary', label: 'hexBinary', group: 'Binary' },
  { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', label: 'rdf:langString', group: 'Language-tagged' },
];

const NODE_KINDS = [
  { value: 'http://www.w3.org/ns/shacl#IRI', label: 'IRI' },
  { value: 'http://www.w3.org/ns/shacl#BlankNode', label: 'Blank node' },
  { value: 'http://www.w3.org/ns/shacl#Literal', label: 'Literal' },
  { value: 'http://www.w3.org/ns/shacl#IRIOrLiteral', label: 'IRI or Literal' },
  { value: 'http://www.w3.org/ns/shacl#BlankNodeOrIRI', label: 'BlankNode or IRI' },
  { value: 'http://www.w3.org/ns/shacl#BlankNodeOrLiteral', label: 'BlankNode or Literal' },
];

const SEVERITIES = [
  { value: 'http://www.w3.org/ns/shacl#Info', label: 'Info' },
  { value: 'http://www.w3.org/ns/shacl#Warning', label: 'Warning' },
  { value: 'http://www.w3.org/ns/shacl#Violation', label: 'Violation' },
];

interface ConstraintSpecsEditorProps {
  /** The constraint node being edited (NodeConstraint / PropertyConstraint). */
  node: KGNodeData;
  /** The whole diagram model — used by IRI pickers to autocomplete from
   *  existing classes / properties. */
  model: KnowledgeGraphData;
  /** Called whenever the spec list changes. The parent commits this back
   *  into `node.metadata.constraintSpecs`. */
  onSpecsChange: (specs: KGConstraintSpec[]) => void;
}

function getTargetInfo(
  node: KGNodeData,
  model: KnowledgeGraphData,
): { targetName?: string; targetPropertyKind?: 'Object' | 'Datatype' } {
  const targetIri =
    node.nodeType === 'nodeConstraint' ? KG_CONSTRAINT_TARGET_CLASS : KG_CONSTRAINT_TARGET_PROPERTY;
  for (const edge of model.edges) {
    if (edge.source === node.id && edge.iri === targetIri) {
      const tgt = model.nodes.find((n) => n.id === edge.target);
      if (tgt) {
        const meta = (tgt.metadata ?? {}) as Record<string, unknown>;
        const kind = typeof meta.kind === 'string' ? (meta.kind as string) : undefined;
        return {
          targetName: tgt.label || tgt.id,
          targetPropertyKind: kind === 'Object' || kind === 'Datatype' ? kind : undefined,
        };
      }
    }
  }
  return {};
}

function validateSpecs(specs: KGConstraintSpec[]): string[] {
  const errors: string[] = [];
  const byKind: Record<string, KGConstraintSpec | undefined> = {};
  for (const s of specs) byKind[s.kind] = s;
  const minC = byKind.minCardinality?.value;
  const maxC = byKind.maxCardinality?.value;
  if (typeof minC === 'number' && typeof maxC === 'number' && minC > maxC) {
    errors.push(`minCardinality (${minC}) must not exceed maxCardinality (${maxC}).`);
  }
  const minL = byKind.minLength?.value;
  const maxL = byKind.maxLength?.value;
  if (typeof minL === 'number' && typeof maxL === 'number' && minL > maxL) {
    errors.push(`minLength (${minL}) must not exceed maxLength (${maxL}).`);
  }
  const minIn = byKind.minInclusive?.value;
  const maxIn = byKind.maxInclusive?.value;
  if (typeof minIn === 'number' && typeof maxIn === 'number' && minIn > maxIn) {
    errors.push(`minInclusive (${minIn}) must not exceed maxInclusive (${maxIn}).`);
  }
  for (const s of specs) {
    if (s.kind === 'pattern') {
      try {
        if (typeof s.value === 'string' && s.value.length > 0) new RegExp(s.value);
      } catch {
        errors.push(`Regex pattern "${s.value}" is not a valid regular expression.`);
      }
    }
    if (
      ['minQualifiedCardinality', 'maxQualifiedCardinality', 'exactQualifiedCardinality'].includes(s.kind) &&
      !s.on_class
    ) {
      errors.push(`Qualified cardinality (${s.kind}) needs an "on class" picked.`);
    }
    if (s.kind === 'in' && (!Array.isArray(s.value) || s.value.length === 0)) {
      errors.push('Enumeration (in) requires at least one value.');
    }
  }
  return errors;
}

export const ConstraintSpecsEditor: React.FC<ConstraintSpecsEditorProps> = ({
  node,
  model,
  onSpecsChange,
}) => {
  const meta = (node.metadata ?? {}) as { constraintSpecs?: KGConstraintSpec[] };
  const specs = meta.constraintSpecs ?? [];

  const { targetName, targetPropertyKind } = useMemo(
    () => getTargetInfo(node, model),
    [node, model],
  );

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Constraints ({specs.length})
        </Label>
        {targetName && (
          <span className="text-xs text-muted-foreground">
            Applies to <code className="rounded bg-muted px-1 py-0.5">{targetName}</code>
          </span>
        )}
      </div>

      {/* Live natural-language preview. */}
      <div className="rounded-md border border-purple-300/60 bg-purple-50/40 px-2 py-1.5 text-xs italic text-purple-900 dark:bg-purple-950/30 dark:text-purple-200">
        {describeSpecList(specs, targetName)}
      </div>

      <SpecsListEditor
        specs={specs}
        onChange={onSpecsChange}
        nodeType={node.nodeType as 'nodeConstraint' | 'propertyConstraint'}
        targetPropertyKind={targetPropertyKind}
        ownerNodeId={node.id}
        model={model}
        depth={0}
      />
    </div>
  );
};

interface SpecsListEditorProps {
  specs: KGConstraintSpec[];
  onChange: (next: KGConstraintSpec[]) => void;
  /** Which constraint-node kind owns this list. Drives catalog filtering
   *  (which spec kinds appear in the picker) and templates. */
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  /** When this list belongs to a PropertyConstraint with a known target
   *  property, narrows the picker to relevant kinds. Propagated unchanged
   *  into nested specs so deep-nested editors keep the filter. */
  targetPropertyKind?: 'Object' | 'Datatype';
  /** Id of the constraint node that owns the top of this tree. Used by
   *  the nested reference picker to avoid self-references. */
  ownerNodeId: string;
  model: KnowledgeGraphData;
  /** Recursion depth. The top-level inspector passes 0; each nesting
   *  level inside a logical operator increments. Used to apply visual
   *  indentation and to surface a "deeply nested" hint past depth 3. */
  depth: number;
}

/** Reusable list editor — renders the validation banner, quick-add
 *  templates, spec rows, and the catalog picker. Used both directly by
 *  the top-level inspector and recursively by {@link NestedSpecsEditor}. */
export const SpecsListEditor: React.FC<SpecsListEditorProps> = ({
  specs,
  onChange,
  nodeType,
  targetPropertyKind,
  ownerNodeId,
  model,
  depth,
}) => {
  const availableCatalog = useMemo(
    () => filterCatalog({ nodeType, targetPropertyKind }),
    [nodeType, targetPropertyKind],
  );
  const validationErrors = useMemo(() => validateSpecs(specs), [specs]);
  const templates = useMemo(() => templatesFor(nodeType), [nodeType]);

  const setSpec = (index: number, next: KGConstraintSpec) => {
    const copy = specs.slice();
    copy[index] = next;
    onChange(copy);
  };
  const removeSpec = (index: number) => {
    const copy = specs.slice();
    copy.splice(index, 1);
    onChange(copy);
  };
  const appendSpecs = (
    toAdd: Array<{ kind: string; value?: unknown; on_class?: string }>,
  ) => {
    onChange([...specs, ...toAdd.map((s) => ({ ...s }))]);
  };

  return (
    <div className="space-y-2">
      {validationErrors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <ul className="list-inside list-disc space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {templates.length > 0 && depth === 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Quick add</Label>
          <div className="flex flex-wrap gap-1">
            {templates.map((tmpl) => (
              <Button
                key={tmpl.id}
                variant="outline"
                size="sm"
                title={tmpl.description}
                className="h-7 px-2 text-xs"
                onClick={() => appendSpecs(tmpl.build())}
              >
                {tmpl.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {specs.length > 0 && (
        <ul className="space-y-1.5">
          {specs.map((spec, i) => (
            <SpecRow
              key={`${spec.kind}:${i}`}
              spec={spec}
              model={model}
              nodeType={nodeType}
              targetPropertyKind={targetPropertyKind}
              ownerNodeId={ownerNodeId}
              depth={depth}
              onChange={(next) => setSpec(i, next)}
              onDelete={() => removeSpec(i)}
            />
          ))}
        </ul>
      )}

      <ConstraintPicker
        catalog={availableCatalog}
        onPick={(entry) => appendSpecs([{ kind: entry.kind, value: defaultValueFor(entry) }])}
      />
    </div>
  );
};

/** Default value to seed a freshly-added spec, picked from the catalog. */
function defaultValueFor(entry: ConstraintCatalogEntry): unknown {
  switch (entry.valueShape) {
    case 'int':
      return 1;
    case 'number':
      return 0;
    case 'string':
      return '';
    case 'boolean':
      return true;
    case 'regex':
      return '.*';
    case 'iri':
    case 'class-iri':
    case 'property-iri':
    case 'datatype-iri':
      return '';
    case 'iri-list':
    case 'class-iri-list':
    case 'property-iri-list':
    case 'literal-list':
    case 'language-list':
      return [];
    case 'nested-specs':
      // shaclNot requires exactly one slot; the others start empty so the
      // user adds via the "+ Add shape" button.
      if (entry.kind === 'shaclNot') return [{ specs: [] }];
      return [];
    case 'literal':
      return { value: '', datatype: undefined, language: undefined };
    case 'qualified-cardinality':
      return 1;
    case 'node-kind':
      return NODE_KINDS[0].value;
    case 'severity':
      return SEVERITIES[2].value;
    case 'min-max':
      return { min: 0, max: 1 };
    default:
      return null;
  }
}

const SpecRow: React.FC<{
  spec: KGConstraintSpec;
  model: KnowledgeGraphData;
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  targetPropertyKind?: 'Object' | 'Datatype';
  ownerNodeId: string;
  depth: number;
  onChange: (next: KGConstraintSpec) => void;
  onDelete: () => void;
}> = ({ spec, model, nodeType, targetPropertyKind, ownerNodeId, depth, onChange, onDelete }) => {
  const [open, setOpen] = useState(true);
  const entry = CONSTRAINT_BY_KIND.get(spec.kind);
  const description = describeSpec(spec);
  const vocabChip = entry?.vocab.join('+').toUpperCase() ?? '';

  return (
    <li className="rounded-md border border-border/70 bg-card/60">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 text-left text-xs"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className="flex-1 truncate">{description}</span>
        </button>
        {vocabChip && (
          <span
            className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
            title={`${entry?.owlTerm ?? ''} ${entry?.shaclTerm ?? ''}`.trim()}
          >
            {vocabChip}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Remove constraint"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {open && entry && (
        <div className="border-t border-border/50 px-2 py-2">
          <SpecValueEditor
            entry={entry}
            spec={spec}
            model={model}
            nodeType={nodeType}
            targetPropertyKind={targetPropertyKind}
            ownerNodeId={ownerNodeId}
            depth={depth}
            onChange={onChange}
          />
        </div>
      )}
    </li>
  );
};

const SpecValueEditor: React.FC<{
  entry: ConstraintCatalogEntry;
  spec: KGConstraintSpec;
  model: KnowledgeGraphData;
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  targetPropertyKind?: 'Object' | 'Datatype';
  ownerNodeId: string;
  depth: number;
  onChange: (next: KGConstraintSpec) => void;
}> = ({ entry, spec, model, nodeType, targetPropertyKind, ownerNodeId, depth, onChange }) => {
  const setValue = (value: unknown) => onChange({ ...spec, value });
  const setOnClass = (on_class: string) => onChange({ ...spec, on_class: on_class || undefined });

  const classIris = useMemo(() => collectIris(model, 'class'), [model]);
  const propertyIris = useMemo(() => collectIris(model, 'property'), [model]);

  switch (entry.valueShape) {
    case 'int':
      return (
        <Input
          type="number"
          min={0}
          step={1}
          value={Number(spec.value ?? 0)}
          onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
          className="h-8 w-28"
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={typeof spec.value === 'number' ? spec.value : Number(spec.value ?? 0)}
          onChange={(e) => setValue(parseFloat(e.target.value))}
          className="h-8 w-32"
        />
      );
    case 'string':
      return (
        <Input
          value={String(spec.value ?? '')}
          onChange={(e) => setValue(e.target.value)}
          className="h-8"
        />
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(spec.value)}
            onChange={(e) => setValue(e.target.checked)}
            className="size-4 rounded border-input"
          />
          {Boolean(spec.value) ? 'enabled' : 'disabled'}
        </label>
      );
    case 'regex':
      return (
        <Input
          value={String(spec.value ?? '')}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 font-mono"
          placeholder="^[A-Za-z]+$"
        />
      );
    case 'iri':
      return (
        <Input
          value={String(spec.value ?? '')}
          onChange={(e) => setValue(e.target.value)}
          placeholder="http://example.org/…"
          className="h-8"
        />
      );
    case 'class-iri':
      return <IriPicker value={String(spec.value ?? '')} options={classIris} onChange={setValue} />;
    case 'property-iri':
      return <IriPicker value={String(spec.value ?? '')} options={propertyIris} onChange={setValue} />;
    case 'datatype-iri':
      return <DatatypePicker value={String(spec.value ?? '')} onChange={setValue} />;
    case 'iri-list':
      return <IriListEditor values={asStringArray(spec.value)} onChange={setValue} options={classIris} />;
    case 'class-iri-list':
      return <IriListEditor values={asStringArray(spec.value)} onChange={setValue} options={classIris} />;
    case 'property-iri-list':
      return <IriListEditor values={asStringArray(spec.value)} onChange={setValue} options={propertyIris} />;
    case 'literal-list':
      return <LiteralListEditor values={asArray(spec.value)} onChange={setValue} />;
    case 'language-list':
      return <IriListEditor values={asStringArray(spec.value)} onChange={setValue} options={[]} placeholder="en, de-CH …" />;
    case 'qualified-cardinality':
      return (
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Count</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={Number(spec.value ?? 0)}
              onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
              className="h-8 w-24"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">On class</Label>
            <IriPicker value={spec.on_class ?? ''} options={classIris} onChange={setOnClass} />
          </div>
        </div>
      );
    case 'node-kind':
      return (
        <Select value={String(spec.value ?? '')} onValueChange={setValue}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Pick a node kind" />
          </SelectTrigger>
          <SelectContent>
            {NODE_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'severity':
      return (
        <Select value={String(spec.value ?? '')} onValueChange={setValue}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Pick severity" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'literal':
      return <LiteralEditor value={(spec.value ?? {}) as Record<string, unknown>} onChange={setValue} />;
    case 'nested-specs':
      return (
        <NestedSpecsEditor
          kind={entry.kind}
          value={Array.isArray(spec.value) ? (spec.value as KGNestedShape[]) : []}
          onChange={setValue}
          model={model}
          nodeType={nodeType}
          targetPropertyKind={targetPropertyKind}
          ownerNodeId={ownerNodeId}
          depth={depth + 1}
        />
      );
    case 'min-max':
    default:
      return (
        <span className="text-xs italic text-muted-foreground">
          Editor for "{entry.valueShape}" coming soon — value preserved as-is.
        </span>
      );
  }
};

// --- Sub-editors ------------------------------------------------------------

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string') as string[];
}

function collectIris(model: KnowledgeGraphData, kind: 'class' | 'property'): Array<{ iri: string; label: string }> {
  const out: Array<{ iri: string; label: string }> = [];
  for (const n of model.nodes) {
    if (n.nodeType !== kind) continue;
    const iri = n.iri ?? n.id;
    if (iri) out.push({ iri, label: n.label || iri });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

const IriPicker: React.FC<{
  value: string;
  options: Array<{ iri: string; label: string }>;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ value, options, placeholder, onChange }) => {
  const datalistId = `iri-list-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <>
      <Input
        list={datalistId}
        value={value}
        placeholder={placeholder ?? 'http://example.org/…'}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
      <datalist id={datalistId}>
        {options.map((o) => (
          <option key={o.iri} value={o.iri}>
            {o.label}
          </option>
        ))}
      </datalist>
    </>
  );
};

const DatatypePicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Pick an XSD datatype" />
        </SelectTrigger>
        <SelectContent>
          {XSD_DATATYPES.map((dt) => (
            <SelectItem key={dt.value} value={dt.value}>
              {dt.group}: {dt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a custom datatype IRI"
        className="h-7 text-xs"
      />
    </div>
  );
};

const IriListEditor: React.FC<{
  values: string[];
  options: Array<{ iri: string; label: string }>;
  placeholder?: string;
  onChange: (next: string[]) => void;
}> = ({ values, options, placeholder, onChange }) => {
  const updateAt = (idx: number, v: string) => {
    const copy = values.slice();
    copy[idx] = v;
    onChange(copy);
  };
  const removeAt = (idx: number) => {
    const copy = values.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };
  return (
    <div className="space-y-1">
      {values.map((v, i) => (
        <div key={i} className="flex gap-1">
          <IriPicker value={v} options={options} placeholder={placeholder} onChange={(nv) => updateAt(i, nv)} />
          <Button variant="ghost" size="icon" className="size-7" onClick={() => removeAt(i)} aria-label="Remove">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => onChange([...values, ''])}
      >
        <Plus className="size-3.5" />
        Add value
      </Button>
    </div>
  );
};

const LiteralListEditor: React.FC<{
  values: unknown[];
  onChange: (next: unknown[]) => void;
}> = ({ values, onChange }) => {
  const stringValues: Array<{ value: string; datatype?: string; language?: string }> = values.map((v) => {
    if (typeof v === 'string') return { value: v };
    if (v && typeof v === 'object' && 'value' in (v as any))
      return v as { value: string; datatype?: string; language?: string };
    return { value: String(v ?? '') };
  });
  const updateAt = (idx: number, patch: Partial<{ value: string; datatype?: string; language?: string }>) => {
    const copy = stringValues.slice();
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };
  const removeAt = (idx: number) => {
    const copy = stringValues.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };
  return (
    <div className="space-y-1">
      {stringValues.map((v, i) => (
        <div key={i} className="flex gap-1">
          <Input
            value={v.value ?? ''}
            placeholder="Literal value"
            className="h-8 flex-1"
            onChange={(e) => updateAt(i, { value: e.target.value })}
          />
          <Button variant="ghost" size="icon" className="size-7" onClick={() => removeAt(i)} aria-label="Remove">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => onChange([...stringValues, { value: '' }])}
      >
        <Plus className="size-3.5" />
        Add value
      </Button>
    </div>
  );
};

const LiteralEditor: React.FC<{
  value: Record<string, unknown>;
  onChange: (v: unknown) => void;
}> = ({ value, onChange }) => {
  const v = typeof value === 'object' && value ? value : {};
  const set = (patch: Record<string, unknown>) => onChange({ ...v, ...patch });
  return (
    <div className="space-y-1">
      <Input
        value={String(v.value ?? '')}
        placeholder="Literal value or IRI"
        className="h-8"
        onChange={(e) => set({ value: e.target.value })}
      />
      <div className="flex gap-1">
        <Input
          value={String(v.datatype ?? '')}
          placeholder="datatype IRI (optional)"
          className="h-7 flex-1 text-xs"
          onChange={(e) => set({ datatype: e.target.value || undefined })}
        />
        <Input
          value={String(v.language ?? '')}
          placeholder="lang tag (e.g. en)"
          className="h-7 w-24 text-xs"
          onChange={(e) => set({ language: e.target.value || undefined })}
        />
      </div>
    </div>
  );
};

// --- Picker -----------------------------------------------------------------

const ConstraintPicker: React.FC<{
  catalog: ConstraintCatalogEntry[];
  onPick: (entry: ConstraintCatalogEntry) => void;
}> = ({ catalog, onPick }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside dismissal.
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const grouped: Record<ConstraintCategory, ConstraintCatalogEntry[]> = useMemo(() => {
    const out: Record<ConstraintCategory, ConstraintCatalogEntry[]> = {
      cardinality: [],
      value: [],
      datatype: [],
      enumeration: [],
      logical: [],
      classAxiom: [],
      meta: [],
    };
    const q = query.trim().toLowerCase();
    for (const entry of catalog) {
      if (q && !`${entry.label} ${entry.description}`.toLowerCase().includes(q)) continue;
      out[entry.category].push(entry);
    }
    return out;
  }, [catalog, query]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full justify-start gap-1 text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="size-3.5" />
        Add constraint
      </Button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-80 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search constraints…"
              className="h-7 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {CATEGORY_ORDER.map((cat) => {
              const entries = grouped[cat];
              if (entries.length === 0) return null;
              return (
                <div key={cat} className="py-1">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <ul>
                    {entries.map((entry) => (
                      <li key={entry.kind}>
                        <button
                          type="button"
                          title={`${entry.description}\n\n${[entry.owlTerm, entry.shaclTerm].filter(Boolean).join(' / ')}`}
                          className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-muted/60"
                          onClick={() => {
                            onPick(entry);
                            setOpen(false);
                            setQuery('');
                          }}
                        >
                          <span className="flex-1">{entry.label}</span>
                          <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-semibold tracking-wide text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                            {entry.vocab.join('+').toUpperCase()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
