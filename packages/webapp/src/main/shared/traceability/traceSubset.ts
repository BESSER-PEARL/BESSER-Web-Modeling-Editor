import type { TraceArtifact, TraceFile, TraceOperation } from '../types/traceability';
import { isCodeArtifact, isModelArtifact } from '../types/traceability';

/**
 * The part of a trace that concerns some diagrams, for an export of those diagrams only:
 *
 * - their model artifacts (each diagram and its elements);
 * - what they derive: the files (and line ranges) of the generation runs that read them;
 * - what they come from: the prompts and requirements linked to them, and the prompts those requirements are
 *   linked from;
 * - the operations that read, wrote or changed any of these, reduced to them (a session's changes of other
 *   diagrams, a run's reads of other diagrams go), and the links between kept artifacts made by kept operations;
 * - the actors and tools of those operations; an evidence's log ids are reduced to the logs kept.
 *
 * Elements of other diagrams are left out even when a kept run also read them: the export holds only the
 * selected models. Pure: `trace` is not changed.
 */
export function traceOfDiagrams(trace: TraceFile, diagramIds: ReadonlySet<string>): TraceFile {
  const byId = new Map(trace.artifacts.map((a) => [a.id, a]));
  const rootOf = (artifact: TraceArtifact): TraceArtifact => {
    let current = artifact;
    for (let depth = 0; current.parentId && depth < 100; depth += 1) {
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  };
  const kept = new Set<string>();
  for (const artifact of trace.artifacts) {
    const root = rootOf(artifact);
    if (isModelArtifact(root) && diagramIds.has(root.elementId) && isModelArtifact(artifact)) kept.add(artifact.id);
  }

  // What the diagrams derive: the files of the generation runs that read them, with their line ranges.
  const derivedFiles = new Set<string>();
  for (const operation of trace.operations) {
    if (operation.type !== 'CodeGeneration' || !operation.reads.some((id) => kept.has(id))) continue;
    for (const id of operation.writes) if (isCodeArtifact(byId.get(id))) derivedFiles.add(id);
  }
  for (const artifact of trace.artifacts) {
    if (isCodeArtifact(artifact) && derivedFiles.has(rootOf(artifact).id)) kept.add(artifact.id);
  }

  // What they come from: prompts and requirements linked to kept elements, and the prompts of those requirements.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const link of trace.traceLinks) {
      const source = byId.get(link.sourceId);
      if (kept.has(link.targetId) && (source?.type === 'PromptArtifact' || source?.type === 'RequirementArtifact')) {
        kept.add(source.id);
      }
    }
  }

  const operations: TraceOperation[] = [];
  for (const operation of trace.operations) {
    const reads = operation.reads.filter((id) => kept.has(id));
    const writes = operation.writes.filter((id) => kept.has(id));
    const changes = operation.type === 'ModelingSession' ? operation.changes.filter((c) => kept.has(c.artifactId)) : [];
    if (reads.length === 0 && writes.length === 0 && changes.length === 0) continue;
    // A generation run is kept for what it wrote or read of the selection; a session for its changes of it.
    if (operation.type === 'ModelingSession' && changes.length === 0 && writes.length === 0) continue;
    operations.push(
      operation.type === 'ModelingSession' ? { ...operation, reads, writes, changes } : { ...operation, reads, writes },
    );
  }
  const operationIds = new Set(operations.map((o) => o.id));
  const logIds = new Set(operations.flatMap((o) => o.toolCalls.flatMap((c) => c.logs.map((l) => l.id))));
  const traceLinks = trace.traceLinks
    .filter((link) => operationIds.has(link.operationId) && kept.has(link.sourceId) && kept.has(link.targetId))
    .map((link) => ({
      ...link,
      evidence: link.evidence.map((evidence) => {
        if (!evidence.logIds) return evidence;
        const remaining = evidence.logIds.filter((id) => logIds.has(id));
        const { logIds: _all, ...rest } = evidence;
        return remaining.length > 0 ? { ...rest, logIds: remaining } : rest;
      }),
    }));
  const artifacts = trace.artifacts
    .filter((a) => kept.has(a.id))
    .map((a) => {
      // A file revised from one left out no longer names it.
      if (isCodeArtifact(a) && a.revisionOfId && !kept.has(a.revisionOfId)) {
        const { revisionOfId: _dropped, ...rest } = a;
        return rest;
      }
      return a;
    });
  const actorIds = new Set(operations.flatMap((o) => o.performedBy));
  const toolIds = new Set(operations.flatMap((o) => o.toolCalls.map((c) => c.toolId)));
  return {
    ...trace,
    actors: trace.actors.filter((a) => actorIds.has(a.id)),
    tools: trace.tools.filter((t) => toolIds.has(t.id)),
    artifacts,
    operations,
    traceLinks,
  };
}
