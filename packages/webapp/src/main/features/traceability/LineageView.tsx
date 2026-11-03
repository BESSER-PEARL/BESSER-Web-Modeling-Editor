import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Crosshair, ExternalLink, Maximize2, Minimize2,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { TraceArtifact, TraceEvidence, TraceLogRecord, TraceOperation } from '../../shared/types/traceability';
import { isCodeArtifact, isModelArtifact, isPromptArtifact, toolIdsOf } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import {
  changesSince,
  fragmentLines,
  historyOf,
  isDeleted,
  isDiagram,
  qualifiedName,
} from '../../shared/traceability/traceQueries';
import type { Lineage, LineageBundle, LineageEdge, LineageEdgeState, LineageLayout, LineageRow, LineageSubject } from '../../shared/traceability/lineage';
import { expandableIds, lineageLayout, lineageOf, pathTo, runOfSubjectId } from '../../shared/traceability/lineage';
import { actorNames, describeChange, elementTypeLabel, formatTime, operationLabel } from './traceLabels';
import { LineageRootPicker, WHOLE_PROJECT } from './LineageRootPicker';

/** Stroke colour per evidence kind; a link that may no longer hold is amber whatever its evidence. */
const EVIDENCE_STROKES: Record<TraceEvidence['type'], string> = {
  RuleEvidence: 'stroke-slate-400 dark:stroke-slate-500',
  AIEvidence: 'stroke-violet-500',
};
const STALE_STROKE = 'stroke-amber-500';
/** Zoom levels of the canvas; 1 is the natural size. */
const ZOOM_LEVELS = [0.5, 0.67, 0.8, 1, 1.25, 1.5];
/** Indentation per depth of a row inside its card (Tailwind needs the class names spelled out). */
const ROW_INDENT = ['pl-1', 'pl-5', 'pl-9', 'pl-12', 'pl-16'];
/** How many of a node's links its detail lists. */
const LISTED_LINKS = 20;

type T = ReturnType<typeof useTranslation>['t'];
type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string };

interface LineageViewProps {
  index: TraceIndex;
  /** The artifact the lineage starts from; the whole project when null. */
  rootId: string | null;
  onRootChange: (artifactId: string | null) => void;
  onOpenElement: (artifactId: string) => void;
}

/**
 * What was derived from what: diagrams, prompts and generated files as cards linked left to right.
 * Overview first; a card or row expands to show its parts that take part in links.
 */
export const LineageView: React.FC<LineageViewProps> = ({ index, rootId, onRootChange, onOpenElement }) => {
  const root = rootId && index.artifacts.has(rootId) ? rootId : null;
  // Full screen and zoom are the view's: a new starting point keeps them.
  const [fullScreen, setFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  // A new starting point starts collapsed again, with the path to it open.
  return (
    <LineageExplorer
      key={root ?? WHOLE_PROJECT}
      index={index}
      root={root}
      onRootChange={onRootChange}
      onOpenElement={onOpenElement}
      fullScreen={fullScreen}
      setFullScreen={setFullScreen}
      zoom={zoom}
      setZoom={setZoom}
    />
  );
};

const LineageExplorer: React.FC<{
  index: TraceIndex;
  root: string | null;
  onRootChange: (artifactId: string | null) => void;
  onOpenElement: (artifactId: string) => void;
  fullScreen: boolean;
  setFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: (zoom: number) => void;
}> = ({ index, root, onRootChange, onOpenElement, fullScreen, setFullScreen, zoom, setZoom }) => {
  const { t } = useTranslation();
  const [olderGenerations, setOlderGenerations] = useState(false);
  const lineage = useMemo(
    () => lineageOf(index, root, { latestGenerationOnly: !olderGenerations }),
    [index, root, olderGenerations],
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(root ? pathTo(index, root) : []),
  );
  const layout = useMemo(() => lineageLayout(index, lineage, expanded), [index, lineage, expanded]);
  const [selection, setSelection] = useState<Selection | null>(root ? { kind: 'node', id: root } : null);

  useEffect(() => {
    if (!fullScreen) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setFullScreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen]);

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expand = (ids: string[]) => setExpanded((previous) => new Set([...previous, ...ids]));
  const selectNode = (row: LineageRow) => {
    setSelection({ kind: 'node', id: row.subject.id });
    if (row.parts > 0 && !row.expanded) expand([row.subject.id]);
  };
  const shown =
    selection &&
    (selection.kind === 'node'
      ? index.artifacts.has(selection.id) || runOfSubjectId(index, selection.id) !== undefined
      : lineage.edges.some((e) => e.link.id === selection.id));
  const selected = shown ? selection : null;
  const selectedRun = selected?.kind === 'node' ? runOfSubjectId(index, selected.id) : undefined;
  const zoomBy = (step: number) => {
    const at = ZOOM_LEVELS.indexOf(zoom);
    setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, at + step))]);
  };

  if (lineage.edges.length === 0 && !root) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.lineage.empty')}</p>;
  }

  const explorer = (
    <div className={fullScreen ? 'fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-3">
        <LineageRootPicker index={index} rootId={root} onChange={onRootChange} />
        <div className="flex items-center gap-2">
          <Checkbox id="lineage-older" checked={olderGenerations} onCheckedChange={(checked) => setOlderGenerations(checked === true)} />
          <Label htmlFor="lineage-older" className="text-xs font-normal">{t('traceability.lineage.olderGenerations')}</Label>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setExpanded(expandableIds(index, lineage))}>
            <ChevronsUpDown className="size-3.5" />
            {t('traceability.lineage.expandAll')}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setExpanded(new Set())}>
            <ChevronsDownUp className="size-3.5" />
            {t('traceability.lineage.collapseAll')}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="size-8" onClick={() => zoomBy(-1)} disabled={zoom === ZOOM_LEVELS[0]} aria-label={t('traceability.lineage.zoomOut')}>
            <ZoomOut className="size-4" />
          </Button>
          <button type="button" className="w-12 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground" onClick={() => setZoom(1)} title={t('traceability.lineage.zoomReset')}>
            {Math.round(zoom * 100)}%
          </button>
          <Button size="icon" variant="outline" className="size-8" onClick={() => zoomBy(1)} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} aria-label={t('traceability.lineage.zoomIn')}>
            <ZoomIn className="size-4" />
          </Button>
          <Button size="sm" variant="outline" className="ml-1 h-8 gap-1" onClick={() => setFullScreen((value) => !value)}>
            {fullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {t(fullScreen ? 'traceability.lineage.exitFullScreen' : 'traceability.lineage.fullScreen')}
          </Button>
        </div>
        <Legend />
      </div>
      <div className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] ${fullScreen ? 'min-h-0 flex-1' : 'h-[68vh] min-h-[440px]'}`}>
        <LineageGraph
          index={index}
          layout={layout}
          root={root}
          selected={selected}
          zoom={zoom}
          onSelectNode={selectNode}
          onSelectEdge={(id) => setSelection({ kind: 'edge', id })}
          onToggle={toggle}
          onExpand={expand}
        />
        <div className="min-h-0 overflow-auto">
          {selected?.kind === 'edge' ? (
            <EdgeDetail index={index} edge={lineage.edges.find((e) => e.link.id === selected.id)!} onSelectNode={(id) => setSelection({ kind: 'node', id })} />
          ) : selectedRun ? (
            <RunDetail index={index} lineage={lineage} operation={selectedRun} onSelectNode={(id) => setSelection({ kind: 'node', id })} />
          ) : selected ? (
            <NodeDetail
              index={index}
              lineage={lineage}
              artifact={index.artifacts.get(selected.id)!}
              isRoot={selected.id === root}
              onFocus={onRootChange}
              onOpenElement={onOpenElement}
              onSelectEdge={(id) => setSelection({ kind: 'edge', id })}
            />
          ) : (
            <Overview lineage={lineage} layout={layout} />
          )}
        </div>
      </div>
    </div>
  );
  // Full screen leaves the page: inside it, the page's stacking context would keep it under the top bar.
  return fullScreen ? createPortal(explorer, document.body) : explorer;
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

/** One drawn connector: a bundle of links between two visible rows. */
interface Connector {
  bundle: LineageBundle;
  path: string;
  mid: { x: number; y: number };
}

const LineageGraph: React.FC<{
  index: TraceIndex;
  layout: LineageLayout;
  root: string | null;
  selected: Selection | null;
  zoom: number;
  onSelectNode: (row: LineageRow) => void;
  onSelectEdge: (linkId: string) => void;
  onToggle: (artifactId: string) => void;
  onExpand: (subjectIds: string[]) => void;
}> = ({ index, layout, root, selected, zoom, onSelectNode, onSelectEdge, onToggle, onExpand }) => {
  const { t } = useTranslation();
  const content = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const [connectors, setConnectors] = useState<Connector[]>([]);
  // The canvas scrolls over the zoomed content, so it needs the content's natural size.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rowsById = useMemo(
    () => new Map(layout.columns.flat().flatMap((card) => card.rows.map((row) => [row.subject.id, row] as const))),
    [layout],
  );

  // Connectors are drawn between the measured rows, in unzoomed content coordinates.
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return undefined;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const local = (value: number, from: number) => (value - from) / zoom;
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
      setConnectors(
        layout.bundles.flatMap((bundle) => {
          const from = anchors.current.get(bundle.sourceId)?.getBoundingClientRect();
          const to = anchors.current.get(bundle.targetId)?.getBoundingClientRect();
          if (!from || !to) return [];
          const sx = local(from.right, origin.left);
          const sy = local(from.top + from.height / 2, origin.top);
          const tx = local(to.left, origin.left);
          const ty = local(to.top + to.height / 2, origin.top);
          const bend = Math.max(40, Math.abs(tx - sx) / 2);
          const [x1, x2] = [sx + bend, tx - bend];
          return [{
            bundle,
            path: `M ${sx} ${sy} C ${x1} ${sy}, ${x2} ${ty}, ${tx} ${ty}`,
            // The pill sits near the target end, where connectors from one source have spread apart.
            mid: { x: bezier(sx, x1, x2, tx, PILL_AT), y: bezier(sy, sy, ty, ty, PILL_AT) },
          }];
        }),
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout, zoom]);

  const register = (id: string) => (node: HTMLElement | null) => {
    if (node) anchors.current.set(id, node);
    else anchors.current.delete(id);
  };
  const selectedNode = selected?.kind === 'node' ? selected.id : null;
  const isSelectedEdge = (bundle: LineageBundle) => selected?.kind === 'edge' && bundle.edges.some((e) => e.link.id === selected.id);
  const selectedLink =
    selected?.kind === 'edge' ? layout.bundles.flatMap((b) => b.edges).find((e) => e.link.id === selected.id)?.link : undefined;
  // With a row selected, its links stand out and the others fade.
  const touches = (bundle: LineageBundle) => selectedNode !== null && (bundle.sourceId === selectedNode || bundle.targetId === selectedNode);
  const faded = (bundle: LineageBundle) =>
    selected?.kind === 'edge'
      ? !isSelectedEdge(bundle)
      : selectedNode !== null && rowsById.has(selectedNode) && !touches(bundle);

  return (
    <div className="relative h-full min-h-0 overflow-auto rounded-lg border border-border bg-muted/20">
      <div style={{ width: size.width * zoom, height: size.height * zoom }}>
        {/* Zoom scales the drawing; its size and the connector positions are measured, hence inline styles. */}
        <div ref={content} className="relative w-max p-6" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <svg className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible" aria-hidden>
            {connectors.map(({ bundle, path }) => {
              const look = bundleLook(bundle.edges);
              const confidence = look.link.confidence?.value ?? 1;
              const emphasis = isSelectedEdge(bundle) || touches(bundle) ? 1.6 : 1;
              return (
                <g key={bundle.key}>
                  <path
                    d={path}
                    fill="none"
                    strokeWidth={(1 + 2.5 * confidence) * emphasis * (bundle.edges.length > 1 ? 1.3 : 1)}
                    strokeOpacity={faded(bundle) ? 0.15 : 0.35 + 0.65 * confidence}
                    strokeDasharray={look.state === 'staleUpstream' ? '6 4' : undefined}
                    className={look.state === 'current' ? EVIDENCE_STROKES[look.link.evidence[0]?.type ?? 'RuleEvidence'] : STALE_STROKE}
                  />
                  {/* Keyboard users reach the same link from either end's list of links. */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={10}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => onSelectEdge(look.link.id)}
                  >
                    <title>{t('traceability.lineage.linkTitle')}</title>
                  </path>
                </g>
              );
            })}
          </svg>
          <div className="relative flex items-start gap-32">
            {layout.columns.map((cards, column) => (
              <div key={column} className="flex w-64 flex-col gap-4">
                {cards.map((card) => (
                  <div key={card.subject.id} className="rounded-md border border-border bg-card shadow-sm">
                    {card.rows.map((row) => (
                      <RowView
                        key={row.subject.id}
                        index={index}
                        row={row}
                        root={row.subject.id === root}
                        selected={row.subject.id === selectedNode}
                        anchor={register(row.subject.id)}
                        onSelect={() => onSelectNode(row)}
                        onToggle={() => onToggle(row.subject.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Pills sit on the connectors that have something to say: how many links a bundle holds, a
              confidence below certain, or a link that may not hold. A plain rule link needs none. */}
          {connectors.filter(({ bundle }) => hasPill(bundle) || isSelectedEdge(bundle)).map(({ bundle, mid }) => {
            const look = bundleLook(bundle.edges);
            const bundled = bundle.edges.length > 1;
            // A bundle opens everything that holds its links' ends, so each link gets its own connector.
            const openable = [
              ...new Set(bundle.edges.flatMap((e) => [...pathTo(index, e.link.sourceId), ...pathTo(index, e.link.targetId)])),
            ].filter((id) => !rowsById.get(id)?.expanded);
            return (
              <button
                key={bundle.key}
                type="button"
                onClick={() => (bundled && openable.length > 0 ? onExpand(openable) : onSelectEdge(look.link.id))}
                title={bundled ? t('traceability.lineage.expandBundle', { count: bundle.edges.length }) : t('traceability.lineage.linkTitle')}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 text-[10px] font-medium tabular-nums shadow-sm ${
                  faded(bundle) ? 'opacity-40' : ''
                } ${
                  isSelectedEdge(bundle)
                    ? 'border-brand bg-brand text-white'
                    : look.state === 'current'
                      ? 'border-border bg-background'
                      : 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                }`}
                style={{ left: mid.x, top: mid.y }}
              >
                {bundled ? `×${bundle.edges.length}` : formatConfidence(look.link.confidence?.value)}
                {/* The selected link's own value, when it sits in a bundle. */}
                {bundled && selectedLink && bundle.edges.some((e) => e.link.id === selectedLink.id) &&
                  ` · ${formatConfidence(selectedLink.confidence?.value)}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const formatConfidence = (value: number | undefined) => (value === undefined ? '–' : value.toFixed(2));

/** Where along a connector its pill sits: 0 at the source, 1 at the target. */
const PILL_AT = 0.78;
/** One coordinate of a cubic Bézier curve at `t`. */
const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

/** Whether a connector carries a pill: a bundle, a link below full confidence, or one that may not hold. */
function hasPill(bundle: LineageBundle): boolean {
  const look = bundleLook(bundle.edges);
  return bundle.edges.length > 1 || (look.link.confidence?.value ?? 1) < 1 || look.state !== 'current';
}

/** How a bundle of links is drawn: as its least sure link, amber when any of them may not hold. */
function bundleLook(edges: LineageEdge[]): LineageEdge {
  const weakest = edges.reduce((a, b) => ((b.link.confidence?.value ?? 1) < (a.link.confidence?.value ?? 1) ? b : a));
  return edges.find((e) => e.state === 'suspect') ?? edges.find((e) => e.state === 'staleUpstream') ?? weakest;
}

/** What a node is called: a code fragment by its lines, a card by its name, a part by its own name. */
const nodeLabel = (t: T, index: TraceIndex, artifact: TraceArtifact, nested = false) => {
  if (isCodeArtifact(artifact) && artifact.startLine !== undefined) {
    return t('traceability.lineage.lines', { start: artifact.startLine, end: artifact.endLine });
  }
  return isModelArtifact(artifact) && !nested ? qualifiedName(index, artifact) : artifact.name;
};

/** What the parts of a row are called: a run's files, a file's fragments, a diagram's elements, an element's members. */
function partsLabel(t: T, subject: LineageSubject, count: number): string {
  if (subject.kind === 'run') return t('traceability.lineage.files', { count });
  const { artifact } = subject;
  const key = isCodeArtifact(artifact) ? 'fragments' : isDiagram(artifact) ? 'elements' : 'members';
  return t(`traceability.lineage.${key}`, { count });
}

/** A row's name and the line under it. */
function describeRow(t: T, index: TraceIndex, row: LineageRow, locale: string): { label: string; subtitle?: string } {
  const { subject, depth } = row;
  if (subject.kind === 'run') return { label: operationLabel(t, subject.operation, index), subtitle: formatTime(subject.operation.startedAt, locale) };
  const { artifact } = subject;
  const fragment = isCodeArtifact(artifact) && artifact.startLine !== undefined ? artifact : undefined;
  const source = fragment && fragmentSource(index, fragment);
  const label =
    fragment && source
      ? t('traceability.lineage.fragmentOf', { name: qualifiedName(index, source), start: fragment.startLine, end: fragment.endLine })
      : nodeLabel(t, index, artifact, depth > 0);
  if (isModelArtifact(artifact)) return { label, subtitle: elementTypeLabel(t, artifact.elementType) };
  if (isPromptArtifact(artifact)) return { label, subtitle: t('traceability.lineage.prompt') };
  // A file outside a run card says when it was generated; inside one, the run says it.
  if (depth === 0) return { label, subtitle: [t('traceability.lineage.file'), codeRun(index, artifact, locale)].filter(Boolean).join(' · ') };
  return { label };
}

const RowView: React.FC<{
  index: TraceIndex;
  row: LineageRow;
  root: boolean;
  selected: boolean;
  anchor: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onToggle: () => void;
}> = ({ index, row, root, selected, anchor, onSelect, onToggle }) => {
  const { t, i18n } = useTranslation();
  const { subject, depth } = row;
  const header = depth === 0;
  const { label, subtitle } = describeRow(t, index, row, i18n.language);
  const deleted = subject.kind === 'artifact' && isDeleted(index, subject.id);
  return (
    <div
      ref={anchor}
      className={`flex items-center gap-1 pr-2 ${ROW_INDENT[Math.min(depth, ROW_INDENT.length - 1)]} ${
        header ? 'border-b border-border py-1.5 last:border-b-0' : 'py-0.5'
      } ${selected ? 'bg-brand/10' : ''} ${root ? 'ring-2 ring-inset ring-brand' : ''}`}
    >
      {row.parts > 0 ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={row.expanded}
          aria-label={t(row.expanded ? 'traceability.lineage.collapse' : 'traceability.lineage.expand', { name: label })}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {row.expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="w-[18px] shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`min-w-0 flex-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent ${header ? 'text-sm font-semibold' : 'text-xs'} ${
          selected ? 'text-brand-dark dark:text-brand-light' : ''
        }`}
      >
        <span className={`block truncate ${deleted ? 'text-muted-foreground line-through' : ''}`}>{label}</span>
        {subtitle && <span className="block truncate text-[10px] font-normal uppercase text-muted-foreground">{subtitle}</span>}
      </button>
      {row.parts > 0 && !row.expanded && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{partsLabel(t, subject, row.parts)}</span>
      )}
      {row.stale && <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-label={t('traceability.status.suspect')} />}
    </div>
  );
};

/** The model element a code fragment was generated from (the source of a link into it). */
function fragmentSource(index: TraceIndex, fragment: TraceArtifact): TraceArtifact | undefined {
  const link = (index.linksByTarget.get(fragment.id) ?? []).find((l) => isModelArtifact(index.artifacts.get(l.sourceId)));
  return link ? index.artifacts.get(link.sourceId) : undefined;
}

/** When a generated file was produced. */
function codeRun(index: TraceIndex, file: TraceArtifact, locale: string): string | undefined {
  const operation = index.trace.operations.find((o) => o.produces.includes(file.id));
  return operation ? formatTime(operation.startedAt, locale) : undefined;
}

/** A generation run: who ran which generator when, and its files that take part in the lineage. */
const RunDetail: React.FC<{
  index: TraceIndex;
  lineage: Lineage;
  operation: TraceOperation;
  onSelectNode: (id: string) => void;
}> = ({ index, lineage, operation, onSelectNode }) => {
  const { t, i18n } = useTranslation();
  const inLineage = (file: TraceArtifact) =>
    lineage.nodes.has(file.id) || (index.children.get(file.id) ?? []).some((part) => lineage.nodes.has(part.id));
  const files = operation.produces
    .map((id) => index.artifacts.get(id))
    .filter((file): file is TraceArtifact => file !== undefined && !file.parentId && inLineage(file))
    .sort((a, b) => a.name.localeCompare(b.name));
  const tools = toolIdsOf(operation).map((id) => index.trace.tools.find((tool) => tool.id === id)).filter(Boolean);
  return (
    <aside className="min-w-0 space-y-3 rounded-lg border border-border p-3 text-sm">
      <h3 className="font-semibold">{operationLabel(t, operation, index)}</h3>
      <p className="text-xs text-muted-foreground">
        {formatTime(operation.startedAt, i18n.language)} · {actorNames(operation, index)}
        {tools.length > 0 && ` · ${tools.map((tool) => (tool!.version ? `${tool!.name} ${tool!.version}` : tool!.name)).join(', ')}`}
      </p>
      <section className="space-y-1">
        <h4 className="text-xs font-semibold">{t('traceability.lineage.files', { count: files.length })}</h4>
        <ul className="space-y-0.5 text-xs">
          {files.map((file) => (
            <li key={file.id}>
              <button type="button" onClick={() => onSelectNode(file.id)} className="w-full truncate rounded px-1 text-left hover:bg-accent">
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
};

/** Shown while nothing is selected: what the lineage holds, and how to explore it. */
const Overview: React.FC<{ lineage: Lineage; layout: LineageLayout }> = ({ lineage, layout }) => {
  const { t } = useTranslation();
  const stale = lineage.edges.filter((e) => e.state !== 'current').length;
  return (
    <aside className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <h3 className="font-semibold">{t('traceability.lineage.overviewTitle')}</h3>
      <p className="text-xs text-muted-foreground">
        {t('traceability.lineage.overviewCounts', { cards: layout.columns.flat().length, links: lineage.edges.length })}
      </p>
      {stale > 0 && (
        <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {t('traceability.lineage.overviewStale', { count: stale })}
        </p>
      )}
      <p className="text-xs">{t('traceability.lineage.hint')}</p>
    </aside>
  );
};

const NodeDetail: React.FC<{
  index: TraceIndex;
  lineage: Lineage;
  artifact: TraceArtifact;
  isRoot: boolean;
  onFocus: (id: string) => void;
  onOpenElement: (id: string) => void;
  onSelectEdge: (linkId: string) => void;
}> = ({ index, lineage, artifact, isRoot, onFocus, onOpenElement, onSelectEdge }) => {
  const { t, i18n } = useTranslation();
  const history = historyOf(index, artifact.id);
  const file = isCodeArtifact(artifact) && artifact.parentId ? index.artifacts.get(artifact.parentId) : artifact;
  const lines = isCodeArtifact(artifact) && isCodeArtifact(file) ? fragmentLines({ fragment: artifact, file }) : null;
  const stale = lineage.nodes.get(artifact.id)?.stale ?? false;
  const links = lineage.edges.filter((e) => e.link.sourceId === artifact.id || e.link.targetId === artifact.id);
  return (
    <aside className="min-w-0 space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{nodeLabel(t, index, artifact)}</h3>
        <Badge variant="soft" size="sm">
          {isModelArtifact(artifact)
            ? elementTypeLabel(t, artifact.elementType)
            : t(isPromptArtifact(artifact) ? 'traceability.lineage.prompt' : 'traceability.lineage.code')}
        </Badge>
        {stale && <Badge variant="destructive" size="sm">{t('traceability.status.suspect')}</Badge>}
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
      <section className="space-y-1">
        <h4 className="text-xs font-semibold">{t('traceability.lineage.links', { count: links.length })}</h4>
        {links.length === 0 && <p className="text-xs text-muted-foreground">{t('traceability.lineage.noLinks')}</p>}
        <ul className="space-y-0.5 text-xs">
          {links.slice(0, LISTED_LINKS).map(({ link, state }) => {
            const outgoing = link.sourceId === artifact.id;
            const other = index.artifacts.get(outgoing ? link.targetId : link.sourceId)!;
            return (
              <li key={link.id}>
                <button type="button" onClick={() => onSelectEdge(link.id)} className="flex w-full items-center gap-1 rounded px-1 text-left hover:bg-accent">
                  <span aria-hidden className="text-muted-foreground">{outgoing ? '→' : '←'}</span>
                  <span className="truncate">{nodeLabel(t, index, other)}</span>
                  {isCodeArtifact(other) && other.parentId && <span className="truncate text-muted-foreground">{other.path}</span>}
                  {state !== 'current' && <AlertTriangle className="ml-auto size-3 shrink-0 text-amber-500" aria-label={t(`traceability.lineage.legend.${state}`)} />}
                </button>
              </li>
            );
          })}
        </ul>
        {links.length > LISTED_LINKS && (
          <p className="text-xs text-muted-foreground">{t('traceability.lineage.moreLinks', { count: links.length - LISTED_LINKS })}</p>
        )}
      </section>
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
  const tools = operation ? toolIdsOf(operation).map((id) => index.trace.tools.find((tool) => tool.id === id)).filter(Boolean) : [];
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
      {isCodeArtifact(target) && target.parentId && <code className="block truncate text-xs text-muted-foreground">{target.path}</code>}

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">{t('traceability.lineage.confidence')}</h4>
        {confidence === undefined ? (
          <p className="text-xs text-muted-foreground">{t('traceability.lineage.confidenceNotAssessedNote')}</p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-brand" style={{ width: `${confidence * 100}%` }} />
            </div>
            <span className="tabular-nums">{formatConfidence(confidence)}</span>
          </div>
        )}
        {link.confidence?.explanation && <p className="text-xs text-muted-foreground">{link.confidence.explanation}</p>}
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold">{t('traceability.lineage.evidence')}</h4>
        <ul className="space-y-0.5 text-xs">
          {link.evidence.map((evidence) => (
            <li key={evidence.id} className="space-y-1">
              <div>{describeEvidence(t, evidence)}</div>
              <EvidenceLogs logs={(evidence.logIds ?? []).flatMap((id) => index.logs.get(id) ?? [])} />
            </li>
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

/** The log records an evidence rests on: what was asked and answered, in order. */
const EvidenceLogs: React.FC<{ logs: TraceLogRecord[] }> = ({ logs }) => {
  const { t } = useTranslation();
  if (logs.length === 0) return null;
  return (
    <ol className="space-y-1 border-l-2 border-border pl-2">
      {logs.map((log) => (
        <li key={log.id}>
          <span className="block text-[10px] uppercase text-muted-foreground">
            {t(`traceability.timeline.logTypes.${log.logType}`, { defaultValue: log.logType })}
          </span>
          <p className="max-h-32 overflow-auto whitespace-pre-wrap break-words">{log.content}</p>
        </li>
      ))}
    </ol>
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

function describeEvidence(t: T, evidence: TraceEvidence): string {
  const count = evidence.logIds?.length ?? 0;
  if (evidence.type === 'AIEvidence') return t('traceability.lineage.evidenceKinds.ai', { algorithm: evidence.algorithm, count });
  const rule = t('traceability.lineage.evidenceKinds.rule', { rule: evidence.rule });
  return count > 0 ? `${rule} ${t('traceability.lineage.evidenceKinds.logs', { count })}` : rule;
}
