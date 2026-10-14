import React, { useEffect, useImperativeHandle, useRef } from 'react';
import cytoscape, { Core } from 'cytoscape';
import edgehandles from 'cytoscape-edgehandles';
import fcose from 'cytoscape-fcose';
import { kgStylesheet } from './stylesheet';
import { buildStandaloneHtml, type StandaloneHtmlStrings } from './standaloneHtmlTemplate';
import { KG_DRAG_MIME } from './KnowledgeGraphPalette';
import type { KnowledgeGraphData, KGNodeData, KGNodeType } from './types';
import type { ConnectMode } from './KnowledgeGraphToolbar';
import type { KgSelection } from './KnowledgeGraphInspector';
import type { KnowledgeGraphLayout } from '../../../shared/types/project';
import { isEdgeAllowed, explainEdgeRejection } from './edge-rules';
import { createCanvasKeyHandlers } from './canvasKeys';
import {
  coalesceToNextTick,
  cyToModel,
  filterVisible,
  mergeWithFullModel,
  modelToElements,
  newNodeElement,
  nodesToReposition,
  type CanvasChangeOptions,
} from './canvasModel';
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

function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}:${rand}`;
}

export interface CytoscapeCanvasHandle {
  fit: () => void;
  clearSelection: () => void;
  /** Force a fresh layout pass using the currently-configured algorithm,
   *  overwriting persisted positions. Called when the user changes the
   *  layout setting. */
  relayout: () => void;
  /** Serialize the live Cytoscape instance into a self-contained HTML
   *  viewer. Returns null if the instance hasn't initialized yet.
   *  `strings` and `lang` are resolved by the caller (which holds `t`) so the
   *  exported file carries the user's language -- this handle is created once
   *  with empty deps and cannot subscribe to language changes itself. */
  exportHtml: (title: string, strings: StandaloneHtmlStrings, lang: string) => string | null;
  /** Zoom in/out around the current viewport center (so the user keeps
   *  looking at the same place as they zoom). Clamped by minZoom/maxZoom. */
  zoomIn: () => void;
  zoomOut: () => void;
}

interface CytoscapeCanvasProps {
  model: KnowledgeGraphData;
  /** Ordered list of node IDs to render on the canvas; owned by the editor
   *  so deleting nodes doesn't "promote" hidden ones into view. */
  visibleIds: string[];
  /** Node ids that must never be put on the canvas, even when something on
   *  the canvas asks for them (currently: the owl/rdf/rdfs/SHACL-shape
   *  declaration nodes the editor filters out of the visualization, see
   *  `meta-vocab.ts`). They remain in `model` — the
   *  canvas merges its edits back over it — they are just not renderable. */
  nonVisualizableIds?: ReadonlySet<string>;
  /** Layout algorithm. Runs once when the visible graph has no positions,
   *  or on an explicit `relayout()` call. Subsequent edits (drag, add,
   *  delete) do not re-run the layout. */
  layout: KnowledgeGraphLayout;
  connectMode: ConnectMode;
  /** `options.undoable === false` marks a change the user did not make (the
   *  automatic layout of a freshly loaded graph), which must not become an undo
   *  step. Everything else on the canvas is the user's. */
  onChange: (next: KnowledgeGraphData, options?: CanvasChangeOptions) => void;
  /** Ctrl/Cmd+Z and Ctrl+Y / Ctrl+Shift+Z while the canvas has focus. */
  onUndo?: () => void;
  onRedo?: () => void;
  onSelect: (sel: KgSelection) => void;
  onExitConnectMode?: () => void;
  /** Called when the canvas wants to reveal a set of node ids (e.g. after
   *  a double-click to expand neighbors). The editor enforces the hard
   *  limit and surfaces the toast when the set doesn't fit. */
  onRevealNodes?: (ids: string[]) => void;
  /** Called when a drag-to-connect gesture ended on a node the OWL2 DL rules
   *  forbid, with a human-readable reason. The editor surfaces it as a toast. */
  onRelationRejected?: (reason: string) => void;
  /** Called when the user presses Delete/Backspace with something selected.
   *  The canvas deliberately removes nothing itself: deleting is destructive
   *  and irreversible, so the editor prompts for confirmation and then applies
   *  the removal to the model, which comes back in as new props. */
  onRequestDelete?: (selection: { nodeIds: string[]; edgeIds: string[] }) => void;
}

export const CytoscapeCanvas = React.forwardRef<CytoscapeCanvasHandle, CytoscapeCanvasProps>(
  (
    {
      model,
      visibleIds,
      nonVisualizableIds,
      layout,
      connectMode,
      onChange,
      onUndo,
      onRedo,
      onSelect,
      onExitConnectMode,
      onRevealNodes,
      onRelationRejected,
      onRequestDelete,
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
    const nonVisualizableIdsRef = useRef<ReadonlySet<string>>(nonVisualizableIds ?? new Set());
    nonVisualizableIdsRef.current = nonVisualizableIds ?? new Set();
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onUndoRef = useRef(onUndo);
    onUndoRef.current = onUndo;
    const onRedoRef = useRef(onRedo);
    onRedoRef.current = onRedo;
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
    const onRequestDeleteRef = useRef(onRequestDelete);
    onRequestDeleteRef.current = onRequestDelete;
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

      // Vocabulary neighbours (owl:Class, sh:NodeShape, …) are skipped: the
      // editor would refuse to reveal them anyway, and including them here
      // would leave gaps in the circle and make an expand whose neighbours
      // are *all* vocabulary look like a no-op that still moved nodes.
      const nonVisualizable = nonVisualizableIdsRef.current;
      const neighborIds = new Set<string>();
      for (const edge of modelRef.current.edges) {
        if (edge.source === sourceId) neighborIds.add(edge.target);
        else if (edge.target === sourceId) neighborIds.add(edge.source);
      }
      neighborIds.delete(sourceId);
      for (const id of nonVisualizable) neighborIds.delete(id);
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
      exportHtml: (title: string, strings: StandaloneHtmlStrings, lang: string) => {
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
          strings,
          lang,
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

      // Dragging several selected nodes ends with one event per node. That is
      // one user action, so it is emitted once: one change, one undo step.
      const emitAfterDrag = coalesceToNextTick(() => emitChangeFromCy(cy));
      cy.on('dragfreeon', 'node', emitAfterDrag);
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

      // Esc exits connect mode; Space held = temporarily enable panning (plain
      // drag is otherwise used for box-selecting); Delete/Backspace asks the
      // editor to delete the selection. Which of these the canvas may take
      // depends on focus, see canvasKeys.ts.
      const { onKeyDown: onKey, onKeyUp } = createCanvasKeyHandlers({
        getContainer: () => containerRef.current,
        setPanning: (on) => cy.userPanningEnabled(on),
        getSelection: () => {
          const sel = cy.$(':selected');
          return {
            nodeIds: sel.nodes().map((n) => String(n.id())),
            edgeIds: sel.edges().map((e) => String(e.id())),
          };
        },
        getConnectMode: () => connectModeRef.current,
        exitConnectMode: () => onExitConnectMode?.(),
        // The canvas removes nothing itself: deleting is destructive, so the
        // editor confirms with the user first and then edits the model.
        requestDelete: (selection) => onRequestDeleteRef.current?.(selection),
        undo: () => onUndoRef.current?.(),
        redo: () => onRedoRef.current?.(),
      });
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKeyUp);
      // The shortcuts above only fire while the canvas has focus, so a tap on
      // it must give it focus (a <canvas> inside a tabIndex container does not
      // always get it from the browser).
      cy.on('tapstart', () => containerRef.current?.focus({ preventScroll: true }));

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
        emitAfterDrag.cancel();
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
      if (sameNodes && sameEdges && !needsLayout) {
        // Nothing structural changed, but the model may still hold other
        // positions than the canvas shows: that is what undoing a drag or a
        // layout looks like. Move the nodes there (without echoing the move
        // back as a user edit).
        const moves = nodesToReposition(current.nodes, visible.nodes);
        if (moves.length > 0) {
          suppressEventsRef.current = true;
          try {
            cy.batch(() => {
              for (const m of moves) cy.getElementById(m.id).position({ x: m.x, y: m.y });
            });
          } finally {
            suppressEventsRef.current = false;
          }
        }
        return;
      }

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

      // This runs because the graph has no usable positions (first display after
      // a load): an automatic layout, not something the user did, so it must
      // not become an undo step.
      const persist = () => {
        fitAll(cy);
        const canvas = cyToModel(cy, modelRef.current);
        const visibleSet = new Set(visibleIdsRef.current);
        const merged = mergeWithFullModel(modelRef.current, canvas, visibleSet);
        onChangeRef.current(merged, { undoable: false });
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
      cy.add(newNodeElement(id, kind, { x, y }));
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
