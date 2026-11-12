import type {
  CodeArtifact, ModelArtifact, PromptArtifact, RequirementArtifact, TraceArtifact, TraceLink, TraceOperation,
} from '../types/traceability';
import { isCodeArtifact, isModelArtifact, isPromptArtifact, isRequirementArtifact, toolIdsOf } from '../types/traceability';
import type { TraceIndex } from './traceQueries';
import type { OutOfDateReason } from './traceQueries';
import { isDeleted, outOfDate, withDescendants } from './traceQueries';

/**
 * The lineage of an artifact: everything it was derived from and everything derived from it,
 * following trace links transitively in both directions. Generic over artifact and link kinds,
 * so a chain requirement -> model element -> code needs nothing beyond what model -> code does.
 *
 * It is shown overview first: one card per top-level artifact (a diagram, a generated file, a
 * prompt), with the links between them bundled. Expanding a card shows its parts that take part
 * in links (a diagram's elements, a class's members, a file's fragments), and the links reach them.
 * A model shows its other elements too, untraced, as the editor has them: every element of a
 * diagram in the whole project's lineage, and every member of an element in another's.
 */

export interface LineageEdge {
  link: TraceLink;
  /** Why the link may no longer hold (`TraceLink./outOfDate`); empty while it holds. */
  outOfDate: OutOfDateReason[];
}

export interface LineageNode {
  artifact: TraceArtifact;
  /** A link into it has a changed source, here or further upstream: its content may be out of date. */
  outOfDate: boolean;
}

export interface Lineage {
  /** The artifact the lineage starts from; null for the whole project. */
  rootId: string | null;
  /** The artifacts at either end of a link. */
  nodes: Map<string, LineageNode>;
  edges: LineageEdge[];
}

export interface LineageOptions {
  /** Keep what the project no longer is: the links of older generations (per source and generator, a newer run
   *  supersedes them) and the links from or to a deleted element. Without it the lineage is the project now. */
  history: boolean;
}

/** `links` without generation links superseded by a newer run of the same generator. */
function withoutOlderGenerations(index: TraceIndex, links: TraceLink[]): TraceLink[] {
  const newest = new Map<string, string>(); // generator tool ids -> newest operation id
  const started = (operationId: string) => index.operations.get(operationId)?.startedAt ?? '';
  const keyOf = (link: TraceLink) => {
    const operation = index.operations.get(link.operationId);
    return operation?.type === 'CodeGeneration' ? toolIdsOf(operation).join(',') : undefined;
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

/** Longest-path layering of `ids` along `pairs` (source, target); capped at one pass per id, so a
 *  (malformed) cycle cannot loop forever. Self-pairs are ignored. */
function layers(ids: Iterable<string>, pairs: [string, string][]): Map<string, number> {
  const layer = new Map([...ids].map((id) => [id, 0]));
  for (let pass = 0; pass < layer.size; pass += 1) {
    let moved = false;
    for (const [source, target] of pairs) {
      if (source === target) continue;
      const wanted = layer.get(source)! + 1;
      if (wanted > layer.get(target)!) {
        layer.set(target, wanted);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return layer;
}

/** The lineage of `rootId` (the root and its parts that take part in links), or of the whole project. */
export function lineageOf(index: TraceIndex, rootId: string | null, options: LineageOptions): Lineage {
  const current = (link: TraceLink) => !isDeleted(index, link.sourceId) && !isDeleted(index, link.targetId);
  const outgoing = (id: string) => {
    const links = index.linksBySource.get(id) ?? [];
    return options.history ? links : withoutOlderGenerations(index, links).filter(current);
  };
  const incoming = (id: string) => {
    const links = index.linksByTarget.get(id) ?? [];
    return options.history ? links : links.filter(current);
  };

  const edges = new Map<string, TraceLink>();
  if (rootId === null) {
    // The whole project: every source's links (as it is now, unless its history is asked for).
    for (const source of index.linksBySource.keys()) for (const link of outgoing(source)) edges.set(link.id, link);
  } else {
    // The root and its parts that take part in links (a diagram's elements, a file's fragments).
    const linked = (a: TraceArtifact) => index.linksBySource.has(a.id) || index.linksByTarget.has(a.id);
    const seeds = withDescendants(index, rootId).filter(linked).map((a) => a.id);
    const walk = (next: (id: string) => TraceLink[], end: (link: TraceLink) => string) => {
      const pending = [...seeds];
      const seen = new Set(seeds);
      while (pending.length) {
        for (const link of next(pending.pop()!)) {
          edges.set(link.id, link);
          const other = end(link);
          if (!seen.has(other)) {
            seen.add(other);
            pending.push(other);
          }
        }
      }
    };
    walk(outgoing, (link) => link.targetId); // what was derived from the root
    walk(incoming, (link) => link.sourceId); // what the root was derived from
  }
  const links = [...edges.values()].filter((l) => index.artifacts.has(l.sourceId) && index.artifacts.has(l.targetId));
  // Without the history, an artifact reached only through it (an older generation, a deleted element) is not
  // part of the lineage.
  const ends = new Set([...links.flatMap((l) => [l.sourceId, l.targetId]), ...(rootId ? [rootId] : [])]);

  const lineageEdges = links.map((link) => ({ link, outOfDate: outOfDate(index, link) }));
  // A node may be out of date when a link into it is, because of its source or further upstream; an
  // edited target is not: it is the edit itself.
  const behind = new Set(
    lineageEdges.filter((e) => e.outOfDate.some((reason) => reason !== 'TARGET_CHANGED')).map((e) => e.link.targetId),
  );
  const nodes = new Map<string, LineageNode>();
  for (const id of ends) {
    const artifact = index.artifacts.get(id);
    if (artifact) nodes.set(id, { artifact, outOfDate: behind.has(id) });
  }
  return { rootId, nodes, edges: lineageEdges };
}

/** What a row of the layout shows: an artifact, or a generation run holding the files it wrote. */
export type LineageSubject =
  | { kind: 'artifact'; id: string; artifact: TraceArtifact }
  | { kind: 'run'; id: string; operation: TraceOperation };

const RUN_PREFIX = 'run:';
/** The id of a generation run's row (runs are operations, so their ids live apart from artifacts'). */
export const runSubjectId = (operationId: string) => RUN_PREFIX + operationId;
/** The generation run a row id names, if it names one. */
export const runOfSubjectId = (index: TraceIndex, subjectId: string) =>
  subjectId.startsWith(RUN_PREFIX) ? index.operations.get(subjectId.slice(RUN_PREFIX.length)) : undefined;

/** One visible row of a card: the card's subject itself (depth 0) or one of its parts. */
export interface LineageRow {
  subject: LineageSubject;
  depth: number;
  /** Its parts that take part in the lineage: what expanding it shows. */
  parts: number;
  expanded: boolean;
  /** Out of date itself or, while collapsed, in a part it hides. */
  outOfDate: boolean;
  /** It takes part in the lineage; false for a model element shown only because its model has it. */
  traced: boolean;
}

/** A top-level subject of the lineage (a diagram, a generation run, a prompt) and its visible rows. */
export interface LineageCard {
  subject: LineageSubject;
  rows: LineageRow[];
}

/** The links between two visible rows: one link, or several bundled while an end is collapsed. */
export interface LineageBundle {
  key: string;
  sourceId: string;
  targetId: string;
  edges: LineageEdge[];
}

export interface LineageLayout {
  /** Cards in columns: each link points one column or more to the right. */
  columns: LineageCard[][];
  /** Links between cards. One between parts of a single card (an element derived from another of the
   *  same diagram) is not drawn; the detail of either end lists it. */
  bundles: LineageBundle[];
}

/** Diagrams first, then prompts and the requirements stated in them, then generated code: the order a
 *  lineage usually reads in. */
function cardKind(subject: LineageSubject): number {
  if (subject.kind === 'run') return 2;
  const { artifact } = subject;
  return isModelArtifact(artifact) ? 0 : isPromptArtifact(artifact) || isRequirementArtifact(artifact) ? 1 : 3;
}
const subjectName = (subject: LineageSubject) => (subject.kind === 'run' ? subject.operation.startedAt : subject.artifact.name);
/** Elements before their members, attributes before methods and constraints. */
const MEMBER_RANK: Record<string, number> = { Property: 1, EnumerationLiteral: 1, Method: 2, Constraint: 3 };

function partOrder(a: LineageSubject, b: LineageSubject): number {
  if (a.kind === 'run' || b.kind === 'run') return 0;
  const [x, y] = [a.artifact, b.artifact];
  if (isCodeArtifact(x) && isCodeArtifact(y)) return (x.startLine ?? 0) - (y.startLine ?? 0) || x.path.localeCompare(y.path);
  const rank = (z: TraceArtifact) => (isModelArtifact(z) ? (MEMBER_RANK[z.elementType] ?? 0) : 0);
  return rank(x) - rank(y) || x.name.localeCompare(y.name);
}

/**
 * Who holds what: an artifact's parent holds it, and a generation run holds the files it wrote
 * (so a run with dozens of files is one card until opened).
 */
class LineageTree {
  private readonly runOfFile = new Map<string, TraceOperation>();
  private readonly chains = new Map<string, LineageSubject[]>();

  constructor(private readonly index: TraceIndex) {
    for (const operation of index.trace.operations) {
      if (operation.type !== 'CodeGeneration') continue;
      for (const id of operation.writes) {
        if (!index.artifacts.get(id)?.parentId) this.runOfFile.set(id, operation);
      }
    }
  }

  /** The subjects holding the artifact, from the top-level one down to the artifact itself. */
  chainOf(artifactId: string): LineageSubject[] {
    let chain = this.chains.get(artifactId);
    if (!chain) {
      chain = [];
      // The step cap guards against a parent cycle in a hand-edited trace.
      for (let current = this.index.artifacts.get(artifactId); current && chain.length <= this.index.artifacts.size; ) {
        chain.unshift({ kind: 'artifact', id: current.id, artifact: current });
        current = current.parentId ? this.index.artifacts.get(current.parentId) : undefined;
      }
      const run = chain.length > 0 ? this.runOfFile.get(chain[0].id) : undefined;
      if (run) chain.unshift({ kind: 'run', id: runSubjectId(run.id), operation: run });
      this.chains.set(artifactId, chain);
    }
    return chain;
  }

  /** The subject's direct parts among `involved`, and with `complete` its other model elements that are
   *  not deleted (untraced ones: the editor has them). */
  partsOf(subject: LineageSubject, involved: Map<string, LineageSubject>, complete = false): LineageSubject[] {
    if (subject.kind === 'run') {
      const files = subject.operation.writes.filter((id) => this.runOfFile.get(id) === subject.operation);
      return files.flatMap((id) => (involved.has(id) ? [involved.get(id)!] : [])).sort(partOrder);
    }
    return (this.index.children.get(subject.id) ?? [])
      .flatMap((child): LineageSubject[] => {
        if (involved.has(child.id)) return [involved.get(child.id)!];
        const untraced = complete && isModelArtifact(child) && !isDeleted(this.index, child.id);
        return untraced ? [{ kind: 'artifact', id: child.id, artifact: child }] : [];
      })
      .sort(partOrder);
  }
}

/** What a lineage involves: its nodes and every subject holding one, the top-level ones (its cards), and
 *  which subjects show all their model elements (the whole project's models, a node's members). */
function involvementOf(index: TraceIndex, lineage: Lineage) {
  const tree = new LineageTree(index);
  const involved = new Map<string, LineageSubject>();
  const outOfDateBelow = new Set<string>();
  const tops = new Set<string>();
  for (const node of lineage.nodes.values()) {
    const chain = tree.chainOf(node.artifact.id);
    tops.add(chain[0].id);
    for (const subject of chain) {
      involved.set(subject.id, subject);
      if (node.outOfDate) outOfDateBelow.add(subject.id);
    }
  }
  const complete = (subject: LineageSubject) =>
    subject.kind === 'artifact' &&
    isModelArtifact(subject.artifact) &&
    (lineage.rootId === null || lineage.nodes.has(subject.id) || !involved.has(subject.id));
  const partsOf = (subject: LineageSubject) => tree.partsOf(subject, involved, complete(subject));
  return { tree, involved, outOfDateBelow, tops, partsOf };
}

/** The ids of the subjects holding the artifact, without the artifact: what to expand to show it. */
export function pathTo(index: TraceIndex, artifactId: string): string[] {
  return new LineageTree(index).chainOf(artifactId).slice(0, -1).map((subject) => subject.id);
}

/**
 * The lineage as cards, rows and bundles, with `expanded` subjects showing their parts. A link is
 * drawn between the deepest visible rows holding its ends, so links into a collapsed card or part
 * are bundled; cards keep their columns whatever is expanded.
 */
export function lineageLayout(index: TraceIndex, lineage: Lineage, expanded: ReadonlySet<string>): LineageLayout {
  const { tree, involved, outOfDateBelow, tops, partsOf } = involvementOf(index, lineage);
  const topOf = (id: string) => tree.chainOf(id)[0].id;

  // A link end is drawn at its deepest visible holder: below a collapsed one, its parts are hidden.
  const anchorOf = (id: string) => {
    const chain = tree.chainOf(id);
    let depth = 0;
    while (depth < chain.length - 1 && expanded.has(chain[depth].id)) depth += 1;
    return chain[depth].id;
  };

  const bundles = new Map<string, LineageBundle>();
  for (const edge of lineage.edges) {
    if (topOf(edge.link.sourceId) === topOf(edge.link.targetId)) continue;
    const sourceId = anchorOf(edge.link.sourceId);
    const targetId = anchorOf(edge.link.targetId);
    const key = `${sourceId}->${targetId}`;
    const bundle = bundles.get(key);
    if (bundle) bundle.edges.push(edge);
    else bundles.set(key, { key, sourceId, targetId, edges: [edge] });
  }

  const rowsOf = (subject: LineageSubject, depth: number, rows: LineageRow[]) => {
    const parts = partsOf(subject);
    const open = expanded.has(subject.id) && parts.length > 0;
    const stale = open ? lineage.nodes.get(subject.id)?.outOfDate === true : outOfDateBelow.has(subject.id);
    rows.push({ subject, depth, parts: parts.length, expanded: open, outOfDate: stale, traced: involved.has(subject.id) });
    if (open) for (const part of parts) rowsOf(part, depth + 1, rows);
    return rows;
  };

  // Columns from the links between cards, so expanding a card never moves another one sideways.
  const pairs = lineage.edges.map((e): [string, string] => [topOf(e.link.sourceId), topOf(e.link.targetId)]);
  const column = layers(tops, pairs);
  const columns: LineageSubject[][] = Array.from({ length: Math.max(0, ...column.values()) + 1 }, () => []);
  for (const id of tops) columns[column.get(id)!].push(involved.get(id)!);
  orderColumns(columns, pairs);

  return {
    columns: columns.map((cards) => cards.map((subject) => ({ subject, rows: rowsOf(subject, 0, []) }))),
    bundles: [...bundles.values()],
  };
}

/**
 * Order each column so links cross as little as possible: the first by kind and name, every later
 * one by the mean position of its cards' sources (the barycentre heuristic), kind and name as tie-breaks.
 */
function orderColumns(columns: LineageSubject[][], pairs: [string, string][]): void {
  const position = new Map<string, number>();
  const sources = new Map<string, string[]>();
  for (const [source, target] of pairs) {
    if (source !== target) sources.set(target, [...(sources.get(target) ?? []), source]);
  }
  const barycentre = (id: string) => {
    const placed = (sources.get(id) ?? []).filter((s) => position.has(s)).map((s) => position.get(s)!);
    return placed.length ? placed.reduce((a, b) => a + b, 0) / placed.length : Number.POSITIVE_INFINITY;
  };
  for (const cards of columns) {
    const score = new Map(cards.map((card) => [card.id, barycentre(card.id)]));
    cards.sort(
      (a, b) =>
        score.get(a.id)! - score.get(b.id)! ||
        cardKind(a) - cardKind(b) ||
        subjectName(a).localeCompare(subjectName(b)) ||
        a.id.localeCompare(b.id),
    );
    cards.forEach((card, i) => position.set(card.id, i));
  }
}

/** Every subject of the lineage that has parts to show: what "expand all" opens. */
export function expandableIds(index: TraceIndex, lineage: Lineage): Set<string> {
  const { involved, tops, partsOf } = involvementOf(index, lineage);
  const result = new Set<string>();
  const visit = (subject: LineageSubject) => {
    const parts = partsOf(subject);
    if (parts.length === 0) return;
    result.add(subject.id);
    parts.forEach(visit);
  };
  for (const top of tops) visit(involved.get(top)!);
  return result;
}

/** What the lineage can start from, by kind: what the "Lineage of" list offers. */
export interface LineageStartingPoints {
  /** Each model (diagram) with its elements, both taking part in links. */
  models: { model: ModelArtifact; elements: ModelArtifact[] }[];
  prompts: PromptArtifact[];
  /** The requirements extracted from those prompts, newest extraction first, each in the order stated. */
  requirements: RequirementArtifact[];
  /** Each generation run with its files, newest run first. */
  runs: { operation: TraceOperation; files: CodeArtifact[] }[];
}

/** Classes first, then enumerations, associations, generalizations and constraints. */
const ELEMENT_RANK: Record<string, number> = {
  Class: 0, AssociationClass: 0, Enumeration: 1, BinaryAssociation: 2, Generalization: 3, Constraint: 4,
};

/** The artifacts of `lineage` (the whole project's) a lineage can start from, by kind. */
export function lineageStartingPoints(index: TraceIndex, lineage: Lineage): LineageStartingPoints {
  const tree = new LineageTree(index);
  const involved = new Map<string, LineageSubject>();
  for (const node of lineage.nodes.values()) {
    for (const subject of tree.chainOf(node.artifact.id)) involved.set(subject.id, subject);
  }
  const artifacts = [...involved.values()].flatMap((s) => (s.kind === 'artifact' ? [s.artifact] : []));
  const byName = (a: TraceArtifact, b: TraceArtifact) => a.name.localeCompare(b.name);
  const elementOrder = (a: ModelArtifact, b: ModelArtifact) =>
    (ELEMENT_RANK[a.elementType] ?? 5) - (ELEMENT_RANK[b.elementType] ?? 5) || byName(a, b);

  const models = artifacts
    .filter((a): a is ModelArtifact => isModelArtifact(a) && !a.parentId)
    .sort(byName)
    .map((model) => ({
      model,
      elements: artifacts.filter((a): a is ModelArtifact => isModelArtifact(a) && a.parentId === model.id).sort(elementOrder),
    }));
  const prompts = artifacts.filter((a): a is PromptArtifact => isPromptArtifact(a)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const recorded = new Map([...index.artifacts.keys()].map((id, position) => [id, position]));
  const requirements = artifacts
    .filter((a): a is RequirementArtifact => isRequirementArtifact(a))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || recorded.get(a.id)! - recorded.get(b.id)!);
  const runs = [...involved.values()]
    .flatMap((s) => (s.kind === 'run' ? [s] : []))
    .map((run) => ({
      operation: run.operation,
      files: tree.partsOf(run, involved).flatMap((part) => (part.kind === 'artifact' && isCodeArtifact(part.artifact) ? [part.artifact] : [])),
    }))
    .sort((a, b) => b.operation.startedAt.localeCompare(a.operation.startedAt));
  return { models, prompts, requirements, runs };
}
