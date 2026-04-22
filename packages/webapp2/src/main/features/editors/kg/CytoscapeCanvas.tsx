import React, { useEffect, useImperativeHandle, useRef } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import edgehandles from 'cytoscape-edgehandles';
import fcose from 'cytoscape-fcose';
import { kgStylesheet } from './stylesheet';
import { KG_DRAG_MIME } from './KnowledgeGraphPalette';
import type { KnowledgeGraphData, KGNodeData, KGEdgeData, KGNodeType } from './types';
import type { ConnectMode } from './KnowledgeGraphToolbar';
import type { KgSelection } from './KnowledgeGraphInspector';
import type { KnowledgeGraphLayout } from '../../../shared/types/project';

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

function cyToModel(cy: Core, previous: KnowledgeGraphData): KnowledgeGraphData {
  const nodes: KGNodeData[] = cy.nodes().map((n): KGNodeData => {
    const data = n.data();
    const position = n.position();
    return {
      id: String(data.id),
      label: data.label ?? '',
      nodeType: (data.nodeType as KGNodeType) ?? 'individual',
      iri: data.iri,
      value: data.value,
      datatype: data.datatype,
      position: { x: position.x, y: position.y },
    };
  });
  const edges: KGEdgeData[] = cy.edges().map((e): KGEdgeData => {
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
      mergedNodes.push(canvasNodeById.get(n.id)!);
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
}

export const CytoscapeCanvas = React.forwardRef<CytoscapeCanvasHandle, CytoscapeCanvasProps>(
  ({ model, visibleIds, layout, connectMode, onChange, onSelect, onExitConnectMode, onRevealNodes }, ref) => {
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
    const clickSourceRef = useRef<string | null>(null);
    // When we programmatically rebuild the canvas (`cy.elements().remove()`
    // followed by `cy.add(...)`) Cytoscape fires a cascade of `remove`
    // events. We must NOT treat those as user-initiated deletions or we end
    // up wiping the model. The sync effect raises this flag around the
    // rebuild; event handlers honour it.
    const suppressEventsRef = useRef(false);

    const emitChangeFromCy = (cy: Core) => {
      if (suppressEventsRef.current) return;
      const canvas = cyToModel(cy, modelRef.current);
      const visibleSet = new Set(visibleIdsRef.current);
      const merged = mergeWithFullModel(modelRef.current, canvas, visibleSet);
      onChangeRef.current(merged);
    };

    const clearClickSource = () => {
      const cy = cyRef.current;
      if (!cy) return;
      if (clickSourceRef.current) {
        cy.getElementById(clickSourceRef.current).removeClass('eh-source');
        clickSourceRef.current = null;
      }
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

    useImperativeHandle(ref, () => ({
      fit: () => cyRef.current?.fit(undefined, 40),
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
        clearClickSource();
      },
      relayout: () => {
        const cy = cyRef.current;
        if (!cy) return;
        const chosen = layoutRef.current;
        const persist = () => {
          cy.fit(undefined, 40);
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
      });
      cyRef.current = cy;

      // edgehandles is still registered so we keep the preview/source stylesheet
      // classes in sync — but we disable the hover-handle UI outright because
      // relation creation now happens through the toolbar's Add-relation mode.
      const eh = (cy as any).edgehandles({
        snap: true,
        hoverDelay: 150,
        handleNodes: 'node',
        canConnect: (source: any, target: any) => !source.same(target),
        edgeParams: () => ({ data: { id: newId('edge'), label: '' } }),
      });
      ehRef.current = eh;
      eh.disable();
      eh.disableDrawMode();

      cy.on('dragfreeon', 'node', () => emitChangeFromCy(cy));
      cy.on('remove', () => emitChangeFromCy(cy));

      cy.on('select', 'node', (evt) => {
        onSelectRef.current({ kind: 'node', id: String(evt.target.id()) });
      });
      cy.on('select', 'edge', (evt) => {
        onSelectRef.current({ kind: 'edge', id: String(evt.target.id()) });
      });
      cy.on('unselect', () => {
        if (cy.$(':selected').empty()) onSelectRef.current(null);
      });
      cy.on('tap', (evt) => {
        if (evt.target === cy) onSelectRef.current(null);
      });

      // Double-click to reveal a node's neighbors arranged in a circle
      // around it. Skipped in connect-mode so the tap pair isn't
      // hijacked while the user is actively creating edges.
      cy.on('dbltap', 'node', (evt) => {
        if (connectModeRef.current === 'connect') return;
        expandNeighbors(evt.target);
      });

      // Click-connect handler — only acts when the mode is active.
      cy.on('tap', 'node', (evt) => {
        if (connectModeRef.current !== 'connect') return;
        const node = evt.target;
        const id = String(node.id());
        const source = clickSourceRef.current;
        if (!source) {
          clickSourceRef.current = id;
          node.addClass('eh-source');
          return;
        }
        if (source === id) {
          clearClickSource();
          return;
        }
        // Commit the edge.
        cy.add({
          group: 'edges',
          data: { id: newId('edge'), source, target: id, label: '' },
        });
        clearClickSource();
        emitChangeFromCy(cy);
      });

      // Esc exits any connect mode and clears the in-progress source.
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
        if (ev.key === 'Escape') {
          if (connectModeRef.current !== 'off' || clickSourceRef.current) {
            clearClickSource();
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
      window.addEventListener('keydown', onKey);

      return () => {
        window.removeEventListener('keydown', onKey);
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
      clearClickSource();
      if (!needsLayout) return;

      const persist = () => {
        cy.fit(undefined, 40);
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

    // React to connect-mode changes — clear any in-progress source when the
    // mode is switched off.
    useEffect(() => {
      if (connectMode !== 'connect') {
        clearClickSource();
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
        className="relative h-full w-full bg-background"
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
