import type {
  CodeArtifact,
  ModelArtifact,
  TraceArtifact,
  TraceChange,
  TraceFile,
  TraceLink,
  TraceOperation,
} from '../types/traceability';
import { changesOf, isCodeArtifact, isModelArtifact } from '../types/traceability';

/** Read-only views over a trace, for the traceability page. Pure functions of the trace. */

/**
 * A project's model artifacts form one tree per diagram: a diagram (of any type; its `elementType`
 * is the B-UML model class, `DomainModel` for a class diagram) has no parent, its elements are its
 * fragments, and their members (attributes, literals) are theirs.
 */

export interface LocatedChange {
  change: TraceChange;
  operation: TraceOperation;
  artifact: TraceArtifact;
}

export interface TraceIndex {
  trace: TraceFile;
  artifacts: Map<string, TraceArtifact>;
  operations: Map<string, TraceOperation>;
  children: Map<string, TraceArtifact[]>;
  /** Every change on an artifact, oldest first. */
  changesByArtifact: Map<string, LocatedChange[]>;
  linksBySource: Map<string, TraceLink[]>;
  linksByTarget: Map<string, TraceLink[]>;
  /** The latest change on each artifact or any of its fragments (ISO time), for suspect checks. */
  latestChangeBelow: Map<string, string>;
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export function indexTrace(trace: TraceFile): TraceIndex {
  const artifacts = new Map(trace.artifacts.map((a) => [a.id, a]));
  const operations = new Map(trace.operations.map((o) => [o.id, o]));
  const children = new Map<string, TraceArtifact[]>();
  for (const artifact of trace.artifacts) if (artifact.parentId) push(children, artifact.parentId, artifact);
  const changesByArtifact = new Map<string, LocatedChange[]>();
  for (const operation of trace.operations) {
    for (const change of changesOf(operation)) {
      const artifact = artifacts.get(change.artifactId);
      if (artifact) push(changesByArtifact, change.artifactId, { change, operation, artifact });
    }
  }
  for (const list of changesByArtifact.values()) list.sort((a, b) => a.change.timestamp.localeCompare(b.change.timestamp));
  const linksBySource = new Map<string, TraceLink[]>();
  const linksByTarget = new Map<string, TraceLink[]>();
  for (const link of trace.traceLinks) {
    push(linksBySource, link.sourceId, link);
    push(linksByTarget, link.targetId, link);
  }
  return {
    trace, artifacts, operations, children, changesByArtifact, linksBySource, linksByTarget,
    latestChangeBelow: latestChangeBelow(artifacts, changesByArtifact),
  };
}

/**
 * Each artifact's latest change, its own or a fragment's, computed once so that checking whether a
 * link is suspect is a lookup rather than a walk of its source's history (a diagram is the source
 * of every whole-file link, and has every change of the diagram below it).
 */
function latestChangeBelow(
  artifacts: Map<string, TraceArtifact>,
  changesByArtifact: Map<string, LocatedChange[]>,
): Map<string, string> {
  const latest = new Map<string, string>();
  for (const [artifactId, changes] of changesByArtifact) {
    const time = changes[changes.length - 1].change.timestamp; // the list is oldest first
    // Up the parent chain; an ancestor already as recent passed it further up itself. The step cap
    // guards against a parent cycle in a hand-edited trace.
    let artifact = artifacts.get(artifactId);
    for (let steps = 0; artifact && steps <= artifacts.size; steps += 1) {
      const known = latest.get(artifact.id);
      if (known !== undefined && known >= time) break;
      latest.set(artifact.id, time);
      artifact = artifact.parentId ? artifacts.get(artifact.parentId) : undefined;
    }
  }
  return latest;
}

/** The artifact and all its fragments, recursively. */
export function withDescendants(index: TraceIndex, artifactId: string): TraceArtifact[] {
  const result: TraceArtifact[] = [];
  const pending = [artifactId];
  while (pending.length) {
    const artifact = index.artifacts.get(pending.pop()!);
    if (!artifact) continue;
    result.push(artifact);
    for (const child of index.children.get(artifact.id) ?? []) pending.push(child.id);
  }
  return result;
}

/** Every change on the artifact and its fragments, oldest first. */
export function historyOf(index: TraceIndex, artifactId: string): LocatedChange[] {
  return withDescendants(index, artifactId)
    .flatMap((a) => index.changesByArtifact.get(a.id) ?? [])
    .sort((a, b) => a.change.timestamp.localeCompare(b.change.timestamp));
}

/** Whether the artifact was deleted, itself or with what holds it (an element of a deleted diagram). */
export function isDeleted(index: TraceIndex, artifactId: string): boolean {
  for (let id: string | undefined = artifactId; id; id = index.artifacts.get(id)?.parentId) {
    const lifecycle = (index.changesByArtifact.get(id) ?? []).filter((c) => c.change.kind !== 'UPDATED');
    if (lifecycle.length > 0 && lifecycle[lifecycle.length - 1].change.kind === 'DELETED') return true;
  }
  return false;
}

/** The changes to a link's source (or its fragments) made after the link: why it is suspect. */
export function changesSince(index: TraceIndex, link: TraceLink): LocatedChange[] {
  return historyOf(index, link.sourceId).filter((c) => c.change.timestamp > link.timestamp);
}

/** True when the link's source, or a fragment of it, changed after the link was made:
 *  the target may no longer match it (`TraceModel.is_suspect` in the metamodel). */
export function isSuspect(index: TraceIndex, link: TraceLink): boolean {
  return (index.latestChangeBelow.get(link.sourceId) ?? '') > link.timestamp;
}

/** A diagram: a model artifact that is not a fragment of another one. */
export const isDiagram = (artifact: TraceArtifact | undefined): boolean => isModelArtifact(artifact) && !artifact.parentId;

/** The display path of a model artifact: `Book.title` for an attribute of Book. */
export function qualifiedName(index: TraceIndex, artifact: TraceArtifact): string {
  const parent = artifact.parentId ? index.artifacts.get(artifact.parentId) : undefined;
  return isModelArtifact(parent) && !isDiagram(parent) ? `${parent.name}.${artifact.name}` : artifact.name;
}

const byName = (a: ModelArtifact, b: ModelArtifact) => a.name.localeCompare(b.name);

/** The project's diagrams, by name. */
export function diagramsOf(index: TraceIndex): ModelArtifact[] {
  return index.trace.artifacts.filter((a): a is ModelArtifact => isModelArtifact(a) && isDiagram(a)).sort(byName);
}

/** The model fragments of a model artifact (a diagram's elements, a class's members), by name. */
export function modelChildren(index: TraceIndex, artifactId: string): ModelArtifact[] {
  return (index.children.get(artifactId) ?? []).filter(isModelArtifact).sort(byName);
}

/** The top-level element an artifact belongs to: itself, or the element directly under its diagram. */
export function topLevelOf(index: TraceIndex, artifact: TraceArtifact): TraceArtifact {
  let current = artifact;
  while (current.parentId) {
    const parent = index.artifacts.get(current.parentId);
    if (!isModelArtifact(parent) || isDiagram(parent)) break;
    current = parent;
  }
  return current;
}

/** The diagram a model artifact belongs to (itself for a diagram); undefined for code. */
export function diagramOf(index: TraceIndex, artifact: TraceArtifact): ModelArtifact | undefined {
  let current: TraceArtifact | undefined = artifact;
  while (current?.parentId) current = index.artifacts.get(current.parentId);
  return isModelArtifact(current) ? current : undefined;
}

/** The diagrams an operation worked on: those it changed and those it read (a generator can read several). */
export function diagramsOfOperation(index: TraceIndex, operation: TraceOperation): ModelArtifact[] {
  const diagrams = new Map<string, ModelArtifact>();
  for (const id of [...changesOf(operation).map((c) => c.artifactId), ...operation.consumes]) {
    const artifact = index.artifacts.get(id);
    const diagram = artifact ? diagramOf(index, artifact) : undefined;
    if (diagram) diagrams.set(diagram.id, diagram);
  }
  return [...diagrams.values()].sort(byName);
}

export interface GeneratedFragment {
  link: TraceLink;
  fragment: CodeArtifact;
  /** The generated file the fragment belongs to (its content may have been dropped). */
  file: CodeArtifact | undefined;
  operation: TraceOperation | undefined;
  suspect: boolean;
}

/** The code generated from an element, newest generation first. */
export function generatedFrom(index: TraceIndex, artifactId: string): GeneratedFragment[] {
  return (index.linksBySource.get(artifactId) ?? [])
    .map((link) => {
      const fragment = index.artifacts.get(link.targetId);
      if (!isCodeArtifact(fragment)) return null;
      const file = fragment.parentId ? index.artifacts.get(fragment.parentId) : undefined;
      return {
        link,
        fragment,
        file: isCodeArtifact(file) ? file : undefined,
        operation: index.operations.get(link.operationId),
        suspect: isSuspect(index, link),
      };
    })
    .filter((entry): entry is GeneratedFragment => entry !== null)
    .sort((a, b) => b.link.timestamp.localeCompare(a.link.timestamp) || (a.fragment.startLine ?? 0) - (b.fragment.startLine ?? 0));
}

/** The lines of a fragment, or of a whole file for a link to the file itself, when the file's content was kept. */
export function fragmentLines(entry: Pick<GeneratedFragment, 'fragment' | 'file'>): string[] | null {
  const { fragment, file } = entry;
  const content = file?.content ?? fragment.content;
  if (content === undefined) return null;
  const lines = content.split('\n').map((line) => line.replace(/\r$/, ''));
  if (fragment.startLine === undefined || fragment.endLine === undefined) return lines;
  return lines.slice(fragment.startLine - 1, fragment.endLine);
}

export type CoverageCell = 'generated' | 'suspect' | 'none';

export interface CoverageRow {
  element: ModelArtifact;
  deleted: boolean;
  cells: CoverageCell[];
}

export interface CoverageMatrix {
  generations: TraceOperation[];
  /** One group per diagram: the diagram's own row (the whole files read from it), then its elements. */
  groups: Array<{ diagram: CoverageRow; elements: CoverageRow[] }>;
}

/**
 * Diagrams and their elements × generation runs (newest first, at most `maxGenerations`).
 * Members (attributes, literals) get no row: their code is part of their element's, and
 * changing a member makes its element's code suspect.
 */
export function coverageMatrix(index: TraceIndex, maxGenerations: number): CoverageMatrix {
  // Runs compacted by retention have no links left: they say nothing about coverage.
  const linked = new Set(index.trace.traceLinks.map((link) => link.operationId));
  const generations = index.trace.operations
    .filter((o) => o.type === 'CodeGeneration' && linked.has(o.id))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, maxGenerations);
  const row = (element: ModelArtifact): CoverageRow => {
    const links = index.linksBySource.get(element.id) ?? [];
    const cells = generations.map((generation): CoverageCell => {
      const own = links.filter((l) => l.operationId === generation.id);
      if (own.length === 0) return 'none';
      return own.some((l) => isSuspect(index, l)) ? 'suspect' : 'generated';
    });
    return { element, deleted: isDeleted(index, element.id), cells };
  };
  const groups = diagramsOf(index).map((diagram) => ({
    diagram: row(diagram),
    elements: modelChildren(index, diagram.id).map(row),
  }));
  return { generations, groups };
}
