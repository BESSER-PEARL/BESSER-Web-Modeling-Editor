import type { TraceArtifact, TraceLink } from '../types/traceability';
import { isCodeArtifact, isModelArtifact } from '../types/traceability';
import type { TraceIndex } from './traceQueries';
import { diagramOf, isSuspect, withDescendants } from './traceQueries';

/**
 * The lineage of an artifact: everything it was derived from and everything derived from it,
 * following trace links transitively in both directions. Generic over artifact and link kinds,
 * so a chain requirement -> model element -> code needs nothing beyond what model -> code does.
 */

/** Whether a link still holds: `suspect` when its source changed after it was made, `staleUpstream`
 *  when the link itself holds but something its source was derived from is stale. */
export type LineageEdgeState = 'current' | 'suspect' | 'staleUpstream';

export interface LineageEdge {
  link: TraceLink;
  state: LineageEdgeState;
}

export interface LineageNode {
  artifact: TraceArtifact;
  /** Distance from the leftmost column: each link points one column or more to the right. */
  column: number;
  /** Reached through a suspect link, directly or further upstream: its content may be out of date. */
  stale: boolean;
}

/** The nodes of one column that share a container (a diagram for model elements, a file for code). */
export interface LineageGroup {
  container: TraceArtifact;
  /** True when the container is itself a node of this column (drawn as the group's header). */
  containerIsNode: boolean;
  nodes: LineageNode[];
}

export interface Lineage {
  rootId: string;
  nodes: Map<string, LineageNode>;
  edges: LineageEdge[];
  columns: LineageGroup[][];
}

export interface LineageOptions {
  /** Keep, per source and generator, only the newest generation's links (older runs are superseded). */
  latestGenerationOnly: boolean;
}


/** `links` without generation links superseded by a newer run of the same generator. */
function withoutOlderGenerations(index: TraceIndex, links: TraceLink[]): TraceLink[] {
  const newest = new Map<string, string>(); // generator tool ids -> newest operation id
  const started = (operationId: string) => index.operations.get(operationId)?.startedAt ?? '';
  const keyOf = (link: TraceLink) => {
    const operation = index.operations.get(link.operationId);
    return operation?.type === 'CodeGeneration' ? operation.uses.join(',') : undefined;
  };
  for (const link of links) {
    const key = keyOf(link);
    if (key === undefined) continue;
    const current = newest.get(key);
    if (!current || started(link.operationId) > started(current)) newest.set(key, link.operationId);
  }
  return links.filter((link) => {
    const key = keyOf(link);
    return key === undefined || newest.get(key) === link.operationId;
  });
}

/** The container a node is grouped under: the diagram of a model element, the file of a code fragment. */
function containerOf(index: TraceIndex, artifact: TraceArtifact): TraceArtifact {
  if (isModelArtifact(artifact)) return diagramOf(index, artifact) ?? artifact;
  let current: TraceArtifact = artifact;
  while (current.parentId) {
    const parent = index.artifacts.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

const nodeOrder = (a: LineageNode, b: LineageNode) => {
  const x = a.artifact;
  const y = b.artifact;
  if (isCodeArtifact(x) && isCodeArtifact(y)) return (x.startLine ?? 0) - (y.startLine ?? 0);
  return x.name.localeCompare(y.name);
};

export function lineageOf(index: TraceIndex, rootId: string, options: LineageOptions): Lineage {
  const outgoing = (id: string) => {
    const links = index.linksBySource.get(id) ?? [];
    return options.latestGenerationOnly ? withoutOlderGenerations(index, links) : links;
  };
  const incoming = (id: string) => index.linksByTarget.get(id) ?? [];

  // The root and its fragments that take part in links (a diagram's elements, a file's fragments).
  const seeds = withDescendants(index, rootId)
    .filter((a) => a.id === rootId || index.linksBySource.has(a.id) || index.linksByTarget.has(a.id))
    .map((a) => a.id);

  const nodeIds = new Set<string>(seeds);
  const edges = new Map<string, TraceLink>();
  const walk = (next: (id: string) => TraceLink[], end: (link: TraceLink) => string) => {
    const pending = [...seeds];
    const seen = new Set(seeds);
    while (pending.length) {
      for (const link of next(pending.pop()!)) {
        edges.set(link.id, link);
        const other = end(link);
        nodeIds.add(other);
        if (!seen.has(other)) {
          seen.add(other);
          pending.push(other);
        }
      }
    }
  };
  walk(outgoing, (link) => link.targetId); // what was derived from the root
  walk(incoming, (link) => link.sourceId); // what the root was derived from
  const links = [...edges.values()].filter((l) => index.artifacts.has(l.sourceId) && index.artifacts.has(l.targetId));

  // Longest-path layering; capped at one pass per node so a (malformed) cycle cannot loop forever.
  const column = new Map([...nodeIds].map((id) => [id, 0]));
  for (let pass = 0; pass < nodeIds.size; pass += 1) {
    let moved = false;
    for (const link of links) {
      const wanted = column.get(link.sourceId)! + 1;
      if (wanted > column.get(link.targetId)!) {
        column.set(link.targetId, wanted);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const into = new Map<string, TraceLink[]>();
  for (const link of links) {
    const list = into.get(link.targetId);
    if (list) list.push(link);
    else into.set(link.targetId, [link]);
  }

  // Staleness flows left to right: a node is stale when a link into it is suspect or comes from a stale node.
  const ordered = [...nodeIds].filter((id) => index.artifacts.has(id)).sort((a, b) => column.get(a)! - column.get(b)!);
  const nodes = new Map<string, LineageNode>();
  const states = new Map<string, LineageEdgeState>();
  for (const id of ordered) {
    let stale = false;
    for (const link of into.get(id) ?? []) {
      const state: LineageEdgeState = isSuspect(index, link)
        ? 'suspect'
        : nodes.get(link.sourceId)?.stale
          ? 'staleUpstream'
          : 'current';
      states.set(link.id, state);
      stale ||= state !== 'current';
    }
    nodes.set(id, { artifact: index.artifacts.get(id)!, column: column.get(id)!, stale });
  }

  const columnCount = Math.max(0, ...[...nodes.values()].map((n) => n.column + 1));
  const columns: LineageGroup[][] = Array.from({ length: columnCount }, () => []);
  for (const node of nodes.values()) {
    const container = containerOf(index, node.artifact);
    const groups = columns[node.column];
    let group = groups.find((g) => g.container.id === container.id);
    if (!group) {
      group = { container, containerIsNode: false, nodes: [] };
      groups.push(group);
    }
    if (container.id === node.artifact.id) group.containerIsNode = true;
    else group.nodes.push(node);
  }
  orderColumns(columns, into);

  return { rootId, nodes, edges: links.map((link) => ({ link, state: states.get(link.id) ?? 'current' })), columns };
}

/**
 * Order each column so links cross as little as possible: the first column by name, every later
 * one by the mean position of its nodes' sources (the barycentre heuristic), name as a tie-break.
 */
function orderColumns(columns: LineageGroup[][], into: Map<string, TraceLink[]>): void {
  const position = new Map<string, number>();
  // Each node's score is computed once per column (its sources are all in earlier columns).
  const scores = new Map<string, number>();
  const barycentre = (id: string) => {
    let score = scores.get(id);
    if (score === undefined) {
      const sources = (into.get(id) ?? []).filter((l) => position.has(l.sourceId)).map((l) => position.get(l.sourceId)!);
      score = sources.length ? sources.reduce((a, b) => a + b, 0) / sources.length : Number.POSITIVE_INFINITY;
      scores.set(id, score);
    }
    return score;
  };
  for (const groups of columns) {
    for (const group of groups) group.nodes.sort((a, b) => barycentre(a.artifact.id) - barycentre(b.artifact.id) || nodeOrder(a, b));
    const groupKey = (group: LineageGroup) =>
      Math.min(...[group.container.id, ...group.nodes.map((n) => n.artifact.id)].map(barycentre));
    groups.sort(
      (a, b) =>
        groupKey(a) - groupKey(b) ||
        a.container.name.localeCompare(b.container.name) ||
        a.container.timestamp.localeCompare(b.container.timestamp),
    );
    let next = 0;
    for (const group of groups) {
      if (group.containerIsNode) position.set(group.container.id, next++);
      for (const node of group.nodes) position.set(node.artifact.id, next++);
    }
  }
}

