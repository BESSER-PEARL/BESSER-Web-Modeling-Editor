/**
 * BPMN Diagram Converter (v4-native)
 *
 * Converts a simplified BPMN process spec (nodes + flows, optionally grouped
 * into pools/lanes, plus data objects linked to nodes as inputs or outputs)
 * emitted by the modeling agent straight into the canonical v4 shape ({ version: '4.0.0', type: 'BPMNDiagram', nodes[], edges[] }).
 *
 * Re-targets develop's v3 (elements/relationships) BPMNDiagramConverter to the
 * React-Flow migration's v4 nodes/edges:
 *   - node `type` is lowerCamelCase (`bpmnTask`, `bpmnStartEvent`, `bpmnPool`,
 *     `bpmnSwimlane`, …); containment is via top-level `parentId` with the
 *     child position RELATIVE to its parent (pools are top-level, lanes carry
 *     `parentId = pool.id`, flow nodes carry `parentId = lane.id` or the pool),
 *   - flows are one of the four v4 edge-type strings; the label is written to
 *     BOTH `edge.data.name` AND `edge.data.label`; cross-pool flows become
 *     message flows; `edge.data.isDefault` carries the default-flow marker,
 *   - agentic lane / task / gateway fields go into `node.data` under their v3
 *     names, only on elements the spec marks agentic (never inferred); a
 *     gateway's `governancePolicy` expands to a generated `governanceDsl`,
 *   - the finished layout is shifted so its bounding box is centred on the
 *     origin (0,0) — the same convention develop's converter used so the
 *     viewport-recentering heuristics in `useModelInjection` see a stable,
 *     origin-anchored diagram after every complete-system injection.
 *
 * NOTE on naming: the converter is registered under the STORAGE-BUCKET token
 * "BPMN" (what `SupportedDiagramType` / the store use), but it emits the model
 * `type` value `UMLDiagramType.BPMN` (=== "BPMNDiagram").
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { UMLDiagramType, clampIntoLaneBody, resolveBpmnEdgeType } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import { DiagramConverter, centerNodesOnOrigin, generateUniqueId } from './base';
import {
  BpmnAgenticSpec,
  bpmnGatewayAgenticData,
  bpmnLaneAgenticData,
  bpmnTaskAgenticData,
  createEmptyV4Model,
  directionToHandle,
  resolveGovernanceDsl,
} from '../shared/v4Builders';

interface SpecNode extends BpmnAgenticSpec {
  id?: string;
  name?: string;
  type?: string; // startEvent | endEvent | intermediateEvent | task | gateway | subprocess | …
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
  poolId?: string; // optional: id of the pool (participant) this node belongs to
  laneId?: string; // optional: id of the lane (role) within poolId
  // reviewer lane for reflectionMode 'cross', as a spec lane id or lane name
  reflectionReviewerLaneId?: string;
}

interface SpecFlow {
  source?: string; // node id
  target?: string; // node id
  name?: string; // optional edge label (branch condition)
  isDefault?: boolean; // default sequence flow marker
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

interface SpecLane extends BpmnAgenticSpec {
  id?: string;
  name?: string;
}

interface SpecPool {
  id?: string;
  name?: string;
  lanes?: SpecLane[];
}

type StableNode = SpecNode & { id: string };
type Pool = { id: string; name: string; lanes: Array<SpecLane & { id: string; name: string }> };
type DataPlan = {
  objects: Array<{ id: string; name: string; anchor?: string }>;
  flows: SpecFlow[];
  /** Vertical distance between node rows: ROW_GAP plus room for data objects. */
  rowGap: number;
  /** Horizontal distance between layers: COL_GAP, wider when a data row needs it. */
  colGap: number;
};
/** The node a band's flow nodes are parented to, with its canvas origin. */
type BandParent = { id: string; absX: number; absY: number; lane?: { type: string; data: Record<string, unknown> } };
/** A laid-out flow node in canvas coordinates, with the parent it was placed in. */
type Placement = { x: number; y: number; width: number; height: number; parent?: BandParent };

const COL_GAP = 220; // horizontal distance between layers
const ROW_GAP = 120; // vertical distance between sibling nodes within a layer/band
const EVENT_SIZE = 40;
const TASK_W = 140;
const TASK_H = 60;
const DATA_W = 40; // matches the editor's bpmnDataObject palette preview
const DATA_H = 60;
const DATA_GAP = 30; // between a node and the row of its data objects
// The editor wraps a data object's name at twice its width, centered under it.
const DATA_LABEL_W = 2 * DATA_W;
const DATA_PITCH = DATA_LABEL_W; // labels of neighbours touch but never overlap
const DATA_ROW_GAP = 50; // a two-line label under each row
const DATA_PER_ROW = 3;

// Pool/lane geometry constants (mirrors develop's converter + the reference
// templates) so the first paint looks like a hand-laid-out diagram.
const POOL_HEADER_WIDTH = 40;
const POOL_GAP = 40; // vertical gap between sibling pools
const BAND_V_PADDING = 20; // top/bottom padding inside a lane/pool band
const BAND_MIN_HEIGHT = 130; // single-row lane height

const TASK_TYPES = new Set([
  'default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'businessRule', 'script',
]);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

/** Per-node-type default geometry. */
function sizeForType(type: string): { width: number; height: number } {
  switch (type) {
    case 'bpmnStartEvent':
    case 'bpmnIntermediateEvent':
    case 'bpmnEndEvent':
    case 'bpmnGateway':
      return { width: EVENT_SIZE, height: EVENT_SIZE };
    case 'bpmnDataObject':
      return { width: DATA_W, height: DATA_H };
    case 'bpmnDataStore':
      return { width: 50, height: 50 };
    case 'bpmnAnnotation':
      return { width: 120, height: 40 };
    case 'bpmnGroup':
      return { width: 200, height: 200 };
    default:
      // bpmnTask / bpmnSubprocess / bpmnTransaction / bpmnCallActivity
      return { width: TASK_W, height: TASK_H };
  }
}

export class BPMNDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'BPMN' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || { x: 0, y: 0 };
    const type = this.normalizeType(spec?.type);
    const node = this.buildNode(
      generateUniqueId('bpmn'),
      type,
      typeof spec?.name === 'string' ? spec.name : '',
      pos.x,
      pos.y,
      spec,
    );
    this.expandGovernance({ nodes: [node], edges: [] });
    return { nodes: [node], edges: [] };
  }

  convertCompleteSystem(systemSpec: any) {
    const model = createEmptyV4Model(
      UMLDiagramType.BPMN,
      systemSpec?.systemName || systemSpec?.name || '',
    );

    // Accept a handful of alternate array names the agent may emit.
    const rawNodes: SpecNode[] = [
      ...(Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : []),
      ...(Array.isArray(systemSpec?.tasks) ? systemSpec.tasks.map((t: any) => ({ ...t, type: t.type ?? 'task' })) : []),
      ...(Array.isArray(systemSpec?.activities) ? systemSpec.activities.map((t: any) => ({ ...t, type: t.type ?? 'task' })) : []),
      ...(Array.isArray(systemSpec?.events) ? systemSpec.events.map((e: any) => ({ ...e, type: e.type ?? 'event' })) : []),
      ...(Array.isArray(systemSpec?.gateways) ? systemSpec.gateways.map((g: any) => ({ ...g, type: g.type ?? 'gateway' })) : []),
    ];
    const flows: SpecFlow[] = [
      ...(Array.isArray(systemSpec?.flows) ? systemSpec.flows : []),
      ...(Array.isArray(systemSpec?.sequenceFlows) ? systemSpec.sequenceFlows : []),
    ];
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
          .map((l) => ({ ...l, id: l.id.trim(), name: typeof l.name === 'string' ? l.name : '' })),
      }));

    const layerOf = this.computeLayers(nodes, flows);

    const data = this.collectDataObjects(systemSpec, nodes);

    if (pools.length === 0) {
      this.layoutFlat(nodes, flows, layerOf, model, data);
    } else {
      this.layoutWithPools(nodes, flows, pools, layerOf, model, data);
    }

    // Expanded once every flow exists: the DSL lists the block's agent lanes.
    this.expandGovernance(model as UMLModel);

    centerNodesOnOrigin(model);
    return model;
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
   * Places each node's data objects in rows centered under it, in the same
   * lane or pool; unlinked ones go below everything. Every other row is
   * shifted by half a pitch so its associations pass between the data objects
   * above instead of through them.
   */
  private placeDataObjects(
    data: DataPlan,
    placed: Record<string, Placement>,
    idMap: Record<string, string>,
    typeMap: Record<string, string>,
    model: Record<string, any>,
  ): void {
    if (!data.objects.length) return;
    const groups = new Map<string, DataPlan['objects']>();
    data.objects.forEach((obj) => {
      const key = obj.anchor && placed[obj.anchor] ? obj.anchor : '';
      groups.set(key, [...(groups.get(key) ?? []), obj]);
    });
    // Top-level nodes (pools, or the flow nodes of a flat process) bound the layout.
    const topLevel: BesserNode[] = model.nodes.filter((n: BesserNode) => !n.parentId);
    const left = Math.min(...topLevel.map((n) => n.position.x));
    const bottom = Math.max(...topLevel.map((n) => n.position.y + (n.height ?? 0)));

    groups.forEach((objs, anchorId) => {
      const anchor = anchorId ? placed[anchorId] : undefined;
      const top = anchor ? anchor.y + anchor.height + DATA_GAP : bottom + DATA_GAP;
      objs.forEach((obj, i) => {
        const row = Math.floor(i / DATA_PER_ROW);
        const inRow = Math.min(DATA_PER_ROW, objs.length - row * DATA_PER_ROW);
        const rowWidth = (inRow - 1) * DATA_PITCH + DATA_W;
        const stagger = row % 2 ? DATA_PITCH / 2 : 0;
        const rowLeft = (anchor ? anchor.x + (anchor.width - rowWidth) / 2 : left) + stagger;
        const absX = rowLeft + (i % DATA_PER_ROW) * DATA_PITCH;
        const absY = top + row * (DATA_H + DATA_ROW_GAP);
        const nodeId = generateUniqueId('bpmn');
        idMap[obj.id] = nodeId;
        typeMap[obj.id] = 'bpmnDataObject';
        const parent = anchor?.parent?.id ? anchor.parent : undefined;
        if (parent) {
          const relative = clampIntoLaneBody({ x: absX - parent.absX, y: absY - parent.absY }, parent.lane);
          const node = this.buildNode(nodeId, 'bpmnDataObject', obj.name, relative.x, relative.y, {});
          node.parentId = parent.id;
          model.nodes.push(node);
        } else {
          model.nodes.push(this.buildNode(nodeId, 'bpmnDataObject', obj.name, absX, absY, {}));
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // Flat process (no pools).
  // ------------------------------------------------------------------

  private layoutFlat(
    nodes: StableNode[],
    flows: SpecFlow[],
    layerOf: Record<string, number>,
    model: Record<string, any>,
    data: DataPlan,
  ): void {
    const idMap: Record<string, string> = {}; // spec id -> node id
    const typeMap: Record<string, string> = {}; // spec id -> v4 node type
    const placed: Record<string, Placement> = {};

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
      const type = this.normalizeType(n.type);
      const nodeId = generateUniqueId('bpmn');
      idMap[n.id] = nodeId;
      typeMap[n.id] = type;
      const node = this.buildNode(nodeId, type, n.name ?? '', x, y, n);
      model.nodes.push(node);
      placed[n.id] = { x, y, width: node.width ?? 0, height: node.height ?? 0 };
    });
    this.placeDataObjects(data, placed, idMap, typeMap, model);

    [...flows, ...data.flows].forEach((f) => this.emitFlow(f, idMap, typeMap, layerOf, byLayer, model));
  }

  // ------------------------------------------------------------------
  // Collaboration diagram (pools/lanes present).
  // ------------------------------------------------------------------

  private layoutWithPools(
    nodes: StableNode[],
    flows: SpecFlow[],
    pools: Pool[],
    layerOf: Record<string, number>,
    model: Record<string, any>,
    data: DataPlan,
  ): void {
    const idMap: Record<string, string> = {}; // spec id -> node id
    const typeMap: Record<string, string> = {}; // spec id -> v4 node type
    const placed: Record<string, Placement> = {};

    type Band = { key: string; nodeIds: string[] };
    const poolIndexOf: Record<string, number> = {}; // spec node id -> pool stacking order
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

    // Row assignment within each band.
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

    const layerValues = Object.values(layerOf);
    const maxLayer = layerValues.length ? Math.max(...layerValues) : 0;
    const contentWidth = (maxLayer + 1) * data.colGap;
    const poolWidth = Math.max(400, POOL_HEADER_WIDTH + contentWidth + data.colGap / 2);

    // Parent node + absolute origin for every band, so contained nodes can be
    // positioned RELATIVE to their React-Flow parent.
    const bandParent: Record<string, BandParent> = {};
    const laneIdMap: Record<string, string> = {}; // `${poolId}::${laneId}` -> lane node id

    let cursorY = 0;
    pools.forEach((pool) => {
      const bands = bandsByPool[pool.id];
      const poolY = cursorY;
      let laneCursorY = poolY;
      const bandOriginY: Record<string, number> = {};
      bands.forEach((band) => {
        const rows = maxRowsOf[band.key] || 1;
        const bandHeight = Math.max(BAND_MIN_HEIGHT, rows * data.rowGap + BAND_V_PADDING * 2);
        bandOriginY[band.key] = laneCursorY;
        laneCursorY += bandHeight;
      });
      const poolHeight = laneCursorY - poolY;

      const poolNodeId = generateUniqueId('bpmn');
      model.nodes.push(this.buildContainerNode(poolNodeId, 'bpmnPool', pool.name, 0, poolY, poolWidth, poolHeight));

      if (pool.lanes.length) {
        pool.lanes.forEach((lane, i) => {
          const band = bands[i];
          const laneHeight = Math.max(
            BAND_MIN_HEIGHT,
            (maxRowsOf[band.key] || 1) * data.rowGap + BAND_V_PADDING * 2,
          );
          const laneAbsY = bandOriginY[band.key];
          const laneNodeId = generateUniqueId('bpmn');
          // Lane position is RELATIVE to its pool parent.
          model.nodes.push(
            this.buildContainerNode(
              laneNodeId,
              'bpmnSwimlane',
              lane.name,
              POOL_HEADER_WIDTH,
              laneAbsY - poolY,
              poolWidth - POOL_HEADER_WIDTH,
              laneHeight,
              poolNodeId,
              bpmnLaneAgenticData(lane),
            ),
          );
          bandParent[band.key] = {
            id: laneNodeId,
            absX: POOL_HEADER_WIDTH,
            absY: laneAbsY,
            lane: { type: 'bpmnSwimlane', data: bpmnLaneAgenticData(lane) },
          };
          laneIdMap[band.key] = laneNodeId;
        });
      } else {
        // Pool with no lanes: its single band is parented directly to the pool.
        bandParent[bands[0].key] = { id: poolNodeId, absX: 0, absY: poolY };
      }

      cursorY = poolY + poolHeight + POOL_GAP;
    });

    // Trailing flat band for nodes with no recognized pool.
    if (orphanBand.nodeIds.length) {
      bandParent[orphanBand.key] = { id: '', absX: 0, absY: cursorY };
    }

    // A spec lane reference (lane id, preferring the node's own pool, else a
    // lane name) -> the emitted lane node id; undefined when nothing matches.
    const resolveLaneRef = (ref: string | undefined, poolId?: string): string | undefined => {
      const key = typeof ref === 'string' ? ref.trim() : '';
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

    // Emit node elements.
    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const row = rowOf[n.id] ?? 0;
      const parent = bandParent[bandKeyOf[n.id]];
      const absX = POOL_HEADER_WIDTH + layer * data.colGap;
      const absY = (parent?.absY ?? 0) + BAND_V_PADDING + row * data.rowGap;
      const type = this.normalizeType(n.type);
      const nodeId = generateUniqueId('bpmn');
      idMap[n.id] = nodeId;
      typeMap[n.id] = type;
      const reviewerLaneId = resolveLaneRef(n.reflectionReviewerLaneId, n.poolId);

      if (parent && parent.id) {
        // Position RELATIVE to the parent lane/pool, clear of a lane's header.
        const relative = clampIntoLaneBody({ x: absX - parent.absX, y: absY - parent.absY }, parent.lane);
        const node = this.buildNode(nodeId, type, n.name ?? '', relative.x, relative.y, n, reviewerLaneId);
        node.parentId = parent.id;
        model.nodes.push(node);
        placed[n.id] = {
          x: parent.absX + relative.x,
          y: parent.absY + relative.y,
          width: node.width ?? 0,
          height: node.height ?? 0,
          parent,
        };
      } else {
        const node = this.buildNode(nodeId, type, n.name ?? '', absX, absY, n, reviewerLaneId);
        model.nodes.push(node);
        placed[n.id] = { x: absX, y: absY, width: node.width ?? 0, height: node.height ?? 0 };
      }
    });

    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });
    this.placeDataObjects(data, placed, idMap, typeMap, model);
    [...flows, ...data.flows].forEach((f) => this.emitFlow(f, idMap, typeMap, layerOf, byLayer, model, poolIndexOf));
  }

  // ------------------------------------------------------------------
  // Shared node/edge builders
  // ------------------------------------------------------------------

  /** Build a v4 flow-node (task/event/gateway/…) with the correct data fields. */
  private buildNode(
    id: string,
    type: string,
    name: string,
    x: number,
    y: number,
    spec: SpecNode,
    reviewerLaneId?: string,
  ): BesserNode {
    const { width, height } = sizeForType(type);
    let data: Record<string, unknown> = { name: typeof name === 'string' ? name : '' };

    if (type === 'bpmnTask') {
      data.taskType = TASK_TYPES.has(String(spec.taskType)) ? spec.taskType : 'default';
      data.marker = 'none';
      data = { ...data, ...bpmnTaskAgenticData(spec, reviewerLaneId) };
    } else if (type === 'bpmnGateway') {
      data.gatewayType = GATEWAY_TYPES.has(String(spec.gatewayType)) ? spec.gatewayType : 'exclusive';
      data = { ...data, ...bpmnGatewayAgenticData(spec) };
    } else if (type === 'bpmnStartEvent' || type === 'bpmnIntermediateEvent' || type === 'bpmnEndEvent') {
      data.eventType = typeof spec.eventType === 'string' && spec.eventType ? spec.eventType : 'default';
    } else if (type === 'bpmnSubprocess' || type === 'bpmnTransaction') {
      data.isExpanded = false;
    } else if (type === 'bpmnCallActivity') {
      data.calledElement = '';
    }

    return {
      id,
      type: type as any,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data,
    };
  }

  /** Build a v4 container node (pool / swimlane), optionally parented. */
  private buildContainerNode(
    id: string,
    type: 'bpmnPool' | 'bpmnSwimlane',
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    parentId?: string,
    extraData: Record<string, unknown> = {},
  ): BesserNode {
    const node: BesserNode = {
      id,
      type: type as any,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data: { name: typeof name === 'string' ? name : '', ...extraData },
    };
    if (parentId) node.parentId = parentId;
    return node;
  }

  /**
   * Emit a v4 flow edge without route points (the editor routes it). Cross-pool
   * flows become message flows; every other pair (a data association included)
   * resolves its subtype via `resolveBpmnEdgeType`.
   */
  private emitFlow(
    f: SpecFlow,
    idMap: Record<string, string>,
    typeMap: Record<string, string>,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
    model: Record<string, any>,
    poolIndexOf?: Record<string, number>,
  ): void {
    const sourceId = idMap[String(f.source)];
    const targetId = idMap[String(f.target)];
    if (!sourceId || !targetId) return; // skip dangling refs

    let { sourceDir, targetDir } = f.isDataAssociation
      ? f.dataObjectIsSource
        ? { sourceDir: 'Up', targetDir: 'Down' }
        : { sourceDir: 'Down', targetDir: 'Up' }
      : this.edgeDirections(String(f.source), String(f.target), layerOf, byLayer);

    let edgeType = resolveBpmnEdgeType(typeMap[String(f.source)], typeMap[String(f.target)], 'BPMNSequenceFlow');
    if (poolIndexOf && !f.isDataAssociation) {
      const sPool = poolIndexOf[String(f.source)];
      const tPool = poolIndexOf[String(f.target)];
      if (sPool !== undefined && tPool !== undefined && sPool !== tPool) {
        edgeType = 'BPMNMessageFlow';
        sourceDir = sPool < tPool ? 'Down' : 'Up';
        targetDir = sPool < tPool ? 'Up' : 'Down';
      }
    }

    const name = typeof f.name === 'string' ? f.name : '';
    const edge: BesserEdge = {
      id: generateUniqueId('flow'),
      source: sourceId,
      target: targetId,
      type: edgeType as any,
      sourceHandle: directionToHandle(sourceDir, 'Right'),
      targetHandle: directionToHandle(targetDir, 'Left'),
      data: {
        label: name,
        name,
        isDefault: !!f.isDefault,
        isManuallyLayouted: false,
        points: [],
      },
    };
    model.edges.push(edge);
  }

  /** Replace each gateway's requested policy (held in `governanceDsl`) by the generated DSL. */
  private expandGovernance(model: Pick<UMLModel, 'nodes' | 'edges'>): void {
    for (const node of model.nodes) {
      if (node.type === 'bpmnGateway' && typeof node.data.governanceDsl === 'string') {
        node.data.governanceDsl = resolveGovernanceDsl(node.data.governanceDsl, node.id, model as UMLModel);
      }
    }
  }

  // ------------------------------------------------------------------

  private normalizeType(rawType?: string): string {
    const t = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (t === 'startevent' || t === 'start' || t === 'startnode') return 'bpmnStartEvent';
    if (t === 'endevent' || t === 'end' || t === 'endnode') return 'bpmnEndEvent';
    if (t === 'intermediateevent' || t === 'intermediate') return 'bpmnIntermediateEvent';
    if (t === 'gateway' || t === 'gate') return 'bpmnGateway';
    if (t === 'subprocess') return 'bpmnSubprocess';
    if (t === 'transaction') return 'bpmnTransaction';
    if (t === 'callactivity') return 'bpmnCallActivity';
    if (t === 'dataobject' || t === 'data') return 'bpmnDataObject';
    if (t === 'datastore') return 'bpmnDataStore';
    if (t === 'annotation' || t === 'textannotation' || t === 'text') return 'bpmnAnnotation';
    if (t === 'group') return 'bpmnGroup';
    return 'bpmnTask'; // default: any unrecognized node is a task
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
    nodes.forEach((n) => {
      if (!(n.id in layer)) layer[n.id] = 0;
    });
    return layer;
  }

  /** Cheap geometry-based edge direction for a nicer first paint. */
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
