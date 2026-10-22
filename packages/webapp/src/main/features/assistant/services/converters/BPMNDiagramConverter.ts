/**
 * BPMN Diagram Converter
 * Converts a simplified BPMN process spec (nodes + flows, optionally grouped
 * into pools/lanes, plus data objects linked to nodes as inputs or outputs)
 * emitted by the modeling agent into the Apollon BPMNDiagram model.
 *
 * Agentic task / gateway / lane fields are kept when the spec supplies them;
 * the converter never infers agentic semantics on its own. Output shape
 * matches the verified BPMN template shape:
 * model.type === "BPMNDiagram"; sequence-flow paths are left for the editor's
 * layouter to recompute on load (isManuallyLayouted: false), so only element
 * bounds need to be correct here.
 *
 * Pools/lanes: confirmed against the hand-authored reference templates
 * (car_wash.json, pizza_store.json) that ALL bounds — including nodes drawn
 * inside a pool/lane — are ABSOLUTE canvas coordinates. Only BPMNSwimlane
 * elements set owner (to their pool's Apollon id); pools and every node/flow
 * keep owner: null and are placed purely by geometric overlap with the
 * pool/lane rectangle. flowType ('sequence' vs 'message') is derived here
 * from pool membership, never emitted by the agent.
 *
 * NOTE on naming: the converter is registered under the STORAGE-BUCKET token
 * "BPMN" (what SupportedDiagramType / the store use), but it emits the Apollon
 * model.type "BPMNDiagram". 
 */

import { DiagramConverter, centerElementsOnOrigin, generateUniqueId } from './base';

interface SpecNode {
  id?: string;
  name?: string;
  type?: string; // startEvent | endEvent | intermediateEvent | task | gateway
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
  poolId?: string; // optional: id of the pool (participant) this node belongs to
  laneId?: string; // optional: id of the lane (role) within poolId
  isAgentic?: boolean;
  reflectionMode?: string;
  // reviewer lane for reflectionMode 'cross', as a spec lane id or lane name
  reflectionReviewerLaneId?: string;
  trustScore?: number;
  agentDiagramRef?: string;
  gatewayRole?: string;
  governanceDsl?: string;
}

interface SpecFlow {
  source?: string; // node id
  target?: string; // node id
  name?: string; // optional edge label (branch condition)
  isDataAssociation?: boolean; // set here for data-object links, never by the agent
  dataObjectIsSource?: boolean; // input association: data object -> node
}

interface SpecDataObject {
  id?: string;
  name?: string;
}

interface SpecDataAssociation {
  dataObject?: string; // data object id
  node?: string; // id of the node that reads or produces it
  direction?: string; // 'input' | 'output'
}

interface SpecLane {
  id?: string;
  name?: string;
  isAgentic?: boolean;
  role?: string;
  trustScore?: number;
  multiplicity?: number;
  agentDiagramRef?: string;
}

interface SpecPool {
  id?: string;
  name?: string;
  lanes?: SpecLane[];
}

type StableNode = SpecNode & { id: string };
type DataPlan = {
  objects: Array<{ id: string; name: string; anchor?: string }>;
  flows: SpecFlow[];
  /** Vertical distance between node rows: ROW_GAP plus room for data objects. */
  rowGap: number;
  /** Horizontal distance between layers: COL_GAP, wider when a data row needs it. */
  colGap: number;
};
type Pool = {
  id: string;
  name: string;
  lanes: Array<{
    id: string;
    name: string;
    isAgentic?: boolean;
    role?: string;
    trustScore?: number;
    multiplicity?: number;
    agentDiagramRef?: string;
  }>;
};
const COL_GAP = 220; // horizontal distance between layers
const ROW_GAP = 120; // vertical distance between sibling nodes within a layer/band
const EVENT_SIZE = 40;
const TASK_W = 140;
const TASK_H = 60;
const DATA_W = 40; // matches the editor's BPMNDataObject preview
const DATA_H = 60;
const DATA_GAP = 30; // between a node and the row of its data objects
// The editor wraps a data object's name at twice its width, centered under it.
const DATA_LABEL_W = 2 * DATA_W;
const DATA_PITCH = DATA_LABEL_W; // labels of neighbours touch but never overlap
const DATA_ROW_GAP = 50; // a two-line label under each row
const DATA_PER_ROW = 3;

// Pool/lane geometry constants matching the editor's own BPMNPool/BPMNSwimlane
// classes (packages/editor/.../bpmn-pool/bpmn-pool.ts) and the reference
// templates, so first-paint geometry looks like a hand-laid-out diagram.
const POOL_HEADER_WIDTH = 40; // matches BPMNPool.HEADER_WIDTH
const POOL_GAP = 40; // vertical gap between sibling pools
const BAND_V_PADDING = 20; // top/bottom padding inside a lane/pool band
const BAND_MIN_HEIGHT = 130; // matches the reference templates' single-row lane height

const TASK_TYPES = new Set(['default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'script']);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

export class BPMNDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'BPMN' as const;
  }

  convertSingleElement(spec: any) {
    // Single-element generation funnels into a one-node process so the
    // DiagramConverter contract still holds (the agent funnels these the
    // same way as the single-element generation path).
    return this.convertCompleteSystem({ nodes: [spec], flows: [] });
  }

  convertCompleteSystem(systemSpec: any) {
    const rawNodes: SpecNode[] = Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : [];
    const flows: SpecFlow[] = Array.isArray(systemSpec?.flows) ? systemSpec.flows : [];
    const rawPools: SpecPool[] = Array.isArray(systemSpec?.pools) ? systemSpec.pools : [];

    // Give every node a stable spec-id (referenced by flows).
    const nodes: StableNode[] = rawNodes.map((n, i) => ({
      ...n,
      id: typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `n${i}`,
    }));

    const pools: Pool[] = rawPools
      .filter((p): p is SpecPool & { id: string } => typeof p.id === 'string' && p.id.trim().length > 0)
      .map((p) => ({
        id: p.id.trim(),
        name: typeof p.name === 'string' ? p.name : '',
        lanes: (Array.isArray(p.lanes) ? p.lanes : [])
          .filter((l): l is SpecLane & { id: string } => typeof l.id === 'string' && l.id.trim().length > 0)
          .map((l) => ({
            id: l.id.trim(),
            name: typeof l.name === 'string' ? l.name : '',
            isAgentic: l.isAgentic,
            role: l.role,
            trustScore: l.trustScore,
            multiplicity: l.multiplicity,
            agentDiagramRef: l.agentDiagramRef,
          })),
      }));

    // --- Layered left-to-right layout (longest-path layering). Computed over
    // the FULL flow graph (including cross-pool message flows) so columns
    // line up visually across pools/lanes, matching the reference templates. ---
    const layerOf = this.computeLayers(nodes, flows);

    const data = this.collectDataObjects(systemSpec, nodes);

    if (pools.length === 0) {
      return this.layoutFlat(nodes, flows, layerOf, data);
    }
    return this.layoutWithPools(nodes, flows, pools, layerOf, data);
  }

  /**
   * Reads `dataObjects` + `dataAssociations`. Each data object is anchored to
   * the first node it is linked to and is placed under it once the process
   * is laid out (see placeDataObjects); the rows are spaced to leave room.
   */
  private collectDataObjects(systemSpec: any, nodes: StableNode[]): DataPlan {
    const rawObjects: SpecDataObject[] = Array.isArray(systemSpec?.dataObjects) ? systemSpec.dataObjects : [];
    const rawAssociations: SpecDataAssociation[] = Array.isArray(systemSpec?.dataAssociations)
      ? systemSpec.dataAssociations
      : [];
    const nodeIds = new Set(nodes.map((n) => n.id));
    const taken = new Set(nodeIds);
    const objects: DataPlan['objects'] = [];
    const flows: SpecFlow[] = [];
    const perAnchor: Record<string, number> = {};

    rawObjects.forEach((obj) => {
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      if (!id || taken.has(id)) return;
      taken.add(id);
      const links = rawAssociations.filter(
        (a) => a.dataObject === id && typeof a.node === 'string' && nodeIds.has(a.node),
      );
      const anchor = links.length ? String(links[0].node) : undefined;
      if (anchor) perAnchor[anchor] = (perAnchor[anchor] ?? 0) + 1;
      objects.push({ id, name: typeof obj.name === 'string' ? obj.name : '', anchor });
      links.forEach((a) => {
        const isInput = a.direction !== 'output';
        flows.push({
          source: isInput ? id : a.node,
          target: isInput ? a.node : id,
          name: '',
          isDataAssociation: true,
          dataObjectIsSource: isInput,
        });
      });
    });

    const most = Math.max(0, ...Object.values(perAnchor));
    const dataRows = Math.ceil(most / DATA_PER_ROW);
    const rowGap = dataRows ? ROW_GAP + DATA_GAP + dataRows * (DATA_H + DATA_ROW_GAP) : ROW_GAP;
    // Widest data row plus half a pitch for a staggered second row, and a margin.
    const rowSpan = Math.min(most, DATA_PER_ROW) * DATA_PITCH + (dataRows > 1 ? DATA_PITCH / 2 : 0);
    const colGap = Math.max(COL_GAP, rowSpan + 40);
    return { objects, flows, rowGap, colGap };
  }

  /**
   * Places each node's data objects in rows centered under it; unlinked ones
   * go below everything. Every other row is shifted by half a pitch so its
   * associations pass between the data objects above instead of through them.
   */
  private placeDataObjects(data: DataPlan, elements: Record<string, any>, idMap: Record<string, string>): void {
    if (!data.objects.length) return;
    const groups = new Map<string, DataPlan['objects']>();
    data.objects.forEach((obj) => {
      const key = obj.anchor && idMap[obj.anchor] ? obj.anchor : '';
      groups.set(key, [...(groups.get(key) ?? []), obj]);
    });
    const placed = Object.values(elements).map((el) => el.bounds);
    const left = Math.min(...placed.map((b) => b.x));
    const bottom = Math.max(...placed.map((b) => b.y + b.height));

    groups.forEach((objs, anchorId) => {
      const anchor = anchorId ? elements[idMap[anchorId]] : undefined;
      const top = anchor ? anchor.bounds.y + anchor.bounds.height + DATA_GAP : bottom + DATA_GAP;
      objs.forEach((obj, i) => {
        const row = Math.floor(i / DATA_PER_ROW);
        const inRow = Math.min(DATA_PER_ROW, objs.length - row * DATA_PER_ROW);
        const rowWidth = (inRow - 1) * DATA_PITCH + DATA_W;
        const stagger = row % 2 ? DATA_PITCH / 2 : 0;
        const rowLeft = (anchor ? anchor.bounds.x + (anchor.bounds.width - rowWidth) / 2 : left) + stagger;
        const apollonId = generateUniqueId('bpmn');
        idMap[obj.id] = apollonId;
        elements[apollonId] = {
          id: apollonId,
          name: obj.name,
          type: 'BPMNDataObject',
          owner: anchor?.owner ?? null,
          bounds: {
            x: rowLeft + (i % DATA_PER_ROW) * DATA_PITCH,
            y: top + row * (DATA_H + DATA_ROW_GAP),
            width: DATA_W,
            height: DATA_H,
          },
        };
      });
    });
  }

  // ------------------------------------------------------------------
  // Flat process (no pools) — original algorithm, unchanged.
  // ------------------------------------------------------------------

  private layoutFlat(nodes: StableNode[], flows: SpecFlow[], layerOf: Record<string, number>, data: DataPlan) {
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {}; // spec id -> apollon id

    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });

    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const row = byLayer[layer].indexOf(n.id);
      const x = layer * data.colGap;
      const y = row * data.rowGap;
      this.emitNodeElement(n, x, y, elements, idMap);
    });
    this.placeDataObjects(data, elements, idMap);

    [...flows, ...data.flows].forEach((f) => this.emitFlow(f, idMap, layerOf, byLayer, relationships));

    // --- Center the content on the origin (0,0) ---
    centerElementsOnOrigin(elements);

    // --- Diagram-size envelope ---
    const layerKeys = Object.keys(byLayer).map(Number);
    const maxLayer = layerKeys.length ? Math.max(...layerKeys) : 0;
    const maxRows = Object.values(byLayer).reduce((m, a) => Math.max(m, a.length), 1);

    return {
      version: '3.0.0',
      type: 'BPMNDiagram',
      size: {
        width: Math.max(600, (maxLayer + 1) * data.colGap),
        height: Math.max(320, maxRows * data.rowGap),
      },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }

  // ------------------------------------------------------------------
  // Collaboration diagram (pools/lanes present).
  // ------------------------------------------------------------------

  private layoutWithPools(
    nodes: StableNode[],
    flows: SpecFlow[],
    pools: Pool[],
    layerOf: Record<string, number>,
    data: DataPlan,
  ) {
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {}; // spec id -> apollon id
    const laneIdMap: Record<string, string> = {}; // spec pool::lane -> apollon swimlane id

    // --- Band model: one band per lane, or one band per pool when it has no
    // lanes. Nodes with an unrecognized/missing poolId land in a trailing
    // flat band so a partially-specified spec never loses a node. ---
    type Band = { key: string; nodeIds: string[] };
    const poolIndexOf: Record<string, number> = {}; // spec node id -> pool stacking order (for message-flow detection)
    const bandKeyOf: Record<string, string> = {};
    const bandsByPool: Record<string, Band[]> = {};

    pools.forEach((pool, pIdx) => {
      const laneBands: Band[] = pool.lanes.length
        ? pool.lanes.map((lane) => ({ key: `${pool.id}::${lane.id}`, nodeIds: [] }))
        : [{ key: `${pool.id}::__self`, nodeIds: [] }];
      bandsByPool[pool.id] = laneBands;

      nodes.forEach((n) => {
        if (n.poolId !== pool.id) return;
        poolIndexOf[n.id] = pIdx;
        const lane = pool.lanes.find((l) => l.id === n.laneId);
        const band = (lane && laneBands.find((b) => b.key === `${pool.id}::${lane.id}`)) || laneBands[0];
        band.nodeIds.push(n.id);
        bandKeyOf[n.id] = band.key;
      });
    });

    const orphanBand: Band = { key: '__none', nodeIds: [] };
    nodes.forEach((n) => {
      if (!(n.id in bandKeyOf)) {
        orphanBand.nodeIds.push(n.id);
        bandKeyOf[n.id] = orphanBand.key;
      }
    });

    // --- Row assignment within each band (nodes sharing a layer stack vertically) ---
    const rowOf: Record<string, number> = {};
    const maxRowsOf: Record<string, number> = {};
    const allBands: Band[] = [
      ...pools.flatMap((p) => bandsByPool[p.id]),
      ...(orphanBand.nodeIds.length ? [orphanBand] : []),
    ];
    allBands.forEach((band) => {
      const byLayerInBand: Record<number, string[]> = {};
      band.nodeIds.forEach((id) => {
        const L = layerOf[id] ?? 0;
        (byLayerInBand[L] ||= []).push(id);
      });
      let maxRows = 1;
      Object.values(byLayerInBand).forEach((ids) => {
        ids.forEach((id, i) => {
          rowOf[id] = i;
        });
        maxRows = Math.max(maxRows, ids.length);
      });
      maxRowsOf[band.key] = band.nodeIds.length ? maxRows : 0;
    });

    // --- Column width shared by every pool so they visually align ---
    const layerValues = Object.values(layerOf);
    const maxLayer = layerValues.length ? Math.max(...layerValues) : 0;
    const contentWidth = (maxLayer + 1) * data.colGap;
    const poolWidth = Math.max(400, POOL_HEADER_WIDTH + contentWidth + data.colGap / 2);

    // --- Stack pools top-to-bottom; lanes stack top-to-bottom within a pool ---
    let cursorY = 0;
    const bandOriginY: Record<string, number> = {};

    pools.forEach((pool) => {
      const bands = bandsByPool[pool.id];
      const poolY = cursorY;
      let laneCursorY = poolY;
      bands.forEach((band) => {
        const rows = maxRowsOf[band.key] || 1;
        const bandHeight = Math.max(BAND_MIN_HEIGHT, rows * data.rowGap + BAND_V_PADDING * 2);
        bandOriginY[band.key] = laneCursorY;
        laneCursorY += bandHeight;
      });
      const poolHeight = laneCursorY - poolY;

      const poolApollonId = generateUniqueId('bpmn');
      elements[poolApollonId] = {
        id: poolApollonId,
        name: pool.name,
        type: 'BPMNPool',
        owner: null,
        bounds: { x: 0, y: poolY, width: poolWidth, height: poolHeight },
      };

      pool.lanes.forEach((lane, i) => {
        const band = bands[i];
        const laneApollonId = generateUniqueId('bpmn');
        laneIdMap[`${pool.id}::${lane.id}`] = laneApollonId;
        elements[laneApollonId] = {
          id: laneApollonId,
          name: lane.name,
          type: 'BPMNSwimlane',
          owner: poolApollonId,
          bounds: {
            x: POOL_HEADER_WIDTH,
            y: bandOriginY[band.key],
            width: poolWidth - POOL_HEADER_WIDTH,
            height: Math.max(BAND_MIN_HEIGHT, (maxRowsOf[band.key] || 1) * data.rowGap + BAND_V_PADDING * 2),
          },
          isAgentic: lane.isAgentic === true,
          role: lane.role,
          trustScore: typeof lane.trustScore === 'number' ? lane.trustScore : 0,
          multiplicity: typeof lane.multiplicity === 'number' ? lane.multiplicity : 1,
          ...(typeof lane.agentDiagramRef === 'string' && lane.agentDiagramRef
            ? { agentDiagramRef: lane.agentDiagramRef }
            : {}),
        };
      });

      cursorY = poolY + poolHeight + POOL_GAP;
    });

    // --- Trailing flat band for nodes with no recognized pool (fallback) ---
    if (orphanBand.nodeIds.length) {
      bandOriginY[orphanBand.key] = cursorY;
    }

    // A spec lane reference (lane id, preferring the node's own pool, else a
    // lane name) → the emitted swimlane id; undefined when nothing matches.
    const resolveLaneRef = (ref: string | undefined, poolId?: string): string | undefined => {
      const key = ref?.trim();
      if (!key) return undefined;
      if (poolId && laneIdMap[`${poolId}::${key}`]) return laneIdMap[`${poolId}::${key}`];
      for (const pool of pools) {
        if (laneIdMap[`${pool.id}::${key}`]) return laneIdMap[`${pool.id}::${key}`];
      }
      const lower = key.toLowerCase();
      for (const pool of pools) {
        const lane = pool.lanes.find((l) => l.name.trim().toLowerCase() === lower);
        if (lane) return laneIdMap[`${pool.id}::${lane.id}`];
      }
      return undefined;
    };

    // --- Emit node elements ---
    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const bandY = bandOriginY[bandKeyOf[n.id]] ?? 0;
      const row = rowOf[n.id] ?? 0;
      const x = POOL_HEADER_WIDTH + layer * data.colGap;
      const y = bandY + BAND_V_PADDING + row * data.rowGap;
      const owner = n.poolId && n.laneId ? laneIdMap[`${n.poolId}::${n.laneId}`] ?? null : null;
      const reviewerLaneId = resolveLaneRef(n.reflectionReviewerLaneId, n.poolId);
      this.emitNodeElement(n, x, y, elements, idMap, owner, reviewerLaneId);
    });

    // --- Emit flows: cross-pool flows become message flows with a vertical
    // direction override (matches the reference templates); everything else
    // uses the generic geometry-based heuristic. ---
    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });
    this.placeDataObjects(data, elements, idMap);
    [...flows, ...data.flows].forEach((f) => this.emitFlow(f, idMap, layerOf, byLayer, relationships, poolIndexOf));

    return this.finalizeModel(elements, relationships);
  }

  // ------------------------------------------------------------------
  // Shared element/flow emission
  // ------------------------------------------------------------------

  private emitNodeElement(
    n: StableNode,
    x: number,
    y: number,
    elements: Record<string, any>,
    idMap: Record<string, string>,
    owner: string | null = null,
    /** Resolved editor id of the cross-reflection reviewer lane, if any. */
    reflectionReviewerLaneId?: string,
  ): void {
    const apollonType = this.normalizeType(n.type);
    const isTask = apollonType === 'BPMNTask';
    const w = isTask ? TASK_W : EVENT_SIZE;
    const h = isTask ? TASK_H : EVENT_SIZE;
    const apollonId = generateUniqueId('bpmn');
    idMap[n.id] = apollonId;

    const base = {
      id: apollonId,
      name: typeof n.name === 'string' ? n.name : '',
      type: apollonType,
      owner,
      bounds: { x, y, width: w, height: h },
    };

    if (apollonType === 'BPMNTask') {
      const taskType = TASK_TYPES.has(String(n.taskType)) ? n.taskType : 'default';
      elements[apollonId] = {
        ...base,
        taskType,
        marker: 'none',
        isAgentic: n.isAgentic === true,
        reflectionMode: typeof n.reflectionMode === 'string' ? n.reflectionMode : 'none',
        trustScore: typeof n.trustScore === 'number' ? n.trustScore : 0,
        ...(typeof n.agentDiagramRef === 'string' && n.agentDiagramRef
          ? { agentDiagramRef: n.agentDiagramRef }
          : {}),
        ...(reflectionReviewerLaneId ? { reflectionReviewerLaneId } : {}),
      };
    } else if (apollonType === 'BPMNGateway') {
      const gatewayType = GATEWAY_TYPES.has(String(n.gatewayType)) ? n.gatewayType : 'exclusive';
      elements[apollonId] = {
        ...base,
        gatewayType,
        isAgentic: n.isAgentic === true,
        gatewayRole: typeof n.gatewayRole === 'string' ? n.gatewayRole : 'diverging',
        trustScore: typeof n.trustScore === 'number' ? n.trustScore : 0,
        ...(typeof n.governanceDsl === 'string' && n.governanceDsl.trim()
          ? { governanceDsl: n.governanceDsl }
          : {}),
      };
    } else {
      // BPMNStartEvent / BPMNEndEvent / BPMNIntermediateEvent
      const eventType = typeof n.eventType === 'string' && n.eventType ? n.eventType : 'default';
      elements[apollonId] = { ...base, eventType };
    }
  }

  /**
   * Emits a sequence-flow relationship. Geometry is placeholder; the editor's
   * layouter recomputes the path on load (isManuallyLayouted false), exactly
   * like StateMachineConverter's transitions. When `poolIndexOf` is supplied
   * and the flow's endpoints sit in different pools, it becomes a message
   * flow with a vertical direction override (matches car_wash/pizza_store's
   * cross-pool flows, which are always Down/Up rather than Left/Right).
   */
  private emitFlow(
    f: SpecFlow,
    idMap: Record<string, string>,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
    relationships: Record<string, any>,
    poolIndexOf?: Record<string, number>,
  ): void {
    const sourceId = idMap[String(f.source)];
    const targetId = idMap[String(f.target)];
    if (!sourceId || !targetId) return; // skip dangling refs

    const relId = generateUniqueId('flow');
    let { sourceDir, targetDir } = f.isDataAssociation
      ? f.dataObjectIsSource
        ? { sourceDir: 'Up', targetDir: 'Down' }
        : { sourceDir: 'Down', targetDir: 'Up' }
      : this.edgeDirections(String(f.source), String(f.target), layerOf, byLayer);

    let flowType: 'sequence' | 'message' | 'data association' = f.isDataAssociation ? 'data association' : 'sequence';
    if (poolIndexOf && !f.isDataAssociation) {
      const sPool = poolIndexOf[String(f.source)];
      const tPool = poolIndexOf[String(f.target)];
      if (sPool !== undefined && tPool !== undefined && sPool !== tPool) {
        flowType = 'message';
        sourceDir = sPool < tPool ? 'Down' : 'Up';
        targetDir = sPool < tPool ? 'Up' : 'Down';
      }
    }

    relationships[relId] = {
      id: relId,
      name: typeof f.name === 'string' ? f.name : '',
      type: 'BPMNFlow',
      owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      source: { direction: sourceDir, element: sourceId },
      target: { direction: targetDir, element: targetId },
      isManuallyLayouted: false,
      flowType,
      isDefault: false,
    };
  }

  /** Centers content on the origin and wraps it into a full BPMNDiagram model. */
  private finalizeModel(elements: Record<string, any>, relationships: Record<string, any>) {
    const size = centerElementsOnOrigin(elements);
    const width = Math.max(600, size?.width ?? 0);
    const height = Math.max(320, size?.height ?? 0);

    return {
      version: '3.0.0',
      type: 'BPMNDiagram',
      size: { width, height },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }

  // ------------------------------------------------------------------

  private normalizeType(rawType?: string): string {
    const t = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (t === 'startevent' || t === 'start' || t === 'startnode') return 'BPMNStartEvent';
    if (t === 'endevent' || t === 'end' || t === 'endnode') return 'BPMNEndEvent';
    if (t === 'intermediateevent' || t === 'intermediate') return 'BPMNIntermediateEvent';
    if (t === 'gateway' || t === 'gate') return 'BPMNGateway';
    return 'BPMNTask'; // default: any unrecognized node is a task
  }

  /** Longest-path layer assignment over the sequence-flow graph (cycle-safe). */
  private computeLayers(nodes: { id: string }[], flows: SpecFlow[]): Record<string, number> {
    const ids = new Set(nodes.map((n) => n.id));
    const succ: Record<string, string[]> = {};
    const indeg: Record<string, number> = {};
    nodes.forEach((n) => {
      succ[n.id] = [];
      indeg[n.id] = 0;
    });
    flows.forEach((f) => {
      const s = String(f.source);
      const t = String(f.target);
      if (ids.has(s) && ids.has(t) && s !== t) {
        succ[s].push(t);
        indeg[t] += 1;
      }
    });

    const layer: Record<string, number> = {};
    const remaining = { ...indeg };
    const queue: string[] = [];
    nodes.forEach((n) => {
      if (indeg[n.id] === 0) {
        layer[n.id] = 0;
        queue.push(n.id);
      }
    });
    // Pure cycle with no source: seed the first node at layer 0.
    if (queue.length === 0 && nodes.length) {
      layer[nodes[0].id] = 0;
      queue.push(nodes[0].id);
    }

    const visited = new Set<string>();
    while (queue.length) {
      const u = queue.shift() as string;
      if (visited.has(u)) continue;
      visited.add(u);
      const lu = layer[u] ?? 0;
      succ[u].forEach((v) => {
        layer[v] = Math.max(layer[v] ?? 0, lu + 1);
        remaining[v] -= 1;
        if (remaining[v] <= 0 && !visited.has(v)) queue.push(v);
      });
    }
    // Any node never reached (cycle remnant) gets a best-effort layer 0.
    nodes.forEach((n) => {
      if (!(n.id in layer)) layer[n.id] = 0;
    });
    return layer;
  }

  /** Cheap geometry-based edge direction for a nicer first paint (the
   *  layouter re-routes anyway, but good initial directions reduce flicker). */
  private edgeDirections(
    sourceId: string,
    targetId: string,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
  ): { sourceDir: string; targetDir: string } {
    const sLayer = layerOf[sourceId] ?? 0;
    const tLayer = layerOf[targetId] ?? 0;
    const sRow = (byLayer[sLayer] || []).indexOf(sourceId);
    const tRow = (byLayer[tLayer] || []).indexOf(targetId);
    const dx = tLayer - sLayer;
    const dy = tRow - sRow;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { sourceDir: 'Right', targetDir: 'Left' } : { sourceDir: 'Left', targetDir: 'Right' };
    }
    return dy >= 0 ? { sourceDir: 'Down', targetDir: 'Up' } : { sourceDir: 'Up', targetDir: 'Down' };
  }
}
