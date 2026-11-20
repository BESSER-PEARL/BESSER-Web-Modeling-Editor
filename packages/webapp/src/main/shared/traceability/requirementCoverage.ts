import type {
  CodeArtifact, ModelArtifact, PromptArtifact, RequirementArtifact, TraceConfidence, TraceEvidence, TraceLink, TraceOperation,
} from '../types/traceability';
import { isCodeArtifact, isModelArtifact, isPromptArtifact, isRequirementArtifact, toolIdsOf } from '../types/traceability';
import type { OutOfDateReason, TraceIndex } from './traceQueries';
import { isDeleted, latestRequirements, outOfDate, topLevelOf } from './traceQueries';

/**
 * Requirements × what realizes them: the model elements a requirement is linked to, the generated code reached
 * through those elements (the newest run of each generator), and the code a requirement is linked to directly
 * (a spec-driven run's verdict, with its confidence and AI evidence). Read-only; a pure function of the trace.
 */

/** A model element linked from the requirement (the assistant's realization). */
export interface RequirementRealization {
  element: ModelArtifact;
  link: TraceLink;
  deleted: boolean;
}

/** Generated code that realizes a requirement, reached through an element or linked directly. */
export interface RequirementCode {
  /** The fragment or file the link points to. */
  code: CodeArtifact;
  /** The generated file it belongs to (itself for a whole file). */
  file: CodeArtifact;
  /** The model element the code was generated from; null for a direct requirement -> code link. */
  via: ModelArtifact | null;
  link: TraceLink;
  outOfDate: OutOfDateReason[];
}

/** A direct requirement -> code link: how sure the run that made it was, and why. */
export interface RequirementVerdict {
  link: TraceLink;
  code: CodeArtifact;
  confidence: TraceConfidence | undefined;
  evidence: TraceEvidence[];
}

/**
 * - `generated`: realized in the model, and code was generated from it (or the requirement links to code).
 * - `modeled`: realized in the model, but no code was generated from those elements yet.
 * - `uncovered`: nothing in the model or the code realizes it (or only deleted elements did).
 */
export type RequirementStatus = 'generated' | 'modeled' | 'uncovered';

export interface RequirementRow {
  requirement: RequirementArtifact;
  realizations: RequirementRealization[];
  code: RequirementCode[];
  verdicts: RequirementVerdict[];
  status: RequirementStatus;
  /** Some of its code may no longer match its elements. */
  outOfDate: boolean;
}

/** The requirements one extraction stated, in the order stated. */
export interface RequirementGroup {
  extraction: TraceOperation;
  /** The prompt the requirements were stated in, when the trace kept it. */
  prompt: PromptArtifact | undefined;
  /** The extraction whose model still stands (see `latestRequirements`); older ones describe earlier requests. */
  current: boolean;
  rows: RequirementRow[];
}

export interface RequirementCoverage {
  /** Newest extraction first. */
  groups: RequirementGroup[];
  counts: Record<RequirementStatus, number>;
}

/** For each generator, the newest run among `links`: older runs' code was replaced. */
function newestPerGenerator(index: TraceIndex, links: TraceLink[]): TraceLink[] {
  const newest = new Map<string, TraceOperation>();
  const keyOf = (operation: TraceOperation) => toolIdsOf(operation).join(',');
  for (const link of links) {
    const operation = index.operations.get(link.operationId);
    if (operation?.type !== 'CodeGeneration') continue;
    const current = newest.get(keyOf(operation));
    if (!current || operation.startedAt > current.startedAt) newest.set(keyOf(operation), operation);
  }
  return links.filter((link) => {
    const operation = index.operations.get(link.operationId);
    return operation?.type === 'CodeGeneration' && newest.get(keyOf(operation))?.id === operation.id;
  });
}

const fileOf = (index: TraceIndex, code: CodeArtifact): CodeArtifact => {
  const parent = code.parentId ? index.artifacts.get(code.parentId) : undefined;
  return isCodeArtifact(parent) ? parent : code;
};

function rowOf(index: TraceIndex, requirement: RequirementArtifact): RequirementRow {
  const outgoing = index.linksBySource.get(requirement.id) ?? [];
  const realizations = outgoing.flatMap((link): RequirementRealization[] => {
    const element = index.artifacts.get(link.targetId);
    return isModelArtifact(element) ? [{ element, link, deleted: isDeleted(index, element.id) }] : [];
  });

  const code = new Map<string, RequirementCode>();
  // Through each live element: the code of the element itself, or of the element holding it (an attribute's
  // code is part of its class's).
  const holders = new Map<string, ModelArtifact>();
  for (const { element, deleted } of realizations) {
    if (deleted) continue;
    const holder = topLevelOf(index, element);
    for (const candidate of [element, holder]) if (isModelArtifact(candidate)) holders.set(candidate.id, candidate);
  }
  for (const holder of holders.values()) {
    const links = newestPerGenerator(index, index.linksBySource.get(holder.id) ?? []);
    for (const link of links) {
      const target = index.artifacts.get(link.targetId);
      if (!isCodeArtifact(target) || code.has(target.id)) continue;
      code.set(target.id, { code: target, file: fileOf(index, target), via: holder, link, outOfDate: outOfDate(index, link) });
    }
  }

  const verdicts: RequirementVerdict[] = [];
  for (const link of outgoing) {
    const target = index.artifacts.get(link.targetId);
    if (!isCodeArtifact(target)) continue;
    verdicts.push({ link, code: target, confidence: link.confidence, evidence: link.evidence });
    if (!code.has(target.id)) {
      code.set(target.id, { code: target, file: fileOf(index, target), via: null, link, outOfDate: outOfDate(index, link) });
    }
  }

  const live = realizations.some((r) => !r.deleted);
  const codeList = [...code.values()].sort(
    (a, b) => a.file.path.localeCompare(b.file.path) || (a.code.startLine ?? 0) - (b.code.startLine ?? 0),
  );
  const status: RequirementStatus = codeList.length > 0 ? 'generated' : live ? 'modeled' : 'uncovered';
  return {
    requirement,
    realizations,
    code: codeList,
    verdicts,
    status,
    outOfDate: codeList.some((c) => c.outOfDate.length > 0),
  };
}

/** Every recorded requirement with what realizes it, grouped by the extraction that stated it. */
export function requirementCoverage(index: TraceIndex): RequirementCoverage {
  const current = new Set(latestRequirements(index.trace, index).map((r) => r.id));
  const counts: Record<RequirementStatus, number> = { generated: 0, modeled: 0, uncovered: 0 };
  const groups = index.trace.operations
    .filter((operation) => operation.type === 'RequirementExtraction')
    .map((extraction): RequirementGroup => {
      const requirements = extraction.writes.map((id) => index.artifacts.get(id)).filter(isRequirementArtifact);
      const prompt = extraction.reads.map((id) => index.artifacts.get(id)).find(isPromptArtifact);
      const rows = requirements.map((requirement) => rowOf(index, requirement));
      return { extraction, prompt, current: requirements.some((r) => current.has(r.id)), rows };
    })
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.extraction.startedAt.localeCompare(a.extraction.startedAt));
  for (const group of groups) for (const row of group.rows) counts[row.status] += 1;
  return { groups, counts };
}
