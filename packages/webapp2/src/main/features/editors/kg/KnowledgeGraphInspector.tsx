import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, EyeOff, Plus, Search, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  KnowledgeGraphData,
  KGNodeData,
  KGEdgeData,
  KGNodeType,
  KGConstraintSpec,
} from './types';
import { KG_NODE_TYPES } from './types';
import { KG_NODE_COLORS } from './stylesheet';
import { KgShapeIcon } from './KgShapeIcon';
import { ConstraintSpecsEditor } from './ConstraintSpecsEditor';
import { KG_EDGE_RULES, sourceTypesAllowedToTarget } from './edge-rules';

export type KgSelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'multi'; nodeIds: string[]; edgeIds: string[] }
  | null;

interface Props {
  model: KnowledgeGraphData;
  selection: KgSelection;
  onChange: (next: KnowledgeGraphData) => void;
  onHideNode: (id: string) => void;
  onBulkHideNodes: (ids: string[]) => void;
  /** Ask the parent to set selection to a specific value — used to roll back
   *  the parent's selection state when the user cancels a dirty-switch. */
  onRequestSelection: (sel: KgSelection) => void;
  onClearSelection: () => void;
}

type NodeDraft = {
  kind: 'node';
  originalId: string;
  fields: KGNodeData;
  addedEdges: KGEdgeData[];
  deletedEdgeIds: Set<string>;
  deleteSelf: boolean;
};

type EdgeDraft = {
  kind: 'edge';
  originalId: string;
  fields: KGEdgeData;
  deleteSelf: boolean;
};

type Draft = NodeDraft | EdgeDraft | null;

const DATALIST_ID = 'kg-inspector-predicates';

function makeRandomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2);
}

function newEdgeId(): string {
  return `edge:${makeRandomId()}`;
}

function derivePredicateSuggestions(model: KnowledgeGraphData): string[] {
  const out = new Set<string>();
  for (const e of model.edges) {
    const v = e.label ?? e.iri;
    if (v && v.length > 0) out.add(v);
  }
  return Array.from(out).sort();
}

function makeNodeDraft(node: KGNodeData): NodeDraft {
  return {
    kind: 'node',
    originalId: node.id,
    fields: { ...node },
    addedEdges: [],
    deletedEdgeIds: new Set<string>(),
    deleteSelf: false,
  };
}

function makeEdgeDraft(edge: KGEdgeData): EdgeDraft {
  return {
    kind: 'edge',
    originalId: edge.id,
    fields: { ...edge },
    deleteSelf: false,
  };
}

function nodeFieldsEqual(a: KGNodeData, b: KGNodeData): boolean {
  return (
    a.id === b.id &&
    a.nodeType === b.nodeType &&
    a.label === b.label &&
    (a.iri ?? '') === (b.iri ?? '') &&
    (a.value ?? '') === (b.value ?? '') &&
    (a.datatype ?? '') === (b.datatype ?? '') &&
    // For constraint nodes, the spec list lives in metadata and must
    // participate in dirty detection so Apply triggers correctly.
    JSON.stringify(a.metadata ?? null) === JSON.stringify(b.metadata ?? null)
  );
}

function edgeFieldsEqual(a: KGEdgeData, b: KGEdgeData): boolean {
  return (
    a.id === b.id &&
    a.source === b.source &&
    a.target === b.target &&
    (a.label ?? '') === (b.label ?? '') &&
    (a.iri ?? '') === (b.iri ?? '')
  );
}

function isDirtyDraft(draft: Draft, model: KnowledgeGraphData): boolean {
  if (!draft) return false;
  if (draft.deleteSelf) return true;
  if (draft.kind === 'node') {
    if (draft.addedEdges.length > 0) return true;
    if (draft.deletedEdgeIds.size > 0) return true;
    const original = model.nodes.find((n) => n.id === draft.originalId);
    if (!original) return true;
    return !nodeFieldsEqual(draft.fields, original);
  }
  const original = model.edges.find((e) => e.id === draft.originalId);
  if (!original) return true;
  return !edgeFieldsEqual(draft.fields, original);
}

function applyDraft(model: KnowledgeGraphData, draft: Draft): KnowledgeGraphData {
  if (!draft) return model;
  if (draft.kind === 'node') {
    if (draft.deleteSelf) {
      return {
        ...model,
        nodes: model.nodes.filter((n) => n.id !== draft.originalId),
        edges: model.edges.filter(
          (e) => e.source !== draft.originalId && e.target !== draft.originalId,
        ),
      };
    }
    const nodes = model.nodes.map((n) =>
      n.id === draft.originalId ? { ...draft.fields, id: n.id } : n,
    );
    const edges = [
      ...model.edges.filter((e) => !draft.deletedEdgeIds.has(e.id)),
      ...draft.addedEdges,
    ];
    return { ...model, nodes, edges };
  }
  if (draft.deleteSelf) {
    return { ...model, edges: model.edges.filter((e) => e.id !== draft.originalId) };
  }
  const edges = model.edges.map((e) =>
    e.id === draft.originalId ? { ...draft.fields, id: e.id } : e,
  );
  return { ...model, edges };
}

function selectionFromDraft(draft: Draft): KgSelection {
  if (!draft) return null;
  return { kind: draft.kind, id: draft.originalId };
}

function selectionSig(sel: KgSelection): string | null {
  if (!sel) return null;
  if (sel.kind === 'node') return 'n:' + sel.id;
  if (sel.kind === 'edge') return 'e:' + sel.id;
  const ns = [...sel.nodeIds].sort().join(',');
  const es = [...sel.edgeIds].sort().join(',');
  return 'm:' + ns + '|' + es;
}

/** Right-hand inspector panel. Always mounted; shows "no selection" when
 *  nothing is picked. Edits are buffered in a local draft and only commit
 *  to the model on Apply. */
export const KnowledgeGraphInspector: React.FC<Props> = ({
  model,
  selection,
  onChange,
  onHideNode,
  onBulkHideNodes,
  onRequestSelection,
  onClearSelection,
}) => {
  const [draft, setDraft] = useState<Draft>(null);
  const syncedSigRef = useRef<string | null>(null);
  // `undefined` — no pending switch; `null` — pending switch is "clear"; otherwise pending selection.
  const [pendingSelection, setPendingSelection] = useState<KgSelection | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const dirty = useMemo(() => isDirtyDraft(draft, model), [draft, model]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const isMulti = selection?.kind === 'multi';

  // Sync the local draft with the parent's selection. When the parent's
  // selection changes to something other than what we have synced, either
  // rebuild the draft (if clean) or ask the user to confirm discarding
  // their current edits.
  useEffect(() => {
    const nextSig = selectionSig(selection);
    if (nextSig === syncedSigRef.current) return;

    if (!dirtyRef.current) {
      syncedSigRef.current = nextSig;
      if (!selection || selection.kind === 'multi') {
        setDraft(null);
      } else if (selection.kind === 'node') {
        const node = model.nodes.find((n) => n.id === selection.id);
        setDraft(node ? makeNodeDraft(node) : null);
      } else {
        const edge = model.edges.find((e) => e.id === selection.id);
        setDraft(edge ? makeEdgeDraft(edge) : null);
      }
      return;
    }

    // Dirty — stash the requested selection, roll the parent back so the
    // inspector still reflects what the user is editing, and open confirm.
    setPendingSelection(selection);
    setConfirmOpen(true);
    onRequestSelection(selectionFromDraft(draftRef.current));
  }, [selection, model, onRequestSelection]);

  // If the element the draft is based on has disappeared from the model
  // (deleted externally), drop the draft and clear selection.
  useEffect(() => {
    if (!draft) return;
    const stillExists =
      draft.kind === 'node'
        ? model.nodes.some((n) => n.id === draft.originalId)
        : model.edges.some((e) => e.id === draft.originalId);
    if (!stillExists) {
      setDraft(null);
      syncedSigRef.current = null;
      onClearSelection();
    }
  }, [model, draft, onClearSelection]);

  const apply = () => {
    if (!draft || !dirty) return;
    const next = applyDraft(model, draft);
    onChange(next);
    setDraft(null);
    syncedSigRef.current = null;
    onClearSelection();
  };

  const discard = () => {
    if (!draft) return;
    if (draft.kind === 'node') {
      const node = model.nodes.find((n) => n.id === draft.originalId);
      if (node) setDraft(makeNodeDraft(node));
    } else {
      const edge = model.edges.find((e) => e.id === draft.originalId);
      if (edge) setDraft(makeEdgeDraft(edge));
    }
  };

  const requestClose = () => {
    if (dirty) {
      setPendingSelection(null);
      setConfirmOpen(true);
      return;
    }
    setDraft(null);
    syncedSigRef.current = null;
    onClearSelection();
  };

  const acceptSwitch = () => {
    setConfirmOpen(false);
    const target = pendingSelection;
    setPendingSelection(undefined);
    if (target === null) {
      setDraft(null);
      syncedSigRef.current = null;
      onClearSelection();
      return;
    }
    if (target === undefined) return;
    // target is a real selection — rebuild draft against the current model,
    // then ask the parent to set selection to it so the canvas aligns.
    if (target.kind === 'node') {
      const node = model.nodes.find((n) => n.id === target.id);
      setDraft(node ? makeNodeDraft(node) : null);
    } else if (target.kind === 'edge') {
      const edge = model.edges.find((e) => e.id === target.id);
      setDraft(edge ? makeEdgeDraft(edge) : null);
    } else {
      setDraft(null);
    }
    syncedSigRef.current = selectionSig(target);
    onRequestSelection(target);
  };

  const cancelSwitch = () => {
    setConfirmOpen(false);
    setPendingSelection(undefined);
  };

  const isNode = draft?.kind === 'node';
  const isEdge = draft?.kind === 'edge';
  const applyIsDestructive =
    !!draft &&
    (draft.deleteSelf ||
      (draft.kind === 'node' && draft.deletedEdgeIds.size > 0));

  const multi = selection?.kind === 'multi' ? selection : null;
  const multiNodes = multi?.nodeIds ?? [];
  const multiEdges = multi?.edgeIds ?? [];

  const bulkDelete = () => {
    if (!multi) return;
    const nodeSet = new Set(multi.nodeIds);
    const edgeSet = new Set(multi.edgeIds);
    const nodes = model.nodes.filter((n) => !nodeSet.has(n.id));
    const edges = model.edges.filter(
      (e) => !edgeSet.has(e.id) && !nodeSet.has(e.source) && !nodeSet.has(e.target),
    );
    onChange({ ...model, nodes, edges });
    setBulkDeleteOpen(false);
    onClearSelection();
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border/60 bg-background">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {isMulti
            ? `${multiNodes.length + multiEdges.length} selected`
            : isNode
              ? 'Node'
              : isEdge
                ? 'Relation'
                : 'Inspector'}
          {dirty && (
            <span
              className="inline-block size-2 rounded-full bg-amber-500"
              title="Unsaved changes"
            />
          )}
        </div>
        {(draft || isMulti) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={requestClose}
            className="h-7 w-7 p-0"
            title="Close"
          >
            <X className="size-4" />
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {!draft && !isMulti && (
          <p className="text-sm text-muted-foreground">
            Click a node or relation on the canvas to edit it here. Drag on
            empty canvas to box-select multiple. Hold Space to pan.
          </p>
        )}
        {isMulti && (
          <MultiSelectionSummary
            model={model}
            nodeIds={multiNodes}
            edgeIds={multiEdges}
          />
        )}
        {draft?.kind === 'node' && (
          <NodeFields
            draft={draft}
            model={model}
            onDraftChange={(d) => setDraft(d)}
            onCreateConstraintFor={(nodeType, propertyTargetId) => {
              // First commit any pending edits to the current class/property,
              // then add the new constraint node + linking edge, then select
              // the new node so the user lands in its inspector.
              const afterDraft = applyDraft(model, draft);
              const targetId = propertyTargetId ?? draft.originalId;
              const newNodeId = `${nodeType}:${makeRandomId()}`;
              const newEdgeIdValue = newEdgeId();
              const edgeIri =
                nodeType === 'nodeConstraint'
                  ? 'http://besser.local/kg#constraintTargetClass'
                  : 'http://besser.local/kg#constraintTargetProperty';
              const next: KnowledgeGraphData = {
                ...afterDraft,
                nodes: [
                  ...afterDraft.nodes,
                  {
                    id: newNodeId,
                    nodeType,
                    label:
                      nodeType === 'nodeConstraint' ? 'New node constraint' : 'New property constraint',
                    metadata: { constraintSpecs: [], isAnonymous: true },
                  },
                ],
                edges: [
                  ...afterDraft.edges,
                  {
                    id: newEdgeIdValue,
                    source: newNodeId,
                    target: targetId,
                    label: nodeType === 'nodeConstraint' ? 'targetClass' : 'path',
                    iri: edgeIri,
                  },
                ],
              };
              onChange(next);
              setDraft(null);
              syncedSigRef.current = null;
              onRequestSelection({ kind: 'node', id: newNodeId });
            }}
          />
        )}
        {draft?.kind === 'edge' && (
          <EdgeFields
            draft={draft}
            model={model}
            onDraftChange={(d) => setDraft(d)}
          />
        )}
      </div>

      {isMulti && (
        <footer className="space-y-2 border-t border-border/60 p-3">
          {multiNodes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                onBulkHideNodes(multiNodes);
                onClearSelection();
              }}
              title="Remove the selected nodes from the canvas without deleting them"
            >
              <EyeOff className="size-4" />
              Hide {multiNodes.length} {multiNodes.length === 1 ? 'node' : 'nodes'}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete selection
          </Button>
        </footer>
      )}

      {draft && (
        <footer className="space-y-2 border-t border-border/60 p-3">
          {draft.kind === 'node' && !draft.deleteSelf && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                onHideNode(draft.originalId);
                if (!dirty) {
                  setDraft(null);
                  syncedSigRef.current = null;
                  onClearSelection();
                }
              }}
              title="Remove the node from the canvas without deleting it from the model"
            >
              <EyeOff className="size-4" />
              Hide
            </Button>
          )}
          {!draft.deleteSelf && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              onClick={() => setDraft({ ...draft, deleteSelf: true })}
              title={
                draft.kind === 'node'
                  ? 'Stage deletion of this node (and all its connections)'
                  : 'Stage deletion of this relation'
              }
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          {draft.deleteSelf && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setDraft({ ...draft, deleteSelf: false })}
            >
              <Undo2 className="size-4" />
              Undo delete
            </Button>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!dirty}
              onClick={discard}
            >
              Discard
            </Button>
            <Button
              variant={applyIsDestructive ? 'destructive' : 'default'}
              size="sm"
              className="flex-1"
              disabled={!dirty}
              onClick={apply}
            >
              Apply
            </Button>
          </div>
        </footer>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Discard unsaved changes?"
        description="You have unsaved edits in the inspector. Discard them and continue?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={acceptSwitch}
        onCancel={cancelSwitch}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selection?"
        description={`This will permanently remove ${multiNodes.length} ${
          multiNodes.length === 1 ? 'node' : 'nodes'
        } and ${multiEdges.length} ${
          multiEdges.length === 1 ? 'relation' : 'relations'
        } from the model. Nodes also drop their attached relations. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={bulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </aside>
  );
};

const MultiSelectionSummary: React.FC<{
  model: KnowledgeGraphData;
  nodeIds: string[];
  edgeIds: string[];
}> = ({ model, nodeIds, edgeIds }) => {
  const nodeRows = useMemo(() => {
    const byId = new Map(model.nodes.map((n) => [n.id, n]));
    return nodeIds.map((id) => byId.get(id)).filter((n): n is KGNodeData => !!n);
  }, [model.nodes, nodeIds]);
  const edgeRows = useMemo(() => {
    const byId = new Map(model.edges.map((e) => [e.id, e]));
    return edgeIds.map((id) => byId.get(id)).filter((e): e is KGEdgeData => !!e);
  }, [model.edges, edgeIds]);

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">
        Drag any selected node to move the whole group. Hold Space to pan.
      </p>
      {nodeRows.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nodes ({nodeRows.length})
          </Label>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/50 bg-background">
            {nodeRows.map((n) => (
              <li
                key={n.id}
                className="flex items-center gap-2 border-b border-border/40 px-2 py-1 last:border-b-0"
                title={n.iri ?? n.id}
              >
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                  <KgShapeIcon type={n.nodeType} size={14} />
                </span>
                <span className="truncate">{(n.label ?? '').trim() || n.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {edgeRows.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Relations ({edgeRows.length})
          </Label>
          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border/50 bg-background">
            {edgeRows.map((e) => (
              <li
                key={e.id}
                className="truncate border-b border-border/40 px-2 py-1 last:border-b-0"
                title={e.iri ?? e.label ?? e.id}
              >
                {e.label ?? e.iri ?? e.id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const NodeFields: React.FC<{
  draft: NodeDraft;
  model: KnowledgeGraphData;
  onDraftChange: (next: NodeDraft) => void;
  /** Called when the user clicks "+ Add constraint" on a Class or Property
   *  inspector. Parent applies the current draft, materialises the new
   *  constraint node + linking edge, and selects the new node. */
  onCreateConstraintFor: (
    nodeType: 'nodeConstraint' | 'propertyConstraint',
    propertyTargetId?: string,
  ) => void;
}> = ({ draft, model, onDraftChange, onCreateConstraintFor }) => {
  const swatch = KG_NODE_COLORS[draft.fields.nodeType];
  const setFields = (patch: Partial<KGNodeData>) =>
    onDraftChange({ ...draft, fields: { ...draft.fields, ...patch } });

  return (
    <div className="space-y-3">
      {draft.deleteSelf && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          This node and all its connections will be deleted on Apply.
        </div>
      )}

      <div className="flex items-center gap-2 text-xs font-medium">
        <span
          className="inline-block h-4 w-4 rounded-sm"
          style={{
            background: swatch.fill,
            borderWidth: 2,
            borderColor: swatch.border,
            borderStyle: draft.fields.nodeType === 'blank' ? 'dashed' : 'solid',
          }}
        />
        <div className="flex-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={draft.fields.nodeType}
            onValueChange={(v) => setFields({ nodeType: v as KGNodeType })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KG_NODE_TYPES.map((t) => (
                <SelectItem key={t.type} value={t.type}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Label</Label>
        <Input
          value={draft.fields.label}
          onChange={(e) => {
            const v = e.target.value;
            setFields(draft.fields.nodeType === 'literal' ? { label: v, value: v } : { label: v });
          }}
          className="h-8"
        />
      </div>

      {draft.fields.nodeType === 'literal' ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <Input
              value={draft.fields.value ?? ''}
              onChange={(e) => setFields({ value: e.target.value })}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datatype IRI</Label>
            <Input
              value={draft.fields.datatype ?? ''}
              placeholder="http://www.w3.org/2001/XMLSchema#integer"
              onChange={(e) => setFields({ datatype: e.target.value || undefined })}
              className="h-8"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">IRI</Label>
          <Input
            value={draft.fields.iri ?? ''}
            placeholder="http://example.org/Person"
            onChange={(e) => setFields({ iri: e.target.value || undefined })}
            className="h-8"
          />
        </div>
      )}

      <div className="pt-1 text-xs text-muted-foreground">
        id: <code className="rounded bg-muted px-1 py-0.5">{draft.originalId}</code>
      </div>

      {(draft.fields.nodeType === 'nodeConstraint' || draft.fields.nodeType === 'propertyConstraint') && (
        <ConstraintSpecsEditor
          node={draft.fields}
          model={model}
          onSpecsChange={(specs: KGConstraintSpec[]) => {
            const meta = { ...(draft.fields.metadata ?? {}), constraintSpecs: specs };
            setFields({ metadata: meta });
          }}
        />
      )}

      {(draft.fields.nodeType === 'class' || draft.fields.nodeType === 'property') && (
        <AttachedConstraints
          ownerNode={draft.fields}
          model={model}
          onAddConstraint={(nodeType, propertyTargetId) =>
            onCreateConstraintFor(nodeType, propertyTargetId)
          }
        />
      )}

      <ConnectionsEditor draft={draft} model={model} onDraftChange={onDraftChange} />
    </div>
  );
};

/** "Constraints" section rendered inside the Class / Property inspector.
 *  Lists existing constraints attached to this node as chips (with one-line
 *  natural-language summaries) and exposes an "+ Add constraint" button that
 *  creates a fresh NodeConstraint / PropertyConstraint and wires it. */
const AttachedConstraints: React.FC<{
  ownerNode: KGNodeData;
  model: KnowledgeGraphData;
  onAddConstraint: (
    nodeType: 'nodeConstraint' | 'propertyConstraint',
    propertyTargetId?: string,
  ) => void;
}> = ({ ownerNode, model, onAddConstraint }) => {
  const CONSTRAINT_TARGET_CLASS = 'http://besser.local/kg#constraintTargetClass';
  const CONSTRAINT_TARGET_PROPERTY = 'http://besser.local/kg#constraintTargetProperty';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // For a class: collect NodeConstraints pointing at this class; for a
  // property: collect PropertyConstraints pointing at this property. Used to
  // render chips so the user knows what's already attached.
  const attached = useMemo(() => {
    const isClass = ownerNode.nodeType === 'class';
    const targetIri = isClass ? CONSTRAINT_TARGET_CLASS : CONSTRAINT_TARGET_PROPERTY;
    return model.edges
      .filter((e) => e.iri === targetIri && e.target === ownerNode.id)
      .map((e) => model.nodes.find((n) => n.id === e.source))
      .filter(Boolean) as KGNodeData[];
  }, [model.edges, model.nodes, ownerNode.id, ownerNode.nodeType]);

  // For a class: list properties whose rdfs:domain is this class — used by
  // the "Constrain a property of this class…" sub-menu.
  const propertiesOfClass = useMemo(() => {
    if (ownerNode.nodeType !== 'class') return [];
    const domainPred = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const ids = new Set<string>();
    for (const e of model.edges) {
      if (e.iri === domainPred && e.target === ownerNode.id) ids.add(e.source);
    }
    return Array.from(ids)
      .map((id) => model.nodes.find((n) => n.id === id))
      .filter((n): n is KGNodeData => !!n && n.nodeType === 'property');
  }, [model.edges, model.nodes, ownerNode.id, ownerNode.nodeType]);

  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Constraints ({attached.length})
        </Label>
        <div ref={menuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              if (ownerNode.nodeType === 'property') {
                onAddConstraint('propertyConstraint');
              } else {
                setMenuOpen((o) => !o);
              }
            }}
          >
            <Plus className="size-3.5" />
            Add constraint
          </Button>
          {menuOpen && ownerNode.nodeType === 'class' && (
            <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border bg-popover text-popover-foreground shadow-md">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted/60"
                onClick={() => {
                  setMenuOpen(false);
                  onAddConstraint('nodeConstraint');
                }}
              >
                <div className="font-medium">Constrain this class…</div>
                <div className="text-muted-foreground">
                  E.g. disjoint with, has key, closed shape.
                </div>
              </button>
              <div className="border-t" />
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Constrain a property of this class
              </div>
              {propertiesOfClass.length === 0 && (
                <div className="px-3 py-1.5 text-xs italic text-muted-foreground">
                  No properties in this class's domain yet.
                </div>
              )}
              {propertiesOfClass.map((prop) => (
                <button
                  key={prop.id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted/60"
                  onClick={() => {
                    setMenuOpen(false);
                    onAddConstraint('propertyConstraint', prop.id);
                  }}
                >
                  {prop.label || prop.id}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {attached.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {attached.map((c) => (
            <li
              key={c.id}
              className="rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-[11px] text-purple-900 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-100"
              title={c.id}
            >
              {c.label || (c.nodeType === 'nodeConstraint' ? 'Node constraint' : 'Property constraint')}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs italic text-muted-foreground">No constraints yet.</p>
      )}
    </div>
  );
};

const ConnectionsEditor: React.FC<{
  draft: NodeDraft;
  model: KnowledgeGraphData;
  onDraftChange: (next: NodeDraft) => void;
}> = ({ draft, model, onDraftChange }) => {
  const [adderOpen, setAdderOpen] = useState(false);

  // Union of model edges touching this node + staged additions.
  const rows = useMemo(() => {
    const existing = model.edges.filter(
      (e) => e.source === draft.originalId || e.target === draft.originalId,
    );
    return [
      ...existing.map((e) => ({ edge: e, isNew: false })),
      ...draft.addedEdges.map((e) => ({ edge: e, isNew: true })),
    ];
  }, [model.edges, draft.originalId, draft.addedEdges]);

  const toggleDeleteExisting = (edgeId: string) => {
    const set = new Set(draft.deletedEdgeIds);
    if (set.has(edgeId)) set.delete(edgeId);
    else set.add(edgeId);
    onDraftChange({ ...draft, deletedEdgeIds: set });
  };

  const removeAddedEdge = (edgeId: string) => {
    onDraftChange({
      ...draft,
      addedEdges: draft.addedEdges.filter((e) => e.id !== edgeId),
    });
  };

  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Connections ({rows.length})
        </Label>
        {!adderOpen && !draft.deleteSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setAdderOpen(true)}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        )}
      </div>

      {adderOpen && (
        <AddConnectionForm
          draft={draft}
          model={model}
          onCancel={() => setAdderOpen(false)}
          onStage={(edge) => {
            onDraftChange({ ...draft, addedEdges: [...draft.addedEdges, edge] });
            setAdderOpen(false);
          }}
        />
      )}

      {rows.length === 0 && !adderOpen && (
        <p className="text-xs text-muted-foreground">No connections.</p>
      )}

      <ul className="space-y-1">
        {rows.map(({ edge, isNew }) => (
          <ConnectionRow
            key={edge.id}
            edge={edge}
            nodeId={draft.originalId}
            model={model}
            isNew={isNew}
            isMarkedForDelete={draft.deletedEdgeIds.has(edge.id)}
            onToggleDeleteExisting={() => toggleDeleteExisting(edge.id)}
            onRemoveAdded={() => removeAddedEdge(edge.id)}
          />
        ))}
      </ul>
    </div>
  );
};

const ConnectionRow: React.FC<{
  edge: KGEdgeData;
  nodeId: string;
  model: KnowledgeGraphData;
  isNew: boolean;
  isMarkedForDelete: boolean;
  onToggleDeleteExisting: () => void;
  onRemoveAdded: () => void;
}> = ({ edge, nodeId, model, isNew, isMarkedForDelete, onToggleDeleteExisting, onRemoveAdded }) => {
  const outgoing = edge.source === nodeId;
  const otherId = outgoing ? edge.target : edge.source;
  const other = model.nodes.find((n) => n.id === otherId);
  const otherLabel = other?.label ?? otherId;
  const predicate = edge.label ?? edge.iri ?? '(no predicate)';

  return (
    <li
      className={
        'flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs ' +
        (isMarkedForDelete ? 'opacity-60' : '')
      }
    >
      {outgoing ? (
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className={'min-w-0 flex-1 ' + (isMarkedForDelete ? 'line-through' : '')}>
        <div className="truncate font-medium" title={predicate}>
          {predicate}
        </div>
        <div className="truncate text-[11px] text-muted-foreground" title={otherLabel}>
          {otherLabel}
        </div>
      </div>
      {isNew && (
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
          new
        </span>
      )}
      {isMarkedForDelete && (
        <span className="text-[10px] italic text-muted-foreground">removing</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={isNew ? onRemoveAdded : onToggleDeleteExisting}
        title={
          isNew
            ? 'Discard this staged connection'
            : isMarkedForDelete
              ? 'Undo delete'
              : 'Remove this connection'
        }
      >
        {isMarkedForDelete ? <Undo2 className="size-3.5" /> : <Trash2 className="size-3.5" />}
      </Button>
    </li>
  );
};

/** Catalog of fixed predicates for constraint-node connections. The
 *  inspector restricts the predicate picker to entries from this table
 *  whenever the source (or, for incoming edges, the target) of the edge is
 *  a constraint node — this stops the user from inventing predicates that
 *  the exporter wouldn't recognise. Entries are keyed by the source side
 *  of the directed edge; each carries the canonical IRI plus the allowed
 *  target node types.
 *
 *  Pre-existing free-text predicates remain available for non-constraint
 *  source nodes (Class / Property / Individual / Literal / Blank) so the
 *  generic KG authoring flow is untouched.
 */
interface ConstraintPredicateOption {
  iri: string;
  label: string;
  targetTypes: KGNodeType[];
  description: string;
}

const CONSTRAINT_PREDICATES_BY_SOURCE: Partial<Record<KGNodeType, ConstraintPredicateOption[]>> = {
  nodeConstraint: [
    {
      iri: 'http://besser.local/kg#constraintTargetClass',
      label: 'constraintTargetClass',
      targetTypes: ['class'],
      description: 'Apply this NodeConstraint to a class.',
    },
    {
      iri: 'http://www.w3.org/ns/shacl#property',
      label: 'property',
      targetTypes: ['propertyConstraint'],
      description: 'Group a PropertyConstraint under this NodeConstraint (sh:property).',
    },
  ],
  propertyConstraint: [
    {
      iri: 'http://besser.local/kg#constraintTargetProperty',
      label: 'constraintTargetProperty',
      targetTypes: ['property'],
      description: 'Apply this PropertyConstraint to a property.',
    },
  ],
};

const AddConnectionForm: React.FC<{
  draft: NodeDraft;
  model: KnowledgeGraphData;
  onCancel: () => void;
  onStage: (edge: KGEdgeData) => void;
}> = ({ draft, model, onCancel, onStage }) => {
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [predicate, setPredicate] = useState('');
  // For constraint sources we use a dropdown (selectedOption stores the
  // catalog entry); for everything else the free-text `predicate` is used.
  const [selectedOption, setSelectedOption] = useState<ConstraintPredicateOption | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | KGNodeType>('all');
  const [query, setQuery] = useState('');

  // Which "side" of the to-be-built edge is the constraint node? That's the
  // side we restrict to fixed predicates. For an outgoing edge, the draft
  // node is the source; for an incoming edge, the draft node is the target,
  // so the constrained "source side" is the OTHER node — which means the
  // valid predicate set depends on what the other node is. For simplicity
  // we restrict predicates only when the draft node is the source side of
  // the resulting edge (outgoing from the inspector's POV).
  const constraintOptions = useMemo<ConstraintPredicateOption[] | null>(() => {
    if (direction !== 'outgoing') return null;
    return CONSTRAINT_PREDICATES_BY_SOURCE[draft.fields.nodeType] ?? null;
  }, [direction, draft.fields.nodeType]);

  // Whenever the predicate set changes, default the selection to the first
  // option (or clear it if none).
  useEffect(() => {
    if (constraintOptions && constraintOptions.length > 0) {
      setSelectedOption((prev) => prev ?? constraintOptions[0]);
    } else {
      setSelectedOption(null);
    }
  }, [constraintOptions]);

  // Allowed target node types in the current context. The constraint-source
  // path (NodeConstraint / PropertyConstraint with a fixed predicate set)
  // takes precedence; otherwise we fall back to the OWL2 DL edge-rule matrix.
  // For an incoming edge, "target" of the form means the OTHER node — we
  // need the inverse rule (which source types may point at the draft node).
  const allowedTargetTypes = useMemo<KGNodeType[]>(() => {
    if (constraintOptions && selectedOption) return selectedOption.targetTypes;
    const draftType = draft.fields.nodeType;
    if (direction === 'outgoing') {
      return KG_EDGE_RULES[draftType]?.allowed ?? [];
    }
    return sourceTypesAllowedToTarget(draftType);
  }, [constraintOptions, selectedOption, direction, draft.fields.nodeType]);

  // Force the type-filter chips to a valid choice when allowedTargetTypes
  // narrows below the current selection.
  useEffect(() => {
    if (typeFilter !== 'all' && !allowedTargetTypes.includes(typeFilter as KGNodeType)) {
      setTypeFilter('all');
    }
  }, [allowedTargetTypes, typeFilter]);

  const suggestions = useMemo(() => derivePredicateSuggestions(model), [model]);
  const candidateNodes = useMemo(() => {
    return model.nodes
      .filter((n) => n.id !== draft.originalId)
      .filter((n) => allowedTargetTypes.includes(n.nodeType));
  }, [model.nodes, draft.originalId, allowedTargetTypes]);
  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidateNodes.filter((n) => {
      if (typeFilter !== 'all' && n.nodeType !== typeFilter) return false;
      if (!q) return true;
      const label = (n.label ?? '').toLowerCase();
      const iri = (n.iri ?? '').toLowerCase();
      const id = (n.id ?? '').toLowerCase();
      return label.includes(q) || iri.includes(q) || id.includes(q);
    });
  }, [candidateNodes, typeFilter, query]);

  // Visible type-filter chips: only the types currently permitted as the
  // other end of the edge (so "All" + each allowed).
  const visibleTypeChips = useMemo(
    () => KG_NODE_TYPES.filter((t) => allowedTargetTypes.includes(t.type)),
    [allowedTargetTypes],
  );

  // If the rule produces no permitted targets (e.g. an outgoing edge from a
  // literal), surface a short explanation in place of the picker.
  const noTargetsReason = useMemo<string | null>(() => {
    if (allowedTargetTypes.length > 0) return null;
    const draftType = draft.fields.nodeType;
    return KG_EDGE_RULES[draftType]?.reason
      ?? 'No valid target types for this node under OWL2 DL.';
  }, [allowedTargetTypes, draft.fields.nodeType]);

  const stage = () => {
    if (!targetId) return;
    const source = direction === 'outgoing' ? draft.originalId : targetId;
    const target = direction === 'outgoing' ? targetId : draft.originalId;
    let edge: KGEdgeData;
    if (constraintOptions && selectedOption) {
      // Constraint-source path: emit the canonical IRI + a matching label so
      // the preflight / exporter recognise it.
      edge = {
        id: newEdgeId(),
        source,
        target,
        label: selectedOption.label,
        iri: selectedOption.iri,
      };
    } else {
      const trimmed = predicate.trim();
      edge = {
        id: newEdgeId(),
        source,
        target,
        ...(trimmed ? { label: trimmed } : {}),
      };
    }
    onStage(edge);
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background p-2">
      <div className="text-xs font-semibold">Add connection</div>
      <div className="grid grid-cols-2 gap-1">
        <Button
          variant={direction === 'outgoing' ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setDirection('outgoing')}
        >
          <ArrowRight className="size-3.5" />
          Outgoing
        </Button>
        <Button
          variant={direction === 'incoming' ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setDirection('incoming')}
        >
          <ArrowLeft className="size-3.5" />
          Incoming
        </Button>
      </div>

      {constraintOptions ? (
        // For NodeConstraint / PropertyConstraint sources we only expose the
        // catalog of internal predicates — typing a free-text predicate here
        // would produce an edge the exporter can't recognise.
        <div className="space-y-1">
          <Label className="text-xs">Predicate</Label>
          <Select
            value={selectedOption?.iri ?? ''}
            onValueChange={(v) => {
              const next = constraintOptions.find((o) => o.iri === v) ?? null;
              setSelectedOption(next);
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {constraintOptions.map((opt) => (
                <SelectItem key={opt.iri} value={opt.iri}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOption && (
            <p className="text-[11px] italic text-muted-foreground">
              {selectedOption.description}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Predicate (type or pick)</Label>
          <Input
            value={predicate}
            onChange={(e) => setPredicate(e.target.value)}
            placeholder="e.g. knows, type, hasName"
            list={DATALIST_ID}
            className="h-8"
          />
          <datalist id={DATALIST_ID}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">
          {direction === 'outgoing' ? 'Target' : 'Source'} node
        </Label>
        {noTargetsReason ? (
          <div className="rounded-md border border-amber-300/60 bg-amber-50/70 p-2 text-[11px] italic text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {noTargetsReason}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by label / IRI"
                className="h-7 pl-7 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <NodePickerChip
                active={typeFilter === 'all'}
                onClick={() => setTypeFilter('all')}
                label="All"
              />
              {visibleTypeChips.map((t) => (
                <NodePickerChip
                  key={t.type}
                  active={typeFilter === t.type}
                  onClick={() => setTypeFilter(t.type)}
                  label={t.label}
                  icon={<KgShapeIcon type={t.type} size={12} />}
                />
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border/50 bg-background">
              {candidateNodes.length === 0 && (
                <div className="p-2 text-[11px] text-muted-foreground">
                  No other nodes in the model.
                </div>
              )}
              {candidateNodes.length > 0 && filteredNodes.length === 0 && (
                <div className="p-2 text-[11px] text-muted-foreground">No nodes match.</div>
              )}
              {filteredNodes.map((n) => {
                const selected = n.id === targetId;
                return (
                  <label
                    key={n.id}
                    className={
                      'flex cursor-pointer items-center gap-2 border-b border-border/40 px-2 py-1.5 text-xs last:border-b-0 hover:bg-muted/50 ' +
                      (selected ? 'bg-brand/10' : '')
                    }
                    title={n.iri ?? n.id}
                  >
                    <input
                      type="radio"
                      name="kg-add-connection-target"
                      checked={selected}
                      onChange={() => setTargetId(n.id)}
                      className="size-3.5"
                    />
                    <span className="inline-flex size-4 shrink-0 items-center justify-center">
                      <KgShapeIcon type={n.nodeType} size={14} />
                    </span>
                    <span className="truncate">{pickerRowLabel(n)}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={!targetId || noTargetsReason !== null}
          onClick={stage}
        >
          Stage
        </Button>
      </div>
    </div>
  );
};

function pickerRowLabel(n: KGNodeData): string {
  const raw = (n.label ?? '').trim();
  if (raw) return raw;
  if (n.nodeType === 'literal') return n.value?.toString() || '""';
  return n.id;
}

const NodePickerChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
      active
        ? 'border-brand bg-brand/15 text-brand-dark dark:text-brand'
        : 'border-border/50 text-muted-foreground hover:bg-muted'
    }`}
  >
    {icon && <span className="inline-flex size-3 items-center justify-center">{icon}</span>}
    {label}
  </button>
);

const EdgeFields: React.FC<{
  draft: EdgeDraft;
  model: KnowledgeGraphData;
  onDraftChange: (next: EdgeDraft) => void;
}> = ({ draft, model, onDraftChange }) => {
  const source = model.nodes.find((n) => n.id === draft.fields.source);
  const target = model.nodes.find((n) => n.id === draft.fields.target);
  const setFields = (patch: Partial<KGEdgeData>) =>
    onDraftChange({ ...draft, fields: { ...draft.fields, ...patch } });

  return (
    <div className="space-y-3">
      {draft.deleteSelf && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          This relation will be deleted on Apply.
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Label</Label>
        <Input
          value={draft.fields.label ?? ''}
          placeholder="e.g. knows, type, hasName"
          onChange={(e) => setFields({ label: e.target.value || undefined })}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Predicate IRI</Label>
        <Input
          value={draft.fields.iri ?? ''}
          placeholder="http://xmlns.com/foaf/0.1/knows"
          onChange={(e) => setFields({ iri: e.target.value || undefined })}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Source</Label>
        <ReadOnlyBadge label={source?.label ?? draft.fields.source} iri={source?.iri ?? source?.id} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Target</Label>
        <ReadOnlyBadge label={target?.label ?? draft.fields.target} iri={target?.iri ?? target?.id} />
      </div>
      <div className="pt-1 text-xs text-muted-foreground">
        id: <code className="rounded bg-muted px-1 py-0.5">{draft.originalId}</code>
      </div>
    </div>
  );
};

const ReadOnlyBadge: React.FC<{ label: string; iri?: string }> = ({ label, iri }) => (
  <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-sm">
    <div className="font-medium">{label}</div>
    {iri && iri !== label && (
      <div className="truncate text-[11px] text-muted-foreground" title={iri}>
        {iri}
      </div>
    )}
  </div>
);
