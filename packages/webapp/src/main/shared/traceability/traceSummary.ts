import type { CodeArtifact, TraceOperation, TraceTool } from '../types/traceability';
import { isCodeArtifact, toolIdsOf } from '../types/traceability';
import type { Lineage } from './lineage';
import type { TraceIndex } from './traceQueries';

/** Read-only figures over a trace for the Traceability page's header. Pure functions of the trace. */

/** The files of a generator's newest run that may no longer match their models. */
export interface GeneratorStaleness {
  /** The generator (the run's first code generator tool); undefined when the trace lost it. */
  tool: TraceTool | undefined;
  /** The generator's newest run that still has links. */
  operation: TraceOperation;
  /** Its generated files with at least one out-of-date link (to the file or one of its fragments), by path. */
  files: CodeArtifact[];
  /** How many of its files have links at all. */
  linkedFiles: number;
  /** How many out-of-date links point to those files or their fragments. */
  outOfDateLinks: number;
}

export interface TraceSummary {
  operations: number;
  artifacts: number;
  /** The links of the project as it is now (the newest run of each generator, no deleted ends). */
  links: number;
  /** Of those, the ones that may no longer hold. */
  outOfDateLinks: number;
  /** One entry per generator whose newest run has out-of-date files, most files first. */
  staleGenerators: GeneratorStaleness[];
  /** The out-of-date links that point to no generated code (a requirement's link to a class, a model derived from a model). */
  otherOutOfDateLinks: number;
}

/**
 * The page header's counts. `projectLineage` is the whole project's lineage without history
 * (`lineageOf(index, null, { history: false })`), which the page computes once and shares.
 */
export function traceSummary(index: TraceIndex, projectLineage: Lineage): TraceSummary {
  const runs = new Map<string, { operation: TraceOperation; files: Map<string, CodeArtifact>; stale: Set<string>; staleLinks: number }>();
  let outOfDateLinks = 0;
  for (const edge of projectLineage.edges) {
    const stale = edge.outOfDate.length > 0;
    if (stale) outOfDateLinks += 1;
    const operation = index.operations.get(edge.link.operationId);
    if (operation?.type !== 'CodeGeneration') continue;
    const target = index.artifacts.get(edge.link.targetId);
    if (!isCodeArtifact(target)) continue;
    const parent = target.parentId ? index.artifacts.get(target.parentId) : undefined;
    const file = isCodeArtifact(parent) ? parent : target;
    let run = runs.get(operation.id);
    if (!run) runs.set(operation.id, (run = { operation, files: new Map(), stale: new Set(), staleLinks: 0 }));
    run.files.set(file.id, file);
    if (stale) {
      run.stale.add(file.id);
      run.staleLinks += 1;
    }
  }
  const staleGenerators = [...runs.values()]
    .filter((run) => run.stale.size > 0)
    .map((run): GeneratorStaleness => {
      const tool = toolIdsOf(run.operation)
        .map((id) => index.toolsById.get(id))
        .find((candidate) => candidate?.type === 'CodeGenerator');
      return {
        tool,
        operation: run.operation,
        files: [...run.stale].map((id) => run.files.get(id)!).sort((a, b) => a.path.localeCompare(b.path)),
        linkedFiles: run.files.size,
        outOfDateLinks: run.staleLinks,
      };
    })
    .sort((a, b) => b.files.length - a.files.length || (a.tool?.name ?? '').localeCompare(b.tool?.name ?? ''));
  return {
    operations: index.trace.operations.length,
    artifacts: index.trace.artifacts.length,
    links: projectLineage.edges.length,
    outOfDateLinks,
    staleGenerators,
    otherOutOfDateLinks: outOfDateLinks - staleGenerators.reduce((sum, entry) => sum + entry.outOfDateLinks, 0),
  };
}
