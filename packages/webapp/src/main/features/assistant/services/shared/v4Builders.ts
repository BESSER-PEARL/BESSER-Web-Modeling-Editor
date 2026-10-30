/**
 * Shared v4 node/model factory helpers.
 *
 * Single source of truth for the React-Flow (v4) shapes the assistant
 * emits — used by both the converters (system/element specs → model) and
 * the modifiers (in-place model edits) so the two paths produce identical
 * nodes. Shapes follow `packages/library` canon:
 *   - all classifiers are `node.type === 'class'` discriminated by
 *     `data.stereotype` (see `lib/utils/versionConverter.ts`),
 *   - node geometry lives on `width` / `height` / `measured`,
 *   - edge anchors use the lowercase `HandleId` values from
 *     `lib/nodes/wrappers/DefaultNodeWrapper.tsx` (`'left'`, `'right'`, …).
 */

import type { BesserEdge, BesserNode, DiagramEdgeType, DiagramNodeType, GovPolicyType, UMLModel } from '@besser/wme';
import {
  GOV_POLICY_TYPES,
  clampMultiplicity,
  clampTrustScore,
  generateGovernanceDsl,
  migrateLegacyRole,
} from '@besser/wme';

/** All v4 class-like node types live under `node.type === 'class'`. */
export const CLASS_NODE_TYPE = 'class';

/** Canonical `data.stereotype` values (the library's `ClassType` casing). */
export const CLASS_STEREOTYPE = {
  Abstract: 'Abstract',
  Interface: 'Interface',
  Enumeration: 'Enumeration',
} as const;

/** Case-insensitive stereotype test; older data may carry lowercase values. */
export function isStereotype(value: unknown, stereotype: string): boolean {
  return typeof value === 'string' && value.toLowerCase() === stereotype.toLowerCase();
}

/** Map a known stereotype to `ClassType` casing; freeform values pass through. */
export function canonicalStereotype(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const known = Object.values(CLASS_STEREOTYPE).find((s) => isStereotype(value, s));
  return known ?? value;
}

/** Empty canonical v4 model envelope for a given diagram type. */
export function createEmptyV4Model(type: string, title: string = ''): Record<string, any> {
  return {
    version: '4.0.0',
    id: '',
    title,
    type,
    nodes: [],
    edges: [],
    assessments: {},
  };
}

/**
 * Compute a class node's height from its row counts. Mirrors the v3
 * visual budget (50px header + 25px rows + 10px method gap + padding).
 */
export function classNodeHeight(attrCount: number, methodCount: number): number {
  const headerHeight = 50;
  const rowHeight = 25;
  const methodGap = methodCount > 0 ? 10 : 0;
  const padding = 15;
  return Math.max(90, headerHeight + attrCount * rowHeight + methodGap + methodCount * rowHeight + padding);
}

/** Recompute `height` / `measured` on a class node after its rows changed. */
export function recalculateClassNodeHeight(node: BesserNode): void {
  const data: any = node.data || {};
  const attrCount = Array.isArray(data.attributes) ? data.attributes.length : 0;
  const methodCount = Array.isArray(data.methods) ? data.methods.length : 0;
  const h = classNodeHeight(attrCount, methodCount);
  node.height = h;
  node.measured = { width: node.width, height: h };
}

/** Build a v4 node; `position` is relative to `parentId` when one is given. */
export function buildV4Node(
  id: string,
  type: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  data: Record<string, unknown>,
  parentId?: string,
): BesserNode {
  return {
    id,
    type: type as DiagramNodeType,
    position,
    width: size.width,
    height: size.height,
    measured: { ...size },
    data,
    ...(parentId ? { parentId } : {}),
  };
}

/** Build a v4 edge without route points; the editor routes it on load. */
export function buildV4Edge(
  id: string,
  type: string,
  source: string,
  target: string,
  handles: { source: string; target: string },
  data: Record<string, unknown>,
): BesserEdge {
  return {
    id,
    source,
    target,
    type: type as DiagramEdgeType,
    sourceHandle: handles.source,
    targetHandle: handles.target,
    data: {
      isManuallyLayouted: false,
      points: [],
      ...data,
    },
  };
}

/** Build a v4 class node (`type: 'class'`, stereotype-discriminated). */
export function buildClassNode(opts: {
  id: string;
  name: string;
  stereotype?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  extraData?: Record<string, unknown>;
}): BesserNode {
  const w = opts.width ?? 220;
  const h = opts.height ?? 90;
  const data: Record<string, unknown> = {
    name: opts.name,
    attributes: [],
    methods: [],
    ...(opts.extraData || {}),
  };
  if (opts.stereotype) {
    data.stereotype = opts.stereotype;
  }
  return {
    id: opts.id,
    type: CLASS_NODE_TYPE as any,
    position: { x: opts.x, y: opts.y },
    width: w,
    height: h,
    measured: { width: w, height: h },
    data,
  };
}

/**
 * Estimate the rendered width of an agent state/intent from its longest
 * text line (~8px per character + padding, matching editor font metrics).
 * The editor auto-sizes elements, so we must match to avoid overlaps.
 */
export function estimateAgentNodeWidth(texts: Array<string | undefined>, baseWidth: number): number {
  let maxW = baseWidth;
  for (const text of texts) {
    if (text) {
      const estimated = text.length * 8 + 40;
      maxW = Math.max(maxW, estimated);
    }
  }
  return Math.max(maxW, baseWidth);
}

/**
 * Map a v3-style compass direction (`'Left'`, `'Up'`, …) to the v4
 * lowercase React-Flow handle id (`'left'`, `'top'`, …). Mirrors the main
 * directions of `convertV3HandleToV4` in the library's versionConverter.
 */
export function directionToHandle(direction: string | undefined, fallback: string): string {
  const map: Record<string, string> = {
    Up: 'top',
    Right: 'right',
    Down: 'bottom',
    Left: 'left',
  };
  if (!direction) return map[fallback] ?? fallback.toLowerCase();
  return map[direction] ?? direction.toLowerCase();
}

/** Agentic fields an assistant spec may carry for a BPMN lane, task or gateway. */
export interface BpmnAgenticSpec {
  isAgentic?: boolean;
  role?: string;
  trustScore?: number;
  multiplicity?: number;
  agentDiagramRef?: string | null;
  reflectionMode?: string;
  gatewayRole?: string;
  /** One of `GOV_POLICY_TYPES`; expanded to a generated `governanceDsl`. */
  governancePolicy?: string;
  /** A full Governance-DSL text, kept as is (older agents). */
  governanceDsl?: string;
}

const trustScoreOf = (spec: BpmnAgenticSpec) =>
  clampTrustScore(typeof spec.trustScore === 'number' ? spec.trustScore : 0);

const agentDiagramRefOf = (spec: BpmnAgenticSpec) => {
  const ref = typeof spec.agentDiagramRef === 'string' ? spec.agentDiagramRef.trim() : '';
  return ref ? { agentDiagramRef: ref } : {};
};

/** Agentic keys per BPMN node type; a plain element carries none of them (`agentDiagramRef` is not one). */
export const BPMN_AGENTIC_KEYS: Record<'bpmnTask' | 'bpmnGateway' | 'bpmnSwimlane', readonly string[]> = {
  bpmnTask: ['isAgentic', 'reflectionMode', 'trustScore', 'reflectionReviewerLaneId'],
  bpmnGateway: ['isAgentic', 'gatewayRole', 'trustScore', 'governanceDsl'],
  bpmnSwimlane: ['isAgentic', 'role', 'trustScore', 'multiplicity'],
};

/** `bpmnSwimlane` agentic data, with legacy roles migrated and numbers clamped. */
export function bpmnLaneAgenticData(spec: BpmnAgenticSpec): Record<string, unknown> {
  if (spec.isAgentic !== true) return agentDiagramRefOf(spec);
  return {
    isAgentic: true,
    role: migrateLegacyRole(spec.role),
    trustScore: trustScoreOf(spec),
    multiplicity: clampMultiplicity(typeof spec.multiplicity === 'number' ? spec.multiplicity : 1),
    ...agentDiagramRefOf(spec),
  };
}

/** `bpmnTask` agentic data; `reviewerLaneId` is the resolved cross-reflection lane node id. */
export function bpmnTaskAgenticData(spec: BpmnAgenticSpec, reviewerLaneId?: string): Record<string, unknown> {
  if (spec.isAgentic !== true) return agentDiagramRefOf(spec);
  return {
    isAgentic: true,
    reflectionMode: typeof spec.reflectionMode === 'string' ? spec.reflectionMode : 'none',
    trustScore: trustScoreOf(spec),
    ...agentDiagramRefOf(spec),
    ...(reviewerLaneId ? { reflectionReviewerLaneId: reviewerLaneId } : {}),
  };
}

/** `bpmnGateway` agentic data. */
export function bpmnGatewayAgenticData(spec: BpmnAgenticSpec): Record<string, unknown> {
  if (spec.isAgentic !== true) return {};
  return {
    isAgentic: true,
    gatewayRole: typeof spec.gatewayRole === 'string' ? spec.gatewayRole : 'diverging',
    trustScore: trustScoreOf(spec),
    ...(requestedGovernance(spec) ? { governanceDsl: requestedGovernance(spec) } : {}),
  };
}

const POLICY_BY_KEYWORD = new Map<string, GovPolicyType>(
  GOV_POLICY_TYPES.map((policy) => [policy.replace(/Policy$/, '').toLowerCase(), policy]),
);

/**
 * The governance policy a short keyword names ("consensus", "absolute majority",
 * "leader-driven", "MajorityPolicy", "Policy: MajorityPolicy"), else undefined.
 */
export function governancePolicyOf(text: string): GovPolicyType | undefined {
  const key = text
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/^policy/, '')
    .replace(/policy$/, '');
  return POLICY_BY_KEYWORD.get(key);
}

/**
 * The governance a spec asks for, before expansion: the `governancePolicy` name when
 * it is a known policy, else a non-empty `governanceDsl` text.
 */
export function requestedGovernance(spec: { governancePolicy?: unknown; governanceDsl?: unknown }): string | undefined {
  if (typeof spec.governancePolicy === 'string' && governancePolicyOf(spec.governancePolicy))
    return spec.governancePolicy;
  return typeof spec.governanceDsl === 'string' && spec.governanceDsl.trim() ? spec.governanceDsl : undefined;
}

/** A gateway's `governanceDsl`: a policy name or keyword expands to a generated DSL, any other text is kept. */
export function resolveGovernanceDsl(text: string, gatewayId: string, model: UMLModel): string {
  const policy = governancePolicyOf(text);
  return policy ? generateGovernanceDsl(gatewayId, model, policy) : text;
}
