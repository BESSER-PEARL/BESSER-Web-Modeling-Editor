import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { KnowledgeGraphData, KGNodeData, KGEdgeData } from './types';
import { KG_NODE_COLORS } from './stylesheet';

export type KgSelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

interface Props {
  model: KnowledgeGraphData;
  selection: KgSelection;
  onChange: (next: KnowledgeGraphData) => void;
  onClearSelection: () => void;
}

/** Right-hand inspector panel. Always mounted; shows "no selection" when
 *  nothing is picked. Mirrors the class-diagram properties panel pattern
 *  (pinned, resizable-optional, field-based — not a modal). */
export const KnowledgeGraphInspector: React.FC<Props> = ({ model, selection, onChange, onClearSelection }) => {
  const selectedNode = useMemo(() => {
    if (!selection || selection.kind !== 'node') return null;
    return model.nodes.find((n) => n.id === selection.id) ?? null;
  }, [model.nodes, selection]);
  const selectedEdge = useMemo(() => {
    if (!selection || selection.kind !== 'edge') return null;
    return model.edges.find((e) => e.id === selection.id) ?? null;
  }, [model.edges, selection]);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border/60 bg-background">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="text-sm font-semibold">
          {selectedNode ? 'Node' : selectedEdge ? 'Relation' : 'Inspector'}
        </div>
        {(selectedNode || selectedEdge) && (
          <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-7 w-7 p-0" title="Clear selection">
            <X className="size-4" />
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {!selectedNode && !selectedEdge && (
          <p className="text-sm text-muted-foreground">
            Click a node or relation on the canvas to edit its fields here.
          </p>
        )}
        {selectedNode && (
          <NodeFields node={selectedNode} model={model} onChange={onChange} />
        )}
        {selectedEdge && (
          <EdgeFields edge={selectedEdge} model={model} onChange={onChange} />
        )}
      </div>

      {(selectedNode || selectedEdge) && (
        <footer className="border-t border-border/60 p-3">
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={() => {
              if (selectedNode) {
                const remaining = model.nodes.filter((n) => n.id !== selectedNode.id);
                const edges = model.edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id);
                onChange({ ...model, nodes: remaining, edges });
              } else if (selectedEdge) {
                onChange({ ...model, edges: model.edges.filter((e) => e.id !== selectedEdge.id) });
              }
              onClearSelection();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </footer>
      )}
    </aside>
  );
};

const NodeFields: React.FC<{
  node: KGNodeData;
  model: KnowledgeGraphData;
  onChange: (next: KnowledgeGraphData) => void;
}> = ({ node, model, onChange }) => {
  const swatch = KG_NODE_COLORS[node.nodeType];
  const update = (patch: Partial<KGNodeData>) => {
    const nodes = model.nodes.map((n) => (n.id === node.id ? { ...n, ...patch } : n));
    onChange({ ...model, nodes });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <span
          className="inline-block h-4 w-4 rounded-sm"
          style={{
            background: swatch.fill,
            borderWidth: 2,
            borderColor: swatch.border,
            borderStyle: node.nodeType === 'blank' ? 'dashed' : 'solid',
          }}
        />
        <span className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide text-muted-foreground">
          {node.nodeType}
        </span>
        <span className="text-[11px] text-muted-foreground">(type is fixed)</span>
      </div>

      <DebouncedField
        key={`node-label-${node.id}`}
        label="Label"
        value={node.label}
        onCommit={(v) => update({ label: v, ...(node.nodeType === 'literal' ? { value: v } : {}) })}
      />

      {node.nodeType === 'literal' ? (
        <>
          <DebouncedField
            key={`node-value-${node.id}`}
            label="Value"
            value={node.value ?? ''}
            onCommit={(v) => update({ value: v })}
          />
          <DebouncedField
            key={`node-datatype-${node.id}`}
            label="Datatype IRI"
            value={node.datatype ?? ''}
            placeholder="http://www.w3.org/2001/XMLSchema#integer"
            onCommit={(v) => update({ datatype: v || undefined })}
          />
        </>
      ) : (
        <DebouncedField
          key={`node-iri-${node.id}`}
          label="IRI"
          value={node.iri ?? ''}
          placeholder="http://example.org/Person"
          onCommit={(v) => update({ iri: v || undefined })}
        />
      )}

      <div className="pt-1 text-xs text-muted-foreground">
        id: <code className="rounded bg-muted px-1 py-0.5">{node.id}</code>
      </div>
    </div>
  );
};

const EdgeFields: React.FC<{
  edge: KGEdgeData;
  model: KnowledgeGraphData;
  onChange: (next: KnowledgeGraphData) => void;
}> = ({ edge, model, onChange }) => {
  const source = model.nodes.find((n) => n.id === edge.source);
  const target = model.nodes.find((n) => n.id === edge.target);
  const update = (patch: Partial<KGEdgeData>) => {
    const edges = model.edges.map((e) => (e.id === edge.id ? { ...e, ...patch } : e));
    onChange({ ...model, edges });
  };
  return (
    <div className="space-y-3">
      <DebouncedField
        key={`edge-label-${edge.id}`}
        label="Label"
        value={edge.label ?? ''}
        placeholder="e.g. knows, type, hasName"
        onCommit={(v) => update({ label: v || undefined })}
      />
      <DebouncedField
        key={`edge-iri-${edge.id}`}
        label="Predicate IRI"
        value={edge.iri ?? ''}
        placeholder="http://xmlns.com/foaf/0.1/knows"
        onCommit={(v) => update({ iri: v || undefined })}
      />
      <div className="space-y-1">
        <Label className="text-xs">Source</Label>
        <ReadOnlyBadge label={source?.label ?? edge.source} iri={source?.iri ?? source?.id} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Target</Label>
        <ReadOnlyBadge label={target?.label ?? edge.target} iri={target?.iri ?? target?.id} />
      </div>
      <div className="pt-1 text-xs text-muted-foreground">
        id: <code className="rounded bg-muted px-1 py-0.5">{edge.id}</code>
      </div>
    </div>
  );
};

const ReadOnlyBadge: React.FC<{ label: string; iri?: string }> = ({ label, iri }) => (
  <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-sm">
    <div className="font-medium">{label}</div>
    {iri && iri !== label && (
      <div className="truncate text-[11px] text-muted-foreground" title={iri}>{iri}</div>
    )}
  </div>
);

/** Text field that debounces commits (300 ms) and flushes on blur, so typing
 *  doesn't thrash the save pipeline. */
const DebouncedField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}> = ({ label, value, placeholder, onCommit }) => {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onCommit(local), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        className="h-8"
      />
    </div>
  );
};
