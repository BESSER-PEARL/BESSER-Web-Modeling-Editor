/**
 * BPMN Diagram Converter
 * Converts a simplified BPMN process spec emitted by the modeling agent into
 * the Apollon BPMNDiagram model.
 *
 * Base BPMN only: tasks, gateways, events, pools, swimlanes, and BPMNFlow.
 * Agentic BPMN fields stay out of scope here.
 *
 * NOTE on naming: the converter is registered under the STORAGE-BUCKET token
 * "BPMN" (what SupportedDiagramType / the store use), but it emits the Apollon
 * model.type "BPMNDiagram".
 */

import { DiagramConverter, generateUniqueId } from './base';

interface SpecNode {
  id?: string;
  name?: string;
  type?: string;
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
  poolId?: string;
  laneId?: string;
  owner?: string;
}

interface SpecLane {
  id?: string;
  name?: string;
}

interface SpecPool {
  id?: string;
  name?: string;
  lanes?: SpecLane[];
}

interface SpecFlow {
  source?: string;
  target?: string;
  name?: string;
  flowType?: string;
}

const COL_GAP = 220;
const ROW_GAP = 120;
const EVENT_SIZE = 40;
const TASK_W = 140;
const TASK_H = 60;
const POOL_HEADER_WIDTH = 40;
const POOL_MIN_HEIGHT = 80;
const POOL_VERTICAL_GAP = 80;
const POOL_NODE_X = 120;
const POOL_TOP_PADDING = 30;
const LANE_HEIGHT = 140;
const LANE_STACK_GAP = 80;
const LANE_HEADER_WIDTH = 30;

type NormalizedSpecNode = SpecNode & { id: string };
type NormalizedSpecLane = { id: string; name: string; poolId: string };
type NormalizedSpecPool = { id: string; name: string; lanes: NormalizedSpecLane[] };
type NodePlacement = { poolId: string | null; laneId: string | null };

const TASK_TYPES = new Set(['default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'script']);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

export class BPMNDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'BPMN' as const;
  }

  convertSingleElement(spec: any) {
    return this.convertCompleteSystem({ nodes: [spec], flows: [] });
  }

  convertCompleteSystem(systemSpec: any) {
    const rawNodes: SpecNode[] = Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : [];
    const flows: SpecFlow[] = Array.isArray(systemSpec?.flows) ? systemSpec.flows : [];
    const pools = this.normalizePools(Array.isArray(systemSpec?.pools) ? systemSpec.pools : []);

    const nodes: NormalizedSpecNode[] = rawNodes.map((node, index) => ({
      ...node,
      id: typeof node.id === 'string' && node.id.trim() ? node.id.trim() : `n${index}`,
    }));

    if (pools.length > 0) {
      return this.convertWithPools(nodes, flows, pools);
    }

    return this.convertFlat(nodes, flows);
  }

  private convertFlat(nodes: NormalizedSpecNode[], flows: SpecFlow[]) {
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {};
    const layerOf = this.computeLayers(nodes, flows);
    const byLayer: Record<number, string[]> = {};

    nodes.forEach((node) => {
      const layer = layerOf[node.id] ?? 0;
      (byLayer[layer] ||= []).push(node.id);
    });

    nodes.forEach((node) => {
      const apollonType = this.normalizeType(node.type);
      const isTask = apollonType === 'BPMNTask';
      const width = isTask ? TASK_W : EVENT_SIZE;
      const height = isTask ? TASK_H : EVENT_SIZE;
      const layer = layerOf[node.id] ?? 0;
      const row = byLayer[layer].indexOf(node.id);
      const apollonId = generateUniqueId('bpmn');

      idMap[node.id] = apollonId;
      elements[apollonId] = this.makeNodeRecord(
        apollonId,
        node,
        apollonType,
        { x: layer * COL_GAP, y: row * ROW_GAP, width, height },
        null,
      );
    });

    this.emitFlows(flows, relationships, idMap, layerOf, byLayer, () => 'sequence');

    return this.finalizeModel(elements, relationships, byLayer);
  }

  private convertWithPools(nodes: NormalizedSpecNode[], flows: SpecFlow[], pools: NormalizedSpecPool[]) {
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {};
    const laneIdMap: Record<string, string> = {};
    const placementByNodeId = this.resolveNodePlacements(nodes, pools);
    const nodesByPool = new Map<string | null, NormalizedSpecNode[]>();

    nodes.forEach((node) => {
      const placement = placementByNodeId.get(node.id) ?? { poolId: null, laneId: null };
      const bucket = nodesByPool.get(placement.poolId) ?? [];
      bucket.push(node);
      nodesByPool.set(placement.poolId, bucket);
    });

    const groupedLayers = new Map<string | null, Record<string, number>>();
    const groupedColumns = new Map<string | null, Record<number, string[]>>();

    for (const [poolId, groupNodes] of nodesByPool.entries()) {
      const groupNodeIds = new Set(groupNodes.map((node) => node.id));
      const groupFlows = flows.filter(
        (flow) => groupNodeIds.has(String(flow.source)) && groupNodeIds.has(String(flow.target)),
      );
      const layerOf = this.computeLayers(groupNodes, groupFlows);
      const byLayer: Record<number, string[]> = {};
      groupNodes.forEach((node) => {
        const layer = layerOf[node.id] ?? 0;
        (byLayer[layer] ||= []).push(node.id);
      });
      groupedLayers.set(poolId, layerOf);
      groupedColumns.set(poolId, byLayer);
    }

    const globalMaxLayer = Array.from(groupedColumns.values()).reduce((max, byLayer) => {
      const groupMax = Object.keys(byLayer).length ? Math.max(...Object.keys(byLayer).map(Number)) : 0;
      return Math.max(max, groupMax);
    }, 0);
    const poolWidth = Math.max(600, POOL_NODE_X + globalMaxLayer * COL_GAP + TASK_W + 140);
    let currentY = 0;

    for (const pool of pools) {
      const apollonPoolId = generateUniqueId('bpmn');
      const poolNodes = nodesByPool.get(pool.id) ?? [];
      const layerOf = groupedLayers.get(pool.id) ?? {};
      const nodesByLaneLayer = new Map<string, string[]>();

      poolNodes.forEach((node) => {
        const placement = placementByNodeId.get(node.id) ?? { poolId: pool.id, laneId: null };
        if (!placement.laneId) return;
        const layer = layerOf[node.id] ?? 0;
        const key = this.makeLaneLayerKey(placement.laneId, layer);
        const bucket = nodesByLaneLayer.get(key) ?? [];
        bucket.push(node.id);
        nodesByLaneLayer.set(key, bucket);
      });

      const laneHeights = pool.lanes.map((lane) => {
        const maxSameLayer = this.maxLaneLayerCount(lane.id, nodesByLaneLayer);
        return Math.max(LANE_HEIGHT, LANE_HEIGHT + Math.max(0, maxSameLayer - 1) * LANE_STACK_GAP);
      });
      const lanesHeight = laneHeights.reduce((sum, height) => sum + height, 0);
      const poolLevelNodeCount = poolNodes.filter((node) => !placementByNodeId.get(node.id)?.laneId).length;
      const poolLevelBandHeight =
        poolLevelNodeCount > 0
          ? Math.max(LANE_HEIGHT, LANE_HEIGHT + Math.max(0, poolLevelNodeCount - 1) * LANE_STACK_GAP)
          : 0;
      const poolHeight = Math.max(
        POOL_MIN_HEIGHT,
        POOL_TOP_PADDING + poolLevelBandHeight + lanesHeight + POOL_TOP_PADDING,
      );

      elements[apollonPoolId] = {
        id: apollonPoolId,
        name: pool.name,
        type: 'BPMNPool',
        owner: null,
        bounds: { x: 0, y: currentY, width: poolWidth, height: poolHeight },
      };

      let laneY = currentY + POOL_TOP_PADDING + poolLevelBandHeight;
      pool.lanes.forEach((lane, laneIndex) => {
        const apollonLaneId = generateUniqueId('bpmn');
        laneIdMap[this.makeLaneKey(pool.id, lane.id)] = apollonLaneId;

        elements[apollonLaneId] = {
          id: apollonLaneId,
          name: lane.name,
          type: 'BPMNSwimlane',
          owner: apollonPoolId,
          bounds: {
            x: POOL_HEADER_WIDTH,
            y: laneY,
            width: poolWidth - POOL_HEADER_WIDTH,
            height: laneHeights[laneIndex],
          },
        };

        laneY += laneHeights[laneIndex];
      });

      const laneSlotIndex = new Map<string, number>();
      poolNodes.forEach((node) => {
        const apollonType = this.normalizeType(node.type);
        const isTask = apollonType === 'BPMNTask';
        const width = isTask ? TASK_W : EVENT_SIZE;
        const height = isTask ? TASK_H : EVENT_SIZE;
        const layer = layerOf[node.id] ?? 0;
        const x = POOL_NODE_X + layer * COL_GAP;
        const placement = placementByNodeId.get(node.id) ?? { poolId: pool.id, laneId: null };
        const apollonId = generateUniqueId('bpmn');

        idMap[node.id] = apollonId;

        let owner: string | null = apollonPoolId;
        let y = currentY + POOL_TOP_PADDING + poolLevelBandHeight / 2 - height / 2;

        if (placement.laneId) {
          const lane = pool.lanes.find((candidate) => candidate.id === placement.laneId);
          if (lane) {
            const laneElementId = laneIdMap[this.makeLaneKey(pool.id, lane.id)];
            const laneBounds = elements[laneElementId]?.bounds;
            owner = laneElementId;
            const laneLayerKey = this.makeLaneLayerKey(lane.id, layer);
            const slotIndex = laneSlotIndex.get(laneLayerKey) ?? 0;
            laneSlotIndex.set(laneLayerKey, slotIndex + 1);
            const sameLayerNodes = nodesByLaneLayer.get(laneLayerKey) ?? [];
            const offset = this.centeredOffset(slotIndex, sameLayerNodes.length);
            y = laneBounds.y + laneBounds.height / 2 - height / 2 + offset;
          }
        }

        elements[apollonId] = this.makeNodeRecord(
          apollonId,
          node,
          apollonType,
          {
            x: owner && owner !== apollonPoolId ? Math.max(x, POOL_HEADER_WIDTH + LANE_HEADER_WIDTH + 10) : x,
            y,
            width,
            height,
          },
          owner,
        );
      });

      currentY += poolHeight + POOL_VERTICAL_GAP;
    }

    const flatNodes = nodesByPool.get(null) ?? [];
    if (flatNodes.length > 0) {
      const layerOf = groupedLayers.get(null) ?? {};
      const byLayer = groupedColumns.get(null) ?? {};
      flatNodes.forEach((node) => {
        const apollonType = this.normalizeType(node.type);
        const isTask = apollonType === 'BPMNTask';
        const width = isTask ? TASK_W : EVENT_SIZE;
        const height = isTask ? TASK_H : EVENT_SIZE;
        const layer = layerOf[node.id] ?? 0;
        const row = byLayer[layer].indexOf(node.id);
        const apollonId = generateUniqueId('bpmn');
        idMap[node.id] = apollonId;
        elements[apollonId] = this.makeNodeRecord(
          apollonId,
          node,
          apollonType,
          { x: layer * COL_GAP, y: currentY + row * ROW_GAP, width, height },
          null,
        );
      });
    }

    this.emitFlows(flows, relationships, idMap, {}, {}, (flow) => this.resolveFlowType(flow, placementByNodeId));

    return this.finalizeModel(elements, relationships);
  }

  private normalizePools(rawPools: SpecPool[]): NormalizedSpecPool[] {
    return rawPools.map((pool, poolIndex) => {
      const poolId = typeof pool.id === 'string' && pool.id.trim() ? pool.id.trim() : `pool_${poolIndex}`;
      const rawLanes = Array.isArray(pool.lanes) ? pool.lanes : [];
      const lanes = rawLanes.map((lane, laneIndex) => ({
        id: typeof lane.id === 'string' && lane.id.trim() ? lane.id.trim() : `${poolId}_lane_${laneIndex}`,
        name: typeof lane.name === 'string' ? lane.name : '',
        poolId,
      }));

      return {
        id: poolId,
        name: typeof pool.name === 'string' ? pool.name : '',
        lanes,
      };
    });
  }

  private resolveNodePlacements(nodes: NormalizedSpecNode[], pools: NormalizedSpecPool[]): Map<string, NodePlacement> {
    const placements = new Map<string, NodePlacement>();
    const poolsById = new Map(pools.map((pool) => [pool.id, pool]));
    const lanePools = new Map<string, string[]>();

    pools.forEach((pool) => {
      pool.lanes.forEach((lane) => {
        const owners = lanePools.get(lane.id) ?? [];
        owners.push(pool.id);
        lanePools.set(lane.id, owners);
      });
    });

    nodes.forEach((node) => {
      const laneToken = this.normalizeRef(node.laneId) ?? this.normalizeRef(node.owner);
      let poolId = this.normalizeRef(node.poolId);

      if (poolId && !poolsById.has(poolId)) {
        poolId = null;
      }

      if (!poolId && laneToken) {
        const ownerPools = lanePools.get(laneToken) ?? [];
        if (ownerPools.length === 1) {
          poolId = ownerPools[0];
        }
      }

      let laneId: string | null = null;
      if (poolId && laneToken) {
        const pool = poolsById.get(poolId);
        if (pool?.lanes.some((lane) => lane.id === laneToken)) {
          laneId = laneToken;
        }
      }

      placements.set(node.id, { poolId: poolId ?? null, laneId });
    });

    return placements;
  }

  private resolveFlowType(flow: SpecFlow, placements: Map<string, NodePlacement>): 'sequence' | 'message' {
    const normalized = this.normalizeFlowType(flow.flowType);
    if (normalized) return normalized;

    const sourcePool = placements.get(String(flow.source))?.poolId ?? null;
    const targetPool = placements.get(String(flow.target))?.poolId ?? null;
    return sourcePool && targetPool && sourcePool !== targetPool ? 'message' : 'sequence';
  }

  private normalizeFlowType(rawType?: string): 'sequence' | 'message' | null {
    const type = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (type === 'message' || type === 'messageflow') return 'message';
    if (type === 'sequence' || type === 'sequenceflow') return 'sequence';
    return null;
  }

  private makeNodeRecord(
    apollonId: string,
    node: SpecNode,
    apollonType: string,
    bounds: { x: number; y: number; width: number; height: number },
    owner: string | null,
  ) {
    const base = {
      id: apollonId,
      name: typeof node.name === 'string' ? node.name : '',
      type: apollonType,
      owner,
      bounds,
    };

    if (apollonType === 'BPMNTask') {
      const taskType = TASK_TYPES.has(String(node.taskType)) ? node.taskType : 'default';
      return { ...base, taskType, marker: 'none' };
    }

    if (apollonType === 'BPMNGateway') {
      const gatewayType = GATEWAY_TYPES.has(String(node.gatewayType)) ? node.gatewayType : 'exclusive';
      return { ...base, gatewayType };
    }

    const eventType = typeof node.eventType === 'string' && node.eventType ? node.eventType : 'default';
    return { ...base, eventType };
  }

  private emitFlows(
    flows: SpecFlow[],
    relationships: Record<string, any>,
    idMap: Record<string, string>,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
    resolveFlowType: (flow: SpecFlow) => 'sequence' | 'message',
  ) {
    flows.forEach((flow) => {
      const sourceId = idMap[String(flow.source)];
      const targetId = idMap[String(flow.target)];
      if (!sourceId || !targetId) return;

      const relId = generateUniqueId('flow');
      const { sourceDir, targetDir } =
        Object.keys(layerOf).length > 0
          ? this.edgeDirections(String(flow.source), String(flow.target), layerOf, byLayer)
          : { sourceDir: 'Right', targetDir: 'Left' };

      relationships[relId] = {
        id: relId,
        name: typeof flow.name === 'string' ? flow.name : '',
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
        flowType: resolveFlowType(flow),
        isDefault: false,
      };
    });
  }

  private finalizeModel(
    elements: Record<string, any>,
    relationships: Record<string, any>,
    byLayer: Record<number, string[]> = {},
  ) {
    this.centerContent(elements);

    const placed = Object.values(elements) as Array<{
      bounds: { x: number; y: number; width: number; height: number };
    }>;
    const maxRight = placed.reduce((max, element) => Math.max(max, element.bounds.x + element.bounds.width), 0);
    const maxBottom = placed.reduce((max, element) => Math.max(max, element.bounds.y + element.bounds.height), 0);
    const minLeft = placed.reduce((min, element) => Math.min(min, element.bounds.x), 0);
    const minTop = placed.reduce((min, element) => Math.min(min, element.bounds.y), 0);
    const maxLayer = Object.keys(byLayer).length ? Math.max(...Object.keys(byLayer).map(Number)) : 0;
    const maxRows = Object.values(byLayer).reduce((max, rows) => Math.max(max, rows.length), 1);

    return {
      version: '3.0.0',
      type: 'BPMNDiagram',
      size: {
        width: Math.max(600, Math.max((maxLayer + 1) * COL_GAP, maxRight - minLeft + 200)),
        height: Math.max(320, Math.max(maxRows * ROW_GAP, maxBottom - minTop + 160)),
      },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }

  private centerContent(elements: Record<string, any>) {
    const placed = Object.values(elements);
    if (placed.length === 0) return;

    const minX = Math.min(...placed.map((element: any) => element.bounds.x));
    const minY = Math.min(...placed.map((element: any) => element.bounds.y));
    const maxX = Math.max(...placed.map((element: any) => element.bounds.x + element.bounds.width));
    const maxY = Math.max(...placed.map((element: any) => element.bounds.y + element.bounds.height));
    const offsetX = -(minX + maxX) / 2;
    const offsetY = -(minY + maxY) / 2;

    placed.forEach((element: any) => {
      element.bounds.x += offsetX;
      element.bounds.y += offsetY;
    });
  }

  private normalizeRef(value?: string): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private makeLaneKey(poolId: string, laneId: string) {
    return `${poolId}::${laneId}`;
  }

  private makeLaneLayerKey(laneId: string, layer: number) {
    return `${laneId}@${layer}`;
  }

  private maxLaneLayerCount(laneId: string, nodesByLaneLayer: Map<string, string[]>) {
    let max = 0;
    for (const [key, laneNodes] of nodesByLaneLayer.entries()) {
      if (key.startsWith(`${laneId}@`)) {
        max = Math.max(max, laneNodes.length);
      }
    }
    return max;
  }

  private centeredOffset(index: number, total: number) {
    if (total <= 1) return 0;
    return (index - (total - 1) / 2) * LANE_STACK_GAP;
  }

  private normalizeType(rawType?: string): string {
    const t = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (t === 'startevent' || t === 'start' || t === 'startnode') return 'BPMNStartEvent';
    if (t === 'endevent' || t === 'end' || t === 'endnode') return 'BPMNEndEvent';
    if (t === 'intermediateevent' || t === 'intermediate') return 'BPMNIntermediateEvent';
    if (t === 'gateway' || t === 'gate') return 'BPMNGateway';
    return 'BPMNTask';
  }

  /** Longest-path layer assignment over the sequence-flow graph (cycle-safe). */
  private computeLayers(nodes: { id: string }[], flows: SpecFlow[]): Record<string, number> {
    const ids = new Set(nodes.map((node) => node.id));
    const succ: Record<string, string[]> = {};
    const indeg: Record<string, number> = {};
    nodes.forEach((node) => {
      succ[node.id] = [];
      indeg[node.id] = 0;
    });
    flows.forEach((flow) => {
      const source = String(flow.source);
      const target = String(flow.target);
      if (ids.has(source) && ids.has(target) && source !== target) {
        succ[source].push(target);
        indeg[target] += 1;
      }
    });

    const layer: Record<string, number> = {};
    const remaining = { ...indeg };
    const queue: string[] = [];
    nodes.forEach((node) => {
      if (indeg[node.id] === 0) {
        layer[node.id] = 0;
        queue.push(node.id);
      }
    });
    if (queue.length === 0 && nodes.length) {
      layer[nodes[0].id] = 0;
      queue.push(nodes[0].id);
    }

    const visited = new Set<string>();
    while (queue.length) {
      const nodeId = queue.shift() as string;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const currentLayer = layer[nodeId] ?? 0;
      succ[nodeId].forEach((target) => {
        layer[target] = Math.max(layer[target] ?? 0, currentLayer + 1);
        remaining[target] -= 1;
        if (remaining[target] <= 0 && !visited.has(target)) queue.push(target);
      });
    }

    nodes.forEach((node) => {
      if (!(node.id in layer)) layer[node.id] = 0;
    });
    return layer;
  }

  private edgeDirections(
    sourceId: string,
    targetId: string,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
  ): { sourceDir: string; targetDir: string } {
    const sourceLayer = layerOf[sourceId] ?? 0;
    const targetLayer = layerOf[targetId] ?? 0;
    const sourceRow = (byLayer[sourceLayer] || []).indexOf(sourceId);
    const targetRow = (byLayer[targetLayer] || []).indexOf(targetId);
    const dx = targetLayer - sourceLayer;
    const dy = targetRow - sourceRow;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { sourceDir: 'Right', targetDir: 'Left' } : { sourceDir: 'Left', targetDir: 'Right' };
    }
    return dy >= 0 ? { sourceDir: 'Down', targetDir: 'Up' } : { sourceDir: 'Up', targetDir: 'Down' };
  }
}
