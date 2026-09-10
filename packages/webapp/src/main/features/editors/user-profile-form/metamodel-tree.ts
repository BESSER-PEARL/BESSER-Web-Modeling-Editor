/**
 * Derives the User Profile part-hierarchy generically from the fixed metamodel
 * exposed by `diagramBridge`. The form UI and the (de)serialisers are driven
 * entirely by this tree, so changes to the metamodel flow through automatically.
 *
 * The metamodel is a ClassDiagram whose relationships encode containment via
 * multiplicities, e.g.:
 *
 *   User(1..1)         --> Accessibility(0..1)      // single part
 *   Accessibility(1..1)--> Disability(0..*)         // repeatable part
 *   Competence(1..1)   --> Skill(0..*)              // repeatable part
 *
 * Rule: the relationship end whose multiplicity starts with `1` is the
 * container (parent); the other end is the child part, which is `multiple`
 * when its multiplicity ends with `*`, otherwise `single`.
 */

import { diagramBridge, getUserMetaModelV4 } from '@besser/wme';

export interface MetaAttr {
  id: string;
  name: string;
  type: string;
  /** Allowed literal values when `type` is an enumeration; undefined otherwise. */
  enumValues?: string[];
}

export type Multiplicity = 'single' | 'multiple';

export interface MetaChildRef {
  className: string;
  classId: string;
  multiplicity: Multiplicity;
}

export interface MetaNode {
  className: string;
  classId: string;
  icon?: string;
  attributes: MetaAttr[];
  children: MetaChildRef[];
}

export interface MetaTree {
  /** The `User` node, or null if the metamodel is unavailable. */
  root: MetaNode | null;
  /** Every metamodel class keyed by class name (for recursion / lookup). */
  byClassName: Record<string, MetaNode>;
}

export const ROOT_CLASS_NAME = 'User';

/* ------------------------------------------------------------------ */
/*  Bridge (v4) wire-shape helpers                                     */
/* ------------------------------------------------------------------ */

/** A class-diagram node as held by the bridge (`{nodes, edges}` v4 shape). */
interface BridgeNode {
  id: string;
  type?: string;
  data?: {
    name?: string;
    stereotype?: string | null;
    attributes?: Array<{ id?: string; name?: string; attributeType?: string }>;
  };
}

/**
 * A class-diagram edge as held by the bridge. Endpoints are node ids in v4;
 * a legacy v3 record (`{element, multiplicity}`) is tolerated because the
 * bridge's localStorage fallback can still surface un-lifted relationships.
 */
interface BridgeEdge {
  id?: string;
  type?: string;
  source?: string | { element?: string; multiplicity?: string };
  target?: string | { element?: string; multiplicity?: string };
  data?: { sourceMultiplicity?: string; targetMultiplicity?: string };
}

const bridgeNodes = (data: { nodes?: unknown } | null | undefined): BridgeNode[] =>
  Array.isArray(data?.nodes) ? (data!.nodes as BridgeNode[]) : [];

const bridgeEdges = (data: { edges?: unknown } | null | undefined): BridgeEdge[] =>
  Array.isArray(data?.edges) ? (data!.edges as BridgeEdge[]) : [];

/** Enumerations are `Class` nodes stereotyped `Enumeration` (v4) or legacy `Enumeration`-typed nodes. */
const isEnumerationNode = (node: BridgeNode | undefined): boolean =>
  !!node && (node.type === 'Enumeration' || node.data?.stereotype === 'Enumeration');

/** Any classifier node the bridge treats as a class (see `diagramBridge.isClassNode`). */
const isClassLikeNode = (node: BridgeNode | undefined): boolean =>
  !!node &&
  (node.type === 'class' ||
    node.type === 'Class' ||
    node.type === 'AbstractClass' ||
    node.type === 'Interface' ||
    node.type === 'Enumeration');

const endpointId = (end: BridgeEdge['source']): string | undefined => (typeof end === 'string' ? end : end?.element);

const endpointMultiplicity = (end: BridgeEdge['source'], fromData?: string): string | undefined =>
  fromData ?? (typeof end === 'object' && end ? end.multiplicity : undefined);

const isContainerMultiplicity = (m?: string): boolean => typeof m === 'string' && m.trim().startsWith('1');

const isMany = (m?: string): boolean => typeof m === 'string' && m.trim().endsWith('*');

/**
 * Ensure the bridge holds the user metamodel. If navigation hasn't populated
 * it yet (or it holds some other class diagram), seed it from the bundled
 * metamodel (`getUserMetaModelV4()` — the shipped JSON lifted to the v4
 * `{nodes, edges}` bridge shape) so the form — and the graphical palette —
 * always have the metamodel. This is a pure localStorage-backed operation
 * (diagramBridge persists to localStorage); no backend call is involved.
 */
const ensureMetamodelLoaded = (): void => {
  const current = diagramBridge.getClassDiagramData();
  const hasUser = bridgeNodes(current).some(
    (node) => isClassLikeNode(node) && !isEnumerationNode(node) && node.data?.name === ROOT_CLASS_NAME,
  );
  if (!hasUser) {
    try {
      diagramBridge.setClassDiagramData(getUserMetaModelV4());
    } catch {
      /* bridge unavailable — buildMetamodelTree will return an empty tree */
    }
  }
};

/**
 * Map every enumeration name to its ordered literal values, read from the
 * metamodel. In v4 an enumeration is a class node stereotyped `Enumeration`
 * whose `data.attributes` rows are the literals (their `name` is the value).
 */
const buildEnumValueMap = (nodes: BridgeNode[]): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  nodes.forEach((node) => {
    if (!isEnumerationNode(node) || !node.data?.name) return;
    map[node.data.name] = (node.data.attributes || [])
      .map((literal) => literal?.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
  });
  return map;
};

/**
 * Build the part-tree from the user metamodel. Falls back to the bundled
 * metamodel when the bridge isn't populated, so it never returns an empty
 * tree on a genuine User Profile diagram.
 */
export const buildMetamodelTree = (): MetaTree => {
  ensureMetamodelLoaded();
  const classes = diagramBridge.getAvailableClasses();
  const data = diagramBridge.getClassDiagramData();
  const nodes = bridgeNodes(data);
  const enumValues = buildEnumValueMap(nodes);
  // The bridge reports enumerations as classes too; they are value types,
  // never profile parts, so keep them out of the tree.
  const enumerationIds = new Set(nodes.filter(isEnumerationNode).map((n) => n.id));

  const byId: Record<string, MetaNode> = {};
  const byClassName: Record<string, MetaNode> = {};

  classes.forEach((cls) => {
    if (enumerationIds.has(cls.id)) return;
    const node: MetaNode = {
      className: cls.name,
      classId: cls.id,
      icon: cls.icon || undefined,
      attributes: (cls.attributes || []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type || 'str',
        enumValues: a.type && enumValues[a.type] ? enumValues[a.type] : undefined,
      })),
      children: [],
    };
    byId[cls.id] = node;
    byClassName[cls.name] = node;
  });

  bridgeEdges(data).forEach((rel) => {
    if (!rel || rel.type === 'ClassInheritance' || rel.type === 'ClassRealization') return;
    const srcId = endpointId(rel.source);
    const tgtId = endpointId(rel.target);
    if (!srcId || !tgtId) return;

    const srcNode = byId[srcId];
    const tgtNode = byId[tgtId];
    // Skip relationships that touch endpoints which are not selectable classes
    // (e.g. enumerations or helper classes absent from the palette).
    if (!srcNode || !tgtNode) return;

    const srcMult = endpointMultiplicity(rel.source, rel.data?.sourceMultiplicity);
    const tgtMult = endpointMultiplicity(rel.target, rel.data?.targetMultiplicity);

    let parent: MetaNode;
    let child: MetaNode;
    let childMult: string | undefined;

    if (isContainerMultiplicity(srcMult) && !isContainerMultiplicity(tgtMult)) {
      parent = srcNode;
      child = tgtNode;
      childMult = tgtMult;
    } else if (isContainerMultiplicity(tgtMult) && !isContainerMultiplicity(srcMult)) {
      parent = tgtNode;
      child = srcNode;
      childMult = srcMult;
    } else {
      // Ambiguous (both or neither are containers): default to source -> target.
      parent = srcNode;
      child = tgtNode;
      childMult = tgtMult;
    }

    if (parent.classId === child.classId) return;
    if (parent.children.some((c) => c.classId === child.classId)) return;

    parent.children.push({
      className: child.className,
      classId: child.classId,
      multiplicity: isMany(childMult) ? 'multiple' : 'single',
    });
  });

  return { root: byClassName[ROOT_CLASS_NAME] || null, byClassName };
};
