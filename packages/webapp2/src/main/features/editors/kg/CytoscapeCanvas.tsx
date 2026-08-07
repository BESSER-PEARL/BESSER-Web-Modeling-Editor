import React, { useEffect, useImperativeHandle, useRef } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import edgehandles from 'cytoscape-edgehandles';
import fcose from 'cytoscape-fcose';
import { kgStylesheet } from './stylesheet';
import { buildStandaloneHtml } from './standaloneHtmlTemplate';
import { KG_DRAG_MIME } from './KnowledgeGraphPalette';
import type { KnowledgeGraphData, KGNodeData, KGEdgeData, KGNodeType } from './types';
import type { ConnectMode } from './KnowledgeGraphToolbar';
import type { KgSelection } from './KnowledgeGraphInspector';
import type { KnowledgeGraphLayout } from '../../../shared/types/project';
import { isEdgeAllowed, explainEdgeRejection, formatVocabLabel, isMetaVocab } from './edge-rules';
import { defaultPredicateFor } from './edge-defaults';

// Register extensions exactly once. Cytoscape will throw a benign error on
// re-registration during HMR; we swallow it.
let extensionsRegistered = false;
function registerExtensions() {
  if (extensionsRegistered) return;
  try { cytoscape.use(edgehandles as any); } catch { /* already registered */ }
  try { cytoscape.use(fcose as any); } catch { /* already registered */ }
  extensionsRegistered = true;
}

function filterVisible(model: KnowledgeGraphData, visibleIdList: string[]): KnowledgeGraphData {
  const visibleSet = new Set(visibleIdList);
  if (visibleSet.size === 0) return { ...model, nodes: [], edges: [] };
  const visibleNodes = model.nodes.filter((n) => visibleSet.has(n.id));
  const visibleEdges = model.edges.filter((e) => visibleSet.has(e.source) && visibleSet.has(e.target));
  return { ...model, nodes: visibleNodes, edges: visibleEdges };
}

/** Deterministic, synchronous grid layout in pure JS. */
function assignGridPositions(nodes: KGNodeData[]): KGNodeData[] {
  if (nodes.length === 0) return nodes;
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const DX = 220;
  const DY = 130;
  return nodes.map((n, i) => ({
    ...n,
    position: { x: (i % cols) * DX, y: Math.floor(i / cols) * DY },
  }));
}

/** Cytoscape layout option bag for the given algorithm. */
function layoutOptions(algorithm: Exclude<KnowledgeGraphLayout, 'grid'>): any {
  if (algorithm === 'concentric') {
    return {
      name: 'concentric',
      fit: true,
      padding: 30,
      // High-degree nodes sit in the central ring.
      concentric: (node: any) => node.degree(),
      levelWidth: () => 1,
      // Tight but still collision-free. `minNodeSpacing` controls the gap
      // between nodes on the same ring; `spacingFactor` < 1 pulls the
      // rings inward so labels stay readable.
      minNodeSpacing: 6,
      spacingFactor: 0.75,
      avoidOverlap: true,
      animate: false,
    };
  }
  // fcose — force-directed. Deterministic enough for our purposes and fast.
  // Spacing tuned for readable ontology graphs: edges land around 150 px,
  // nodes repel strongly so labels don't crowd each other.
  return {
    name: 'fcose',
    quality: 'default',
    randomize: true,
    animate: false,
    fit: true,
    padding: 50,
    nodeSeparation: 150,
    idealEdgeLength: 170,
    nodeRepulsion: 12000,
    edgeElasticity: 0.45,
    gravity: 0.25,
    gravityRange: 3.8,
    packComponents: true,
  };
}

/** Padding kept between the graph's bounding box and the canvas edges when
 *  fitting the view. */
const FIT_PADDING = 40;

/** Cytoscape caches the container's dimensions and only refreshes them on
 *  `cy.resize()` (or a window resize). The KG canvas, however, changes size
 *  without any window resize — the app shell's sidebar collapses, the toolbar
 *  wraps to a second row, the browser panel layout shifts — after which
 *  `cy.width()` / `cy.height()` still report the size the canvas had at mount.
 *  Every viewport operation therefore refreshes the cache first; skipping this
 *  is what makes `fit` / `center` land the graph off to one side. */
function refreshSize(cy: Core): Core {
  cy.resize();
  return cy;
}

/** Fit every element into the (freshly measured) viewport. */
function fitAll(cy: Core): void {
  refreshSize(cy).fit(undefined, FIT_PADDING);
}

/** Run a Cytoscape layout and invoke `onDone` once `layoutstop` fires.
 *  Some layouts (fcose notably) compute positions over multiple ticks even
 *  with `animate: false`; persisting positions inline after `.run()` would
 *  snapshot the initial (0,0) placement for all nodes. */
function runCyLayout(
  cy: Core,
  algorithm: Exclude<KnowledgeGraphLayout, 'grid'>,
  onDone: () => void,
): void {
  if (cy.nodes().empty()) { onDone(); return; }
  const layout = cy.layout(layoutOptions(algorithm));
  let finished = false;
  const finish = () => { if (finished) return; finished = true; onDone(); };
  layout.one('layoutstop', finish);
  layout.run();
  // Safety net in case the layout instance never emits `layoutstop`
  // (shouldn't happen, but don't want to leave the persist step stranded).
  setTimeout(finish, 2000);
}

/** True when the graph's stored positions look usable. False if any node is
 *  missing a finite position or if 3+ nodes are clustered in the same ~50px
 *  cell — the tell-tale sign of a stale bad-layout state where many nodes
 *  ended up stacked at (or near) the same spot (typically the origin). The
 *  50px cell size is larger than a typical node and larger than the tiny
 *  jitter cose tends to produce for nodes it failed to separate. */
function hasMeaningfulPositions(nodes: KGNodeData[]): boolean {
  if (nodes.length === 0) return true;
  const CELL = 50;
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const p = n.position;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    const key = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const c of counts.values()) if (c >= 3) return false;
  return true;
}

/** Derive a non-empty display label for any node. OWL classes / properties can
 *  come back from the backend with `label = ""` (no rdfs:label, trailing-slash
 *  IRI with an empty local name). An empty label combined with the
 *  `width: 'label'` stylesheet rule renders those nodes as 0×0 pixels — they
 *  are on the canvas but invisible, which looked like "class nodes are hidden". */
function displayLabel(n: KGNodeData): string {
  // Vocabulary terms (owl:, rdf:, rdfs:, xsd:) always render with their
  // namespace prefix and a trailing chip glyph so the user can tell them
  // apart from user-defined classes/individuals at a glance. The IRI takes
  // precedence over `n.label` here because the backend often gives vocab
  // nodes a bare local-name label ("Class", "string", …) which would
  // otherwise be indistinguishable from a user concept.
  const vocab = formatVocabLabel(n.iri);
  if (vocab) return `${vocab} Ⓥ`; // U+24CB = encircled latin small v
  const raw = (n.label ?? '').toString().trim();
  if (raw) return raw;
  if (n.nodeType === 'literal') return n.value != null && String(n.value).trim() !== '' ? String(n.value) : '""';
  if (n.nodeType === 'blank') return '_:';
  const iri = (n.iri ?? n.id ?? '').toString();
  if (!iri) return '?';
  if (iri.startsWith('_:')) return iri;
  if (iri.includes('#')) {
    const after = iri.split('#').pop() ?? '';
    if (after) return after;
  }
  if (iri.includes('/')) {
    const parts = iri.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return iri;
}

function modelToElements(model: KnowledgeGraphData): ElementDefinition[] {
  // Defensive dedup: Cytoscape silently drops elements with duplicate IDs.
  // OWL imports occasionally produce siblings with the same local name or
  // blank-node handles, and an internal bug anywhere upstream could produce
  // a duplicate — bail it out here so every node survives to the canvas.
  const seenNodes = new Set<string>();
  const nodes: ElementDefinition[] = [];
  for (const n of model.nodes || []) {
    const id = String(n.id ?? '');
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    nodes.push({
      group: 'nodes',
      data: {
        id,
        label: displayLabel(n),
        nodeType: n.nodeType,
        iri: n.iri,
        value: n.value,
        datatype: n.datatype,
        // Carry metadata through Cytoscape so cyToModel can put it back on
        // the re-emitted KGNodeData. Critical for constraint nodes, whose
        // `metadata.constraintSpecs` would otherwise be silently dropped on
        // every canvas interaction.
        metadata: n.metadata,
        // Tag vocabulary nodes (owl:/rdf:/rdfs:/xsd:) so the stylesheet can
        // render them with the "framework" chip treatment. Cytoscape stores
        // booleans as strings in selectors, so we keep this as a literal flag.
        isVocab: isMetaVocab(n.iri),
      },
      // Copy the position object — Cytoscape layouts mutate it in place,
      // and React may freeze state-derived objects in dev mode, which
      // would throw `"x" is read-only` on any subsequent layout pass.
      position: n.position ? { x: n.position.x, y: n.position.y } : undefined,
    });
  }

  const seenEdges = new Set<string>();
  const edges: ElementDefinition[] = [];
  for (const e of model.edges || []) {
    const id = String(e.id ?? '');
    if (!id || seenEdges.has(id)) continue;
    // Cytoscape requires both endpoints to already exist; an orphan edge
    // makes cy.add() abort the rest of the batch silently.
    if (!seenNodes.has(e.source) || !seenNodes.has(e.target)) continue;
    seenEdges.add(id);
    edges.push({
      group: 'edges',
      data: { id, source: e.source, target: e.target, label: e.label ?? '', iri: e.iri },
    });
  }

  return [...nodes, ...edges];
}

/** True for the transient elements cytoscape-edgehandles injects while an
 *  edge-drawing gesture is in flight (the invisible ghost node the ghost edge
 *  points at, the ghost edge itself, and the not-yet-committed preview edge).
 *  These live in the Cytoscape instance but must never reach the model. */
function isEdgehandlesTemp(el: { hasClass: (c: string) => boolean }): boolean {
  return (
    el.hasClass('eh-ghost') ||
    el.hasClass('eh-ghost-node') ||
    el.hasClass('eh-ghost-edge') ||
    el.hasClass('eh-preview')
  );
}

function cyToModel(cy: Core, previous: KnowledgeGraphData): KnowledgeGraphData {
  const realNodes = cy.nodes().filter((n) => !isEdgehandlesTemp(n)).nodes();
  const realEdges = cy.edges().filter((e) => !isEdgehandlesTemp(e)).edges();
  const nodes: KGNodeData[] = realNodes.map((n): KGNodeData => {
    const data = n.data();
    const position = n.position();
    return {
      id: String(data.id),
      label: data.label ?? '',
      nodeType: (data.nodeType as KGNodeType) ?? 'individual',
      iri: data.iri,
      value: data.value,
      datatype: data.datatype,
      // Restore the metadata that modelToElements stashed onto data.metadata.
      // Without this, constraint-bearing nodes lose their `constraintSpecs`
      // every time the canvas re-emits the model, leading to empty
      // constraints downstream in the KG → ClassDiagram conversion.
      metadata: data.metadata,
      position: { x: position.x, y: position.y },
    };
  });
  const edges: KGEdgeData[] = realEdges.map((e): KGEdgeData => {
    const data = e.data();
    return {
      id: String(data.id),
      source: String(data.source),
      target: String(data.target),
      label: data.label,
      iri: data.iri,
    };
  });
  return {
    type: 'KnowledgeGraphDiagram',
    version: previous.version || '1.0.0',
    nodes,
    edges,
    settings: previous.settings,
  };
}

/** Merge canvas-derived (visible-slice) edits back into the full model.
 *
 *  The visible-id set is now tracked in the parent editor, so this is simple:
 *  - Visible slice = ids the editor marked visible (`visibleSet`).
 *  - Canvas edits override visible entries; hidden entries pass through.
 *  - Deletions inside the visible slice are detected by ids that WERE
 *    visible but no longer appear in the canvas output. */
function mergeWithFullModel(
  full: KnowledgeGraphData,
  canvas: KnowledgeGraphData,
  visibleSet: Set<string>,
): KnowledgeGraphData {
  const canvasNodeById = new Map(canvas.nodes.map((n) => [n.id, n]));
  const consumed = new Set<string>();
  const mergedNodes: KGNodeData[] = [];
  for (const n of full.nodes) {
    if (canvasNodeById.has(n.id)) {
      const canvasNode = canvasNodeById.get(n.id)!;
      // Defense-in-depth: if the canvas-emitted node lacks metadata (e.g.
      // an older diagram saved before metadata was round-tripped through
      // Cytoscape data), keep the original full-model metadata so
      // constraint specs survive the merge.
      mergedNodes.push(
        canvasNode.metadata === undefined && n.metadata !== undefined
          ? { ...canvasNode, metadata: n.metadata }
          : canvasNode,
      );
      consumed.add(n.id);
    } else if (visibleSet.has(n.id)) {
      // Was visible, now absent → deleted on the canvas. Drop.
      continue;
    } else {
      // Hidden — pass through unchanged.
      mergedNodes.push(n);
    }
  }
  for (const n of canvas.nodes) if (!consumed.has(n.id)) mergedNodes.push(n);

  const allNodeIds = new Set(mergedNodes.map((n) => n.id));
  const canvasEdgeById = new Map(canvas.edges.map((e) => [e.id, e]));
  const takenEdges = new Set<string>();
  const mergedEdges: KGEdgeData[] = [];
  for (const e of full.edges) {
    if (canvasEdgeById.has(e.id)) {
      mergedEdges.push(canvasEdgeById.get(e.id)!);
      takenEdges.add(e.id);
    } else if (visibleSet.has(e.source) && visibleSet.has(e.target)) {
      // Was visible, now absent → deleted on the canvas.
      continue;
    } else {
      mergedEdges.push(e);
    }
  }
  for (const e of canvas.edges) if (!takenEdges.has(e.id)) mergedEdges.push(e);

  const cleanEdges = mergedEdges.filter((e) => allNodeIds.has(e.source) && allNodeIds.has(e.target));
  return { ...full, nodes: mergedNodes, edges: cleanEdges };
}

function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}:${rand}`;
}

export interface CytoscapeCanvasHandle {
  fit: () => void;
  deleteSelected: () => void;
  clearSelection: () => void;
  /** Force a fresh layout pass using the currently-configured algorithm,
   *  overwriting persisted positions. Called when the user changes the
   *  layout setting. */
  relayout: () => void;
  /** Serialize the live Cytoscape instance into a self-contained HTML
   *  viewer. Returns null if the instance hasn't initialized yet. */
  exportHtml: (title: string) => string | null;
  /** Zoom in/out around the current viewport center (so the user keeps
   *  looking at the same place as they zoom). Clamped by minZoom/maxZoom. */
  zoomIn: () => void;
  zoomOut: () => void;
  /** Restore zoom to 1.0 and bring the graph back to the middle of the
   *  viewport. Distinct from `fit`, which also scales the graph so that
   *  everything is visible. */
  resetZoom: () => void;
}

interface CytoscapeCanvasProps {
  model: KnowledgeGraphData;
  /** Ordered list of node IDs to render on the canvas; owned by the editor
   *  so deleting nodes doesn't "promote" hidden ones into view. */
  visibleIds: string[];
  /** Layout algorithm. Runs once when the visible graph has no positions,
   *  or on an explicit `relayout()` call. Subsequent edits (drag, add,
   *  delete) do not re-run the layout. */
  layout: KnowledgeGraphLayout;
  connectMode: ConnectMode;
  onChange: (next: KnowledgeGraphData) => void;
  onSelect: (sel: KgSelection) => void;
  onExitConnectMode?: () => void;
  /** Called when the canvas wants to reveal a set of node ids (e.g. after
   *  a double-click to expand neighbors). The editor enforces the hard
   *  limit and surfaces the toast when the set doesn't fit. */
  onRevealNodes?: (ids: string[]) => void;
  /** Called when a drag-to-connect gesture ended on a node the OWL2 DL rules
   *  forbid, with a human-readable reason. The editor surfaces it as a toast. */
  onRelationRejected?: (reason: string) => void;
}

export const CytoscapeCanvas = React.forwardRef<CytoscapeCanvasHandle, CytoscapeCanvasProps>(
  (
    {
      model,
      visibleIds,
      layout,
      connectMode,
      onChange,
      onSelect,
      onExitConnectMode,
      onRevealNodes,
      onRelationRejected,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const cyRef = useRef<Core | null>(null);
    const ehRef = useRef<any>(null);

    // Keep latest props reachable from long-lived event handlers.
    const modelRef = useRef(model);
    modelRef.current = model;
    const visibleIdsRef = useRef(visibleIds);
    visibleIdsRef.current = visibleIds;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const connectModeRef = useRef<ConnectMode>(connectMode);
    connectModeRef.current = connectMode;
    const layoutRef = useRef<KnowledgeGraphLayout>(layout);
    layoutRef.current = layout;
    const onRevealNodesRef = useRef(onRevealNodes);
    onRevealNodesRef.current = onRevealNodes;
    const onRelationRejectedRef = useRef(onRelationRejected);
    onRelationRejectedRef.current = onRelationRejected;
    // State for one drag-to-connect gesture, from `ehstart` to `ehstop`.
    // While `active`, edgehandles is adding and removing its own transient
    // elements — we must not treat those churn events as user edits.
    const ehGestureRef = useRef<{ active: boolean; created: boolean; rejection: string | null }>({
      active: false,
      created: false,
      rejection: null,
    });
    // When we programmatically rebuild the canvas (`cy.elements().remove()`
    // followed by `cy.add(...)`) Cytoscape fires a cascade of `remove`
    // events. We must NOT treat those as user-initiated deletions or we end
    // up wiping the model. The sync effect raises this flag around the
    // rebuild; event handlers honour it.
    const suppressEventsRef = useRef(false);

    const emitChangeFromCy = (cy: Core) => {
      if (suppressEventsRef.current) return;
      // Mid-gesture, edgehandles' preview/ghost churn fires `remove` events.
      // Emitting then would push half-finished state into the model; the
      // `ehstop` handler emits once at the end instead.
      if (ehGestureRef.current.active) return;
      const canvas = cyToModel(cy, modelRef.current);
      const visibleSet = new Set(visibleIdsRef.current);
      const merged = mergeWithFullModel(modelRef.current, canvas, visibleSet);
      onChangeRef.current(merged);
    };

    /** Reveal every neighbor of the given source node around it on the
     *  canvas. Neighbors already visible are untouched; hidden neighbors
     *  get positions on a circle around the source and are added to
     *  visibleIds (bounded by the hard limit — editor-side enforcement). */
    const expandNeighbors = (sourceNode: any) => {
      const sourceId = String(sourceNode.id());
      const sourcePos = sourceNode.position();

      const neighborIds = new Set<string>();
      for (const edge of modelRef.current.edges) {
        if (edge.source === sourceId) neighborIds.add(edge.target);
        else if (edge.target === sourceId) neighborIds.add(edge.source);
      }
      neighborIds.delete(sourceId);
      if (neighborIds.size === 0) return;

      const visibleSet = new Set(visibleIdsRef.current);
      const toReveal = [...neighborIds].filter((id) => !visibleSet.has(id));
      if (toReveal.length === 0) return; // all neighbors already visible

      // Circle radius scales gently with the number of neighbors so wheels
      // with many spokes don't overlap each other.
      const radius = Math.max(220, 110 + toReveal.length * 14);
      const angleStep = (2 * Math.PI) / toReveal.length;
      const startAngle = -Math.PI / 2; // first neighbor at 12 o'clock
      const positions = new Map<string, { x: number; y: number }>();
      toReveal.forEach((id, i) => {
        const angle = startAngle + angleStep * i;
        positions.set(id, {
          x: sourcePos.x + radius * Math.cos(angle),
          y: sourcePos.y + radius * Math.sin(angle),
        });
      });

      // Write fresh positions into the full model for the newly-revealed
      // neighbors; untouched nodes keep their existing positions.
      const nextNodes = modelRef.current.nodes.map((n) => {
        const pos = positions.get(n.id);
        return pos ? { ...n, position: pos } : n;
      });
      const nextModel: KnowledgeGraphData = { ...modelRef.current, nodes: nextNodes };
      onChangeRef.current(nextModel);
      // Ask the editor to add these ids to visibleIds (enforces hard limit
      // + surfaces a toast if the full set doesn't fit).
      onRevealNodesRef.current?.(toReveal);
    };

    const ZOOM_STEP = 1.2;
    const zoomAtViewportCenter = (factor: number) => {
      const cy = cyRef.current;
      if (!cy) return;
      refreshSize(cy);
      cy.zoom({
        level: cy.zoom() * factor,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    };

    useImperativeHandle(ref, () => ({
      fit: () => {
        const cy = cyRef.current;
        if (cy) fitAll(cy);
      },
      zoomIn: () => zoomAtViewportCenter(ZOOM_STEP),
      zoomOut: () => zoomAtViewportCenter(1 / ZOOM_STEP),
      resetZoom: () => {
        const cy = cyRef.current;
        if (!cy) return;
        refreshSize(cy);
        cy.zoom(1);
        // Zoom alone leaves the graph wherever the user last panned it, which
        // regularly puts it off screen at 100%. Re-centre so "reset zoom"
        // reliably brings the nodes back into the middle of the canvas.
        cy.center();
      },
      deleteSelected: () => {
        const cy = cyRef.current;
        if (!cy) return;
        const sel = cy.$(':selected');
        if (sel.nonempty()) {
          sel.remove();
        }
      },
      clearSelection: () => {
        const cy = cyRef.current;
        if (!cy) return;
        cy.$(':selected').unselect();
      },
      relayout: () => {
        const cy = cyRef.current;
        if (!cy) return;
        const chosen = layoutRef.current;
        const persist = () => {
          fitAll(cy);
          const canvas = cyToModel(cy, modelRef.current);
          const visibleSet = new Set(visibleIdsRef.current);
          const merged = mergeWithFullModel(modelRef.current, canvas, visibleSet);
          onChangeRef.current(merged);
        };
        if (chosen === 'grid') {
          const visibleList = filterVisible(modelRef.current, visibleIdsRef.current).nodes;
          const placed = assignGridPositions(visibleList);
          suppressEventsRef.current = true;
          try {
            cy.nodes().forEach((n) => {
              const found = placed.find((p) => p.id === String(n.data('id')));
              if (found?.position) n.position({ x: found.position.x, y: found.position.y });
            });
          } finally {
            suppressEventsRef.current = false;
          }
          persist();
        } else {
          runCyLayout(cy, chosen, persist);
        }
      },
      exportHtml: (title: string) => {
        const cy = cyRef.current;
        if (!cy) return null;
        // 'grid' is editor-only (handled in JS); the standalone viewer falls
        // back to fcose when positions are missing, which never happens here
        // since cy.json() always carries positions for rendered nodes.
        const layoutForFallback = layoutRef.current === 'grid' ? 'fcose' : layoutRef.current;
        return buildStandaloneHtml({
          title,
          cyJson: cy.json() as Record<string, unknown>,
          stylesheet: kgStylesheet,
          fallbackLayout: layoutForFallback,
        });
      },
    }), []);

    // Initialize the Cytoscape instance once.
    useEffect(() => {
      registerExtensions();
      if (!containerRef.current) return;

      const visible = filterVisible(model, visibleIdsRef.current);
      const cy = cytoscape({
        container: containerRef.current,
        elements: modelToElements(visible),
        style: kgStylesheet as any,
        layout: { name: 'preset' },
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 4,
        // Disable panning so plain drag on the empty canvas initiates a
        // rubber-band box selection (Cytoscape's fallback when panning is
        // off). Panning is re-enabled while the user holds Space — see the
        // keydown/keyup handlers below. Right-click drag is wired separately
        // at the container DOM level (see further down) so users can pan
        // without losing box-select on plain left-drag.
        userPanningEnabled: false,
        boxSelectionEnabled: true,
      });
      cyRef.current = cy;

      // Relation creation is a drag gesture powered by cytoscape-edgehandles,
      // armed only while the toolbar's "Add relation" mode is on. Draw mode
      // sets `cy.autoungrabify(true)` for us, which is exactly the behaviour we
      // want: node positions freeze while the user is wiring things up, and
      // come back the moment the mode is turned off.
      const eh = (cy as any).edgehandles({
        snap: true,
        hoverDelay: 150,
        handleNodes: 'node',
        canConnect: (source: any, target: any) => {
          // edgehandles probes `canConnect` with an empty collection on the
          // cancel path (drag released over blank canvas). That is not a
          // rejection worth reporting.
          if (!target || target.empty()) return false;
          if (source.same(target)) return false;
          const s = String(source.data('nodeType') ?? '') as KGNodeType;
          const t = String(target.data('nodeType') ?? '') as KGNodeType;
          const sIri = source.data('iri') as string | undefined;
          const tIri = target.data('iri') as string | undefined;
          const allowed = isEdgeAllowed(s, t, sIri, tIri);
          // Remember why the last candidate was refused so `ehstop` can
          // explain it, rather than the drag silently doing nothing.
          if (!allowed) ehGestureRef.current.rejection = explainEdgeRejection(s, t);
          return allowed;
        },
        // Auto-tag the new edge with the canonical predicate for this node-type
        // pair. edgehandles builds its preview edge from these params and then
        // promotes that very element on completion, so whatever we set here is
        // what lands in the model. Constraint links in particular *must* carry
        // their internal IRI or the preflight reports them as unattached.
        edgeParams: (source: any, target: any) => {
          const s = String(source.data('nodeType') ?? '');
          const t = String(target?.data('nodeType') ?? '');
          const { label, iri } = defaultPredicateFor(s, t);
          return { data: { id: newId('edge'), label, ...(iri ? { iri } : {}) } };
        },
      });
      ehRef.current = eh;
      // Draw mode starts off; the connect-mode effect below arms it.
      eh.disable();

      cy.on('ehstart', () => {
        ehGestureRef.current = { active: true, created: false, rejection: null };
      });
      cy.on('ehcomplete', () => {
        ehGestureRef.current.created = true;
      });
      cy.on('ehstop', () => {
        const gesture = ehGestureRef.current;
        ehGestureRef.current = { active: false, created: false, rejection: null };
        // `ehstop` fires after edgehandles has torn its ghost elements down,
        // so the instance is clean and safe to serialize here.
        if (gesture.created) emitChangeFromCy(cy);
        else if (gesture.rejection) onRelationRejectedRef.current?.(gesture.rejection);
      });

      cy.on('dragfreeon', 'node', () => emitChangeFromCy(cy));
      cy.on('remove', () => emitChangeFromCy(cy));

      // Consolidated selection emitter — batches the per-element select /
      // unselect events that fire when a box drag picks multiple things up
      // at once, so the parent gets one update describing the full set.
      let selectionEmitHandle: number | null = null;
      const scheduleSelectionEmit = () => {
        if (selectionEmitHandle !== null) return;
        selectionEmitHandle = window.setTimeout(() => {
          selectionEmitHandle = null;
          const sel = cy.$(':selected');
          const nodeIds = sel.nodes().map((n) => String(n.id()));
          const edgeIds = sel.edges().map((e) => String(e.id()));
          const total = nodeIds.length + edgeIds.length;
          if (total === 0) {
            onSelectRef.current(null);
          } else if (total === 1) {
            onSelectRef.current(
              nodeIds.length === 1
                ? { kind: 'node', id: nodeIds[0] }
                : { kind: 'edge', id: edgeIds[0] },
            );
          } else {
            onSelectRef.current({ kind: 'multi', nodeIds, edgeIds });
          }
        }, 0);
      };
      cy.on('select', scheduleSelectionEmit);
      cy.on('unselect', scheduleSelectionEmit);
      cy.on('tap', (evt) => {
        if (evt.target === cy) onSelectRef.current(null);
      });

      // Drag-together: when the user grabs a node that is part of a
      // multi-selection, translate the other selected nodes by the same
      // delta. Stops when the grab is released.
      let groupDrag:
        | {
            anchorId: string;
            anchorStart: { x: number; y: number };
            others: Map<string, { x: number; y: number }>;
          }
        | null = null;
      cy.on('grab', 'node', (evt) => {
        const grabbed = evt.target;
        const selectedNodes = cy.$('node:selected');
        if (selectedNodes.size() < 2 || !grabbed.selected()) {
          groupDrag = null;
          return;
        }
        const anchorId = String(grabbed.id());
        const anchorStart = { ...grabbed.position() };
        const others = new Map<string, { x: number; y: number }>();
        selectedNodes.forEach((n) => {
          const id = String(n.id());
          if (id !== anchorId) others.set(id, { ...n.position() });
        });
        groupDrag = { anchorId, anchorStart, others };
      });
      cy.on('drag', 'node', (evt) => {
        const s = groupDrag;
        if (!s) return;
        if (String(evt.target.id()) !== s.anchorId) return;
        const cur = evt.target.position();
        const dx = cur.x - s.anchorStart.x;
        const dy = cur.y - s.anchorStart.y;
        s.others.forEach((start, id) => {
          const el = cy.getElementById(id);
          if (el.nonempty()) el.position({ x: start.x + dx, y: start.y + dy });
        });
      });
      cy.on('free', 'node', (evt) => {
        if (groupDrag && String(evt.target.id()) === groupDrag.anchorId) {
          groupDrag = null;
        }
      });

      // Double-click to reveal a node's neighbors arranged in a circle
      // around it. Skipped in connect-mode: there a double-click is just two
      // edge-drawing gestures and shouldn't also expand the graph.
      cy.on('dbltap', 'node', (evt) => {
        if (connectModeRef.current === 'connect') return;
        expandNeighbors(evt.target);
      });

      // Esc exits connect mode.
      // Space held = temporarily enable panning (plain drag is otherwise
      // used for box-selecting multiple elements).
      const onKey = (ev: KeyboardEvent) => {
        if (!containerRef.current) return;
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            (active as HTMLElement).isContentEditable)
        ) {
          return;
        }
        if (ev.key === ' ' && !ev.repeat) {
          cy.userPanningEnabled(true);
          ev.preventDefault();
          return;
        }
        if (ev.key === 'Escape') {
          if (connectModeRef.current !== 'off') {
            onExitConnectMode?.();
            ev.preventDefault();
          }
          return;
        }
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
          const sel = cy.$(':selected');
          if (sel.nonempty()) {
            sel.remove();
            ev.preventDefault();
          }
        }
      };
      const onKeyUp = (ev: KeyboardEvent) => {
        if (ev.key === ' ') {
          cy.userPanningEnabled(false);
        }
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKeyUp);

      // Right-click drag pans the canvas. Implemented at the container DOM
      // level — Cytoscape's `userPanningEnabled` only governs left-button
      // drag, so this is additive: plain left-drag still box-selects, Space-
      // held drag still pans, node grab/multi-drag are untouched.
      const container = containerRef.current!;
      let rmbPanning = false;
      let lastX = 0;
      let lastY = 0;
      const onMouseDown = (ev: MouseEvent) => {
        if (ev.button !== 2) return;
        rmbPanning = true;
        lastX = ev.clientX;
        lastY = ev.clientY;
        ev.preventDefault();
      };
      const onMouseMove = (ev: MouseEvent) => {
        if (!rmbPanning) return;
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;
        cy.panBy({ x: dx, y: dy });
      };
      const endPan = () => {
        rmbPanning = false;
      };
      const onContextMenu = (ev: MouseEvent) => ev.preventDefault();
      container.addEventListener('mousedown', onMouseDown);
      // Window-level move/up so a drag that leaves the canvas still tracks
      // and terminates cleanly when the button is released anywhere.
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', endPan);
      container.addEventListener('mouseleave', endPan);
      container.addEventListener('contextmenu', onContextMenu);

      // Cytoscape only re-measures its container on `cy.resize()` or a window
      // resize, but this canvas is resized by plenty of things that fire
      // neither: collapsing the shell sidebar, the toolbar wrapping onto a
      // second row, the focus banner appearing. Left stale, every viewport
      // computation (fit, center, zoom-at-center) uses the mount-time size and
      // ends up off-centre. Re-panning around the previous viewport centre
      // keeps the user looking at the same part of the graph across a resize.
      const resizeObserver =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => {
              if (container.clientWidth === 0 || container.clientHeight === 0) return;
              const before = cy.extent();
              const focusX = (before.x1 + before.x2) / 2;
              const focusY = (before.y1 + before.y2) / 2;
              cy.resize();
              const zoom = cy.zoom();
              cy.pan({ x: cy.width() / 2 - focusX * zoom, y: cy.height() / 2 - focusY * zoom });
            });
      resizeObserver?.observe(container);

      return () => {
        resizeObserver?.disconnect();
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKeyUp);
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', endPan);
        container.removeEventListener('mouseleave', endPan);
        container.removeEventListener('contextmenu', onContextMenu);
        if (selectionEmitHandle !== null) {
          clearTimeout(selectionEmitHandle);
          selectionEmitHandle = null;
        }
        try { eh.destroy(); } catch { /* ignore */ }
        cy.destroy();
        cyRef.current = null;
        ehRef.current = null;
      };
      // Mount-once: model/cap changes are handled by the next effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync model/visibleIds → Cytoscape when they change from outside.
    useEffect(() => {
      const cy = cyRef.current;
      if (!cy) return;
      const visible = filterVisible(model, visibleIds);
      const current = cyToModel(cy, modelRef.current);
      const sameNodes =
        current.nodes.length === visible.nodes.length &&
        JSON.stringify(current.nodes.map((n) => [n.id, n.label, n.nodeType])) ===
          JSON.stringify(visible.nodes.map((n) => [n.id, n.label, n.nodeType]));
      const sameEdges =
        current.edges.length === visible.edges.length &&
        JSON.stringify(current.edges.map((e) => [e.id, e.source, e.target, e.label])) ===
          JSON.stringify(visible.edges.map((e) => [e.id, e.source, e.target, e.label]));
      const needsLayout = !hasMeaningfulPositions(visible.nodes);

      // Early-return only if *both* the structure matches AND positions are
      // already meaningful. Missing/stacked positions (first mount after a
      // layout change) must trigger a relayout even when structure is
      // unchanged.
      if (sameNodes && sameEdges && !needsLayout) return;

      const chosen = layoutRef.current;

      if (!sameNodes || !sameEdges) {
        // Structure differs — rebuild cy's element set from the model.
        // For 'grid' we pre-seed positions so the very first paint shows
        // nodes in place; concentric / fcose are run by cy after add.
        const preseed = needsLayout && chosen === 'grid'
          ? assignGridPositions(visible.nodes)
          : visible.nodes;
        const visibleToRender: KnowledgeGraphData = { ...visible, nodes: preseed };
        suppressEventsRef.current = true;
        try {
          cy.elements().remove();
          cy.add(modelToElements(visibleToRender));
        } finally {
          suppressEventsRef.current = false;
        }
      }

      // Apply whatever positions each element already has (via `preset`).
      cy.layout({ name: 'preset' } as any).run();
      if (!needsLayout) return;

      const persist = () => {
        fitAll(cy);
        const canvas = cyToModel(cy, modelRef.current);
        const visibleSet = new Set(visibleIdsRef.current);
        const merged = mergeWithFullModel(modelRef.current, canvas, visibleSet);
        onChangeRef.current(merged);
      };

      if (chosen === 'grid') {
        if (sameNodes && sameEdges) {
          // Structure unchanged so we didn't rebuild — apply grid positions
          // in-place on the existing cy nodes, then persist.
          const placed = assignGridPositions(visible.nodes);
          suppressEventsRef.current = true;
          try {
            cy.nodes().forEach((n) => {
              const found = placed.find((p) => p.id === String(n.data('id')));
              if (found?.position) n.position({ x: found.position.x, y: found.position.y });
            });
          } finally {
            suppressEventsRef.current = false;
          }
        }
        persist();
      } else {
        // concentric / fcose: run the algorithm on cy, wait for
        // layoutstop (fcose is iterative), then persist.
        runCyLayout(cy, chosen, persist);
      }
    }, [model, visibleIds]);

    // Arm / disarm the drag-to-connect gesture. Draw mode also freezes node
    // positions (`cy.autoungrabify(true)`); `disableDrawMode` restores the
    // previous grabbable state, so ordinary dragging — including the
    // multi-select drag-together above — comes back untouched.
    useEffect(() => {
      const eh = ehRef.current;
      if (!eh) return;
      if (connectMode === 'connect') {
        eh.enable();
        eh.enableDrawMode();
      } else {
        eh.disableDrawMode();
        eh.disable();
      }
    }, [connectMode]);

    // Palette drop: create a new node at the drop position.
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const cy = cyRef.current;
      if (!cy || !containerRef.current) return;
      const kind = e.dataTransfer.getData(KG_DRAG_MIME) as KGNodeType | '';
      if (!kind) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const renderedX = e.clientX - rect.left;
      const renderedY = e.clientY - rect.top;
      const pan = cy.pan();
      const zoom = cy.zoom();
      const x = (renderedX - pan.x) / zoom;
      const y = (renderedY - pan.y) / zoom;

      const id = newId(kind);
      const label = defaultLabelFor(kind);
      cy.add({
        group: 'nodes',
        data: { id, label, nodeType: kind, ...(kind === 'literal' ? { value: label } : {}) },
        position: { x, y },
      });
      emitChangeFromCy(cy);
    };

    return (
      <div
        ref={containerRef}
        className={`relative h-full w-full bg-background${
          connectMode === 'connect' ? ' cursor-crosshair' : ''
        }`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(KG_DRAG_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={handleDrop}
        tabIndex={0}
      />
    );
  },
);
CytoscapeCanvas.displayName = 'CytoscapeCanvas';

function defaultLabelFor(nodeType: KGNodeType): string {
  switch (nodeType) {
    case 'class': return 'Class';
    case 'individual': return 'individual';
    case 'property': return 'property';
    case 'literal': return 'literal';
    case 'blank': return '_:b';
  }
}
