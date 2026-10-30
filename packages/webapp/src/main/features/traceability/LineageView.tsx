import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight, Crosshair, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TraceArtifact, TraceEvidence } from '../../shared/types/traceability';
import { isCodeArtifact, isModelArtifact, isPromptArtifact } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import {
  changesSince,
  diagramsOf,
  fragmentLines,
  historyOf,
  isDeleted,
  modelChildren,
  qualifiedName,
} from '../../shared/traceability/traceQueries';
import type { Lineage, LineageEdge, LineageEdgeState, LineageGroup, LineageNode } from '../../shared/traceability/lineage';
import { lineageOf } from '../../shared/traceability/lineage';
import { actorNames, describeChange, elementTypeLabel, formatTime, operationLabel } from './traceLabels';

/** Stroke colour per evidence kind; a link that may no longer hold is amber whatever its evidence. */
const EVIDENCE_STROKES: Record<TraceEvidence['type'], string> = {
  RuleEvidence: 'stroke-slate-400 dark:stroke-slate-500',
  AIEvidence: 'stroke-violet-500',
  ChangeEvidence: 'stroke-sky-500',
};
const STALE_STROKE = 'stroke-amber-500';
/** Above this many nodes, generated files start collapsed to one row each (a diagram's lineage). */
export const LINEAGE_DETAIL_LIMIT = 30;

interface LineageViewProps {
  index: TraceIndex;
  /** The artifact the lineage starts from; the first diagram when null. */
  rootId: string | null;
  onRootChange: (artifactId: string) => void;
  onOpenElement: (artifactId: string) => void;
}

type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string };

/** What an artifact was derived from and what was derived from it, as columns linked left to right. */
export const LineageView: React.FC<LineageViewProps> = ({ index, rootId, onRootChange, onOpenElement }) => {
  const { t } = useTranslation();
  const diagrams = useMemo(() => diagramsOf(index), [index]);
  const root = (rootId && index.artifacts.has(rootId) ? rootId : null) ?? diagrams[0]?.id ?? null;
  const [olderGenerations, setOlderGenerations] = useState(false);
  const lineage = useMemo(
    () => (root ? lineageOf(index, root, { latestGenerationOnly: !olderGenerations }) : null),
    [index, root, olderGenerations],
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const selected: Selection | null = selection && lineage && isShown(lineage, selection) ? selection : root ? { kind: 'node', id: root } : null;

  if (!root || !lineage) return <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.elements.empty')}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <RootPicker index={index} rootId={root} onChange={(id) => { setSelection(null); onRootChange(id); }} />
        <div className="flex items-center gap-2">
          <Checkbox id="lineage-older" checked={olderGenerations} onCheckedChange={(checked) => setOlderGenerations(checked === true)} />
          <Label htmlFor="lineage-older" className="text-xs font-normal">{t('traceability.lineage.olderGenerations')}</Label>
        </div>
        <Legend />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LineageGraph key={root} index={index} lineage={lineage} selected={selected} onSelect={setSelection} />
        {selected?.kind === 'edge' ? (
          <EdgeDetail index={index} edge={lineage.edges.find((e) => e.link.id === selected.id)!} onSelectNode={(id) => setSelection({ kind: 'node', id })} />
        ) : (
          <NodeDetail
            index={index}
            node={lineage.nodes.get(selected?.id ?? root)!}
            isRoot={(selected?.id ?? root) === root}
            onFocus={(id) => { setSelection(null); onRootChange(id); }}
            onOpenElement={onOpenElement}
          />
        )}
      </div>
    </div>
  );
};

const isShown = (lineage: Lineage, selection: Selection) =>
  selection.kind === 'node' ? lineage.nodes.has(selection.id) : lineage.edges.some((e) => e.link.id === selection.id);

/** Diagrams with their elements, to pick where the lineage starts. */
const RootPicker: React.FC<{ index: TraceIndex; rootId: string; onChange: (id: string) => void }> = ({ index, rootId, onChange }) => {
  const { t } = useTranslation();
  const root = index.artifacts.get(rootId);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('traceability.lineage.startFrom')}</span>
      <Select value={rootId} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-64" aria-label={t('traceability.lineage.startFrom')}>
          <SelectValue>{root ? (isModelArtifact(root) ? qualifiedName(index, root) : root.name) : ''}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {diagramsOf(index).map((diagram) => (
            <SelectGroup key={diagram.id}>
              <SelectLabel>{elementTypeLabel(t, diagram.elementType)}</SelectLabel>
              <SelectItem value={diagram.id} className="font-semibold">{diagram.name}</SelectItem>
              {modelChildren(index, diagram.id).map((element) => (
                <SelectItem key={element.id} value={element.id} className="pl-6">
                  {element.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          {root && !isModelArtifact(root) && <SelectItem value={root.id}>{root.name}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
};

const Legend: React.FC = () => {
  const { t } = useTranslation();
  const line = (className: string, dashed = false) => (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" strokeWidth="2.5" strokeDasharray={dashed ? '4 3' : undefined} className={className} />
    </svg>
  );
  return (
    <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">{line(EVIDENCE_STROKES.RuleEvidence)}{t('traceability.lineage.legend.rule')}</span>
      <span className="flex items-center gap-1">{line(EVIDENCE_STROKES.AIEvidence)}{t('traceability.lineage.legend.ai')}</span>
      <span className="flex items-center gap-1">{line(STALE_STROKE)}{t('traceability.lineage.legend.suspect')}</span>
      <span className="flex items-center gap-1">{line(STALE_STROKE, true)}{t('traceability.lineage.legend.staleUpstream')}</span>
      <span>{t('traceability.lineage.legend.confidence')}</span>
    </div>
  );
};

/** One connector: a link, or the links from one node into a collapsed file, bundled. */
interface EdgeGeometry {
  edges: LineageEdge[];
  /** The collapsed file the bundle goes into (clicking its pill expands it). */
  into?: string;
  path: string;
  mid: { x: number; y: number };
}

const groupAnchor = (group: LineageGroup) => (group.containerIsNode ? group.container.id : `group:${group.container.id}`);
const isCodeGroup = (group: LineageGroup) => group.container.type === 'CodeArtifact' && group.nodes.length > 0;

const LineageGraph: React.FC<{
  index: TraceIndex;
  lineage: Lineage;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
}> = ({ index, lineage, selected, onSelect }) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const [geometry, setGeometry] = useState<EdgeGeometry[]>([]);
  // Files whose open state the user flipped; a large lineage starts with its files collapsed.
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const collapsedByDefault = lineage.nodes.size > LINEAGE_DETAIL_LIMIT;
  const toggle = (id: string) =>
    setToggled((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const groups = lineage.columns.flat();
  const isCollapsed = (group: LineageGroup) => isCodeGroup(group) && collapsedByDefault !== toggled.has(group.container.id);

  // Where each node is drawn: itself, or the header of the collapsed file that hides it.
  const anchorOf = useMemo(() => {
    const hidden = new Map<string, { anchor: string; container: string }>();
    for (const group of groups) {
      if (!isCollapsed(group)) continue;
      for (const node of group.nodes) hidden.set(node.artifact.id, { anchor: groupAnchor(group), container: group.container.id });
    }
    return (id: string) => hidden.get(id) ?? { anchor: id, container: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineage, toggled, collapsedByDefault]);

  // Connectors are drawn between the measured boxes, after layout and whenever the canvas resizes.
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return undefined;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const box = (id: string) => anchors.current.get(id)?.getBoundingClientRect();
      const bundles = new Map<string, { edges: LineageEdge[]; from: string; to: string; into?: string }>();
      for (const edge of lineage.edges) {
        const from = anchorOf(edge.link.sourceId).anchor;
        const target = anchorOf(edge.link.targetId);
        const key = `${from}->${target.anchor}`;
        const bundle = bundles.get(key);
        if (bundle) bundle.edges.push(edge);
        else bundles.set(key, { edges: [edge], from, to: target.anchor, into: target.container });
      }
      setGeometry(
        [...bundles.values()].flatMap(({ edges, from: fromId, to: toId, into }) => {
          const from = box(fromId);
          const to = box(toId);
          if (!from || !to) return [];
          const sx = from.right - origin.left + element.scrollLeft;
          const sy = from.top + from.height / 2 - origin.top + element.scrollTop;
          const tx = to.left - origin.left + element.scrollLeft;
          const ty = to.top + to.height / 2 - origin.top + element.scrollTop;
          const bend = Math.max(40, (tx - sx) / 2);
          return [{ edges, into, path: `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`, mid: { x: (sx + tx) / 2, y: (sy + ty) / 2 } }];
        }),
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [lineage, anchorOf]);

  const register = (id: string) => (node: HTMLElement | null) => {
    if (node) anchors.current.set(id, node);
    else anchors.current.delete(id);
  };
  const isSelected = (kind: Selection['kind'], id: string) => selected?.kind === kind && selected.id === id;

  return (
    <div ref={canvas} className="relative min-h-[320px] overflow-auto rounded-lg border border-border bg-muted/20 p-4">
      <svg className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible" aria-hidden>
        {geometry.map(({ edges, path }) => {
          const edge = bundleLook(edges);
          return (
            <path
              key={edges[0].link.id}
              d={path}
              fill="none"
              strokeWidth={(1 + 2.5 * (edge.link.confidence?.value ?? 1)) * (edges.some((e) => isSelected('edge', e.link.id)) ? 1.6 : 1)}
              strokeOpacity={0.35 + 0.65 * (edge.link.confidence?.value ?? 1)}
              strokeDasharray={edge.state === 'staleUpstream' ? '6 4' : undefined}
              className={edge.state === 'current' ? EVIDENCE_STROKES[edge.link.evidence[0]?.type ?? 'RuleEvidence'] : STALE_STROKE}
            />
          );
        })}
      </svg>
      <div className="relative flex min-w-max items-start gap-28">
        {lineage.columns.map((groups, column) => (
          <div key={column} className="flex w-60 flex-col gap-3">
            {groups.map((group) => (
              <div key={group.container.id} className="rounded-md border border-border bg-card shadow-sm">
                {group.containerIsNode ? (
                  <NodeButton
                    index={index}
                    node={lineage.nodes.get(group.container.id)!}
                    header
                    root={group.container.id === lineage.rootId}
                    selected={isSelected('node', group.container.id)}
                    anchor={register(group.container.id)}
                    onClick={() => onSelect({ kind: 'node', id: group.container.id })}
                  />
                ) : (
                  <div ref={register(groupAnchor(group))} className="truncate border-b border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                    {containerCaption(t, group.container)}
                  </div>
                )}
                {isCodeGroup(group) && (
                  <button
                    type="button"
                    onClick={() => toggle(group.container.id)}
                    aria-expanded={!isCollapsed(group)}
                    className="flex w-full items-center gap-1 px-2.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
                  >
                    {isCollapsed(group) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {t('traceability.lineage.fragments', { count: group.nodes.length })}
                    {isCollapsed(group) && group.nodes.some((n) => n.stale) && (
                      <AlertTriangle className="ml-auto size-3.5 text-amber-500" aria-label={t('traceability.status.suspect')} />
                    )}
                  </button>
                )}
                {group.nodes.length > 0 && !isCollapsed(group) && (
                  <ul className="space-y-0.5 p-1">
                    {group.nodes.map((node) => (
                      <li key={node.artifact.id}>
                        <NodeButton
                          index={index}
                          node={node}
                          root={node.artifact.id === lineage.rootId}
                          selected={isSelected('node', node.artifact.id)}
                          anchor={register(node.artifact.id)}
                          onClick={() => onSelect({ kind: 'node', id: node.artifact.id })}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Confidence pills sit on the connectors; their position is measured, hence the inline style.
          A bundle's pill counts its links and expands the file they go into. */}
      {geometry.map(({ edges, into, mid }) => {
        const edge = bundleLook(edges);
        const bundled = edges.length > 1 && into !== undefined;
        return (
          <button
            key={edges[0].link.id}
            type="button"
            onClick={() => (bundled ? toggle(into) : onSelect({ kind: 'edge', id: edge.link.id }))}
            title={bundled ? t('traceability.lineage.expandBundle') : t('traceability.lineage.linkTitle')}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 text-[10px] font-medium tabular-nums shadow-sm ${
              edges.some((e) => isSelected('edge', e.link.id)) ? 'border-brand bg-brand text-white' : edge.state === 'current' ? 'border-border bg-background' : 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            }`}
            style={{ left: mid.x, top: mid.y }}
          >
            {bundled ? `×${edges.length}` : formatConfidence(edge.link.confidence?.value)}
          </button>
        );
      })}
    </div>
  );
};

const formatConfidence = (value: number | undefined) => (value === undefined ? '–' : value.toFixed(2));

/** How a bundle of links is drawn: as its least sure link, amber when any of them may not hold. */
function bundleLook(edges: LineageEdge[]): LineageEdge {
  const weakest = edges.reduce((a, b) => ((b.link.confidence?.value ?? 1) < (a.link.confidence?.value ?? 1) ? b : a));
  return edges.find((e) => e.state === 'suspect') ?? edges.find((e) => e.state === 'staleUpstream') ?? weakest;
}

const containerCaption = (t: ReturnType<typeof useTranslation>['t'], container: TraceArtifact) =>
  isModelArtifact(container) ? `${container.name} · ${elementTypeLabel(t, container.elementType)}` : container.name;

/** What a node is called in the graph: a code fragment by its lines, everything else by name. */
const nodeLabel = (t: ReturnType<typeof useTranslation>['t'], index: TraceIndex, artifact: TraceArtifact) => {
  if (isCodeArtifact(artifact) && artifact.startLine !== undefined) {
    return t('traceability.lineage.lines', { start: artifact.startLine, end: artifact.endLine });
  }
  return isModelArtifact(artifact) ? qualifiedName(index, artifact) : artifact.name;
};

const NodeButton: React.FC<{
  index: TraceIndex;
  node: LineageNode;
  header?: boolean;
  root: boolean;
  selected: boolean;
  anchor: (element: HTMLElement | null) => void;
  onClick: () => void;
}> = ({ index, node, header = false, root, selected, anchor, onClick }) => {
  const { t, i18n } = useTranslation();
  const { artifact } = node;
  const deleted = isDeleted(index, artifact.id);
  const generation = isCodeArtifact(artifact) && !artifact.parentId ? codeRun(index, artifact, i18n.language) : undefined;
  return (
    <button
      ref={anchor}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors ${
        header ? 'rounded-t-md border-b border-border font-semibold' : 'rounded'
      } ${selected ? 'bg-brand/10 text-brand-dark dark:text-brand-light' : 'hover:bg-accent'} ${root ? 'ring-2 ring-inset ring-brand' : ''}`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${deleted ? 'text-muted-foreground line-through' : ''}`}>{nodeLabel(t, index, artifact)}</span>
        {(header || generation) && (
          <span className="block truncate text-[10px] font-normal uppercase text-muted-foreground">
            {generation ?? (isModelArtifact(artifact) ? elementTypeLabel(t, artifact.elementType) : t('traceability.lineage.file'))}
          </span>
        )}
      </span>
      {node.stale && <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-label={t('traceability.status.suspect')} />}
    </button>
  );
};

/** When a generated file was produced. */
function codeRun(index: TraceIndex, file: TraceArtifact, locale: string): string | undefined {
  const operation = index.trace.operations.find((o) => o.produces.includes(file.id));
  return operation ? formatTime(operation.startedAt, locale) : undefined;
}

const NodeDetail: React.FC<{
  index: TraceIndex;
  node: LineageNode;
  isRoot: boolean;
  onFocus: (id: string) => void;
  onOpenElement: (id: string) => void;
}> = ({ index, node, isRoot, onFocus, onOpenElement }) => {
  const { t, i18n } = useTranslation();
  const { artifact } = node;
  const history = historyOf(index, artifact.id);
  const file = isCodeArtifact(artifact) && artifact.parentId ? index.artifacts.get(artifact.parentId) : artifact;
  const lines = isCodeArtifact(artifact) && isCodeArtifact(file) ? fragmentLines({ fragment: artifact, file }) : null;
  return (
    <aside className="min-w-0 space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{nodeLabel(t, index, artifact)}</h3>
        <Badge variant="soft" size="sm">
          {isModelArtifact(artifact)
            ? elementTypeLabel(t, artifact.elementType)
            : t(isPromptArtifact(artifact) ? 'traceability.lineage.prompt' : 'traceability.lineage.code')}
        </Badge>
        {node.stale && <Badge variant="destructive" size="sm">{t('traceability.status.suspect')}</Badge>}
      </div>
      {isCodeArtifact(artifact) && <code className="block truncate text-xs text-muted-foreground">{artifact.path}</code>}
      {isPromptArtifact(artifact) && (
        <blockquote className="max-h-48 overflow-auto whitespace-pre-wrap border-l-2 border-border pl-2 text-xs">{artifact.content}</blockquote>
      )}
      <div className="flex flex-wrap gap-2">
        {!isRoot && (
          <Button size="sm" variant="outline" onClick={() => onFocus(artifact.id)}>
            <Crosshair className="mr-1 size-3.5" />
            {t('traceability.lineage.focus')}
          </Button>
        )}
        {isModelArtifact(artifact) && (
          <Button size="sm" variant="outline" onClick={() => onOpenElement(artifact.id)}>
            <ExternalLink className="mr-1 size-3.5" />
            {t('traceability.lineage.openInElements')}
          </Button>
        )}
      </div>
      {lines && (
        <pre className="max-h-64 overflow-auto rounded border border-border bg-background text-xs leading-5">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground">{(isCodeArtifact(artifact) ? artifact.startLine ?? 1 : 1) + i}</span>
              <code className="whitespace-pre">{line}</code>
            </div>
          ))}
        </pre>
      )}
      {isModelArtifact(artifact) && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold">{t('traceability.elements.history')}</h4>
          {history.length === 0 && <p className="text-xs text-muted-foreground">{t('traceability.elements.noHistory')}</p>}
          <ol className="space-y-0.5 text-xs">
            {[...history].reverse().slice(0, 8).map(({ change }) => (
              <li key={change.id}>
                {describeChange(t, change, index)}
                <span className="ml-1 text-muted-foreground">{formatTime(change.timestamp, i18n.language)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
};

const EdgeDetail: React.FC<{ index: TraceIndex; edge: LineageEdge; onSelectNode: (id: string) => void }> = ({ index, edge, onSelectNode }) => {
  const { t, i18n } = useTranslation();
  const { link } = edge;
  const operation = index.operations.get(link.operationId);
  const source = index.artifacts.get(link.sourceId)!;
  const target = index.artifacts.get(link.targetId)!;
  const tools = operation?.uses.map((id) => index.trace.tools.find((tool) => tool.id === id)).filter(Boolean) ?? [];
  const later = edge.state === 'suspect' ? changesSince(index, link) : [];
  const confidence = link.confidence?.value;
  return (
    <aside className="min-w-0 space-y-3 rounded-lg border border-border p-3 text-sm">
      <h3 className="font-semibold">{t('traceability.lineage.linkTitle')}</h3>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <button type="button" className="rounded border border-border px-1.5 hover:bg-accent" onClick={() => onSelectNode(source.id)}>
          {nodeLabel(t, index, source)}
        </button>
        <span aria-hidden>→</span>
        <button type="button" className="rounded border border-border px-1.5 hover:bg-accent" onClick={() => onSelectNode(target.id)}>
          {nodeLabel(t, index, target)}
        </button>
      </div>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">{t('traceability.lineage.confidence')}</h4>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
            <div className="h-full bg-brand" style={{ width: `${(confidence ?? 0) * 100}%` }} />
          </div>
          <span className="tabular-nums">{formatConfidence(confidence)}</span>
        </div>
        {link.confidence?.explanation && <p className="text-xs text-muted-foreground">{link.confidence.explanation}</p>}
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">{t('traceability.lineage.evidence')}</h4>
        <ul className="space-y-0.5 text-xs">
          {link.evidence.map((evidence) => (
            <li key={evidence.id}>{describeEvidence(t, evidence)}</li>
          ))}
          {link.evidence.length === 0 && <li className="text-muted-foreground">{t('traceability.lineage.noEvidence')}</li>}
        </ul>
      </section>

      {operation && (
        <section className="space-y-0.5 text-xs">
          <h4 className="font-semibold">{t('traceability.lineage.madeBy')}</h4>
          <p>{operationLabel(t, operation, index)} · {formatTime(link.timestamp, i18n.language)}</p>
          <p className="text-muted-foreground">
            {actorNames(operation, index)}
            {tools.length > 0 && ` · ${tools.map((tool) => (tool!.version ? `${tool!.name} ${tool!.version}` : tool!.name)).join(', ')}`}
          </p>
        </section>
      )}

      <StatusNote state={edge.state} />
      {later.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {later.map(({ change }) => (
            <li key={change.id}>{describeChange(t, change, index)} <span className="text-muted-foreground">{formatTime(change.timestamp, i18n.language)}</span></li>
          ))}
        </ul>
      )}
    </aside>
  );
};

const StatusNote: React.FC<{ state: LineageEdgeState }> = ({ state }) => {
  const { t } = useTranslation();
  if (state === 'current') return <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('traceability.lineage.state.current')}</p>;
  return (
    <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      {t(`traceability.lineage.state.${state}`)}
    </p>
  );
};

function describeEvidence(t: ReturnType<typeof useTranslation>['t'], evidence: TraceEvidence): string {
  if (evidence.type === 'RuleEvidence') return t('traceability.lineage.evidenceKinds.rule', { rule: evidence.rule });
  if (evidence.type === 'AIEvidence') return t('traceability.lineage.evidenceKinds.ai', { algorithm: evidence.algorithm, count: evidence.logIds.length });
  return t('traceability.lineage.evidenceKinds.change', { count: evidence.changeIds.length });
}
