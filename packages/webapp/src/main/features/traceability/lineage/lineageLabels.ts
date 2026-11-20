import type { TFunction } from 'i18next';
import type { TraceArtifact, TraceEvidence } from '../../../shared/types/traceability';
import { isCodeArtifact, isModelArtifact, isPromptArtifact, isRequirementArtifact } from '../../../shared/types/traceability';
import type { TraceIndex } from '../../../shared/traceability/traceQueries';
import { isDiagram, qualifiedName } from '../../../shared/traceability/traceQueries';
import type { LineageRow, LineageSubject } from '../../../shared/traceability/lineage';
import { elementTypeLabel, formatTime, operationLabel, requirementLabel } from '../traceLabels';

/** Display text for the lineage's rows, nodes and links. */

/** What a node is called: a code fragment by its lines, a card by its name, a part by its own name. */
export const nodeLabel = (t: TFunction, index: TraceIndex, artifact: TraceArtifact, nested = false): string => {
  if (isCodeArtifact(artifact) && artifact.startLine !== undefined) {
    return t('traceability.lineage.lines', { start: artifact.startLine, end: artifact.endLine });
  }
  return isModelArtifact(artifact) && !nested ? qualifiedName(index, artifact) : artifact.name;
};

/** What the parts of a row are called: a run's files, a file's fragments, a diagram's elements, an element's members. */
export function partsLabel(t: TFunction, subject: LineageSubject, count: number): string {
  if (subject.kind === 'run') return t('traceability.lineage.files', { count });
  const { artifact } = subject;
  const key = isCodeArtifact(artifact) ? 'fragments' : isDiagram(artifact) ? 'elements' : 'members';
  return t(`traceability.lineage.${key}`, { count });
}

/** The model element a code fragment was generated from (the source of a link into it). */
export function fragmentSource(index: TraceIndex, fragment: TraceArtifact): TraceArtifact | undefined {
  const link = (index.linksByTarget.get(fragment.id) ?? []).find((l) => isModelArtifact(index.artifacts.get(l.sourceId)));
  return link ? index.artifacts.get(link.sourceId) : undefined;
}

/** When a generated file was written. */
export function codeRun(index: TraceIndex, file: TraceArtifact, locale: string): string | undefined {
  const operation = index.writerOf.get(file.id);
  return operation ? formatTime(operation.startedAt, locale) : undefined;
}

/** The kind of an artifact, for a badge: "class", "uniqueness requirement", "prompt", "code". */
export function artifactKindLabel(t: TFunction, artifact: TraceArtifact): string {
  if (isModelArtifact(artifact)) return elementTypeLabel(t, artifact.elementType);
  if (isRequirementArtifact(artifact)) return requirementLabel(t, artifact.kind);
  return t(isPromptArtifact(artifact) ? 'traceability.lineage.prompt' : 'traceability.lineage.code');
}

const CARD_KINDS = ['diagrams', 'prompts', 'requirements', 'runs', 'files'] as const;

const cardKindOf = (subject: LineageSubject): (typeof CARD_KINDS)[number] => {
  if (subject.kind === 'run') return 'runs';
  const { artifact } = subject;
  if (isModelArtifact(artifact)) return 'diagrams';
  if (isPromptArtifact(artifact)) return 'prompts';
  return isRequirementArtifact(artifact) ? 'requirements' : 'files';
};

/** The cards of a lineage counted by kind, as a list in the page language: "1 diagram and 2 generation runs". */
export function cardCounts(t: TFunction, cards: LineageSubject[], locale: string): string {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(cardKindOf(card), (counts.get(cardKindOf(card)) ?? 0) + 1);
  const parts = CARD_KINDS.filter((kind) => counts.has(kind)).map((kind) =>
    t(`traceability.lineage.cardCounts.${kind}`, { count: counts.get(kind) }),
  );
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts);
}

/** A row's name and the line under it. */
export function describeRow(t: TFunction, index: TraceIndex, row: LineageRow, locale: string): { label: string; subtitle?: string } {
  const { subject, depth } = row;
  if (subject.kind === 'run') return { label: operationLabel(t, subject.operation, index), subtitle: formatTime(subject.operation.startedAt, locale) };
  const { artifact } = subject;
  const fragment = isCodeArtifact(artifact) && artifact.startLine !== undefined ? artifact : undefined;
  const source = fragment && fragmentSource(index, fragment);
  const label =
    fragment && source
      ? t('traceability.lineage.fragmentOf', { name: qualifiedName(index, source), start: fragment.startLine, end: fragment.endLine })
      : nodeLabel(t, index, artifact, depth > 0);
  if (isModelArtifact(artifact)) return { label, subtitle: elementTypeLabel(t, artifact.elementType) };
  if (isPromptArtifact(artifact)) return { label, subtitle: t('traceability.lineage.prompt') };
  if (isRequirementArtifact(artifact)) return { label, subtitle: requirementLabel(t, artifact.kind) };
  // A file outside a run card says when it was generated; inside one, the run says it.
  if (depth === 0) return { label, subtitle: [t('traceability.lineage.file'), codeRun(index, artifact, locale)].filter(Boolean).join(' · ') };
  return { label };
}

export function describeEvidence(t: TFunction, evidence: TraceEvidence): string {
  const count = evidence.logIds?.length ?? 0;
  if (evidence.type === 'AIEvidence') {
    return count > 0
      ? t('traceability.lineage.evidenceKinds.ai', { algorithm: evidence.algorithm, count })
      : t('traceability.lineage.evidenceKinds.aiAlone', { algorithm: evidence.algorithm });
  }
  const rule = t('traceability.lineage.evidenceKinds.rule', { rule: evidence.rule });
  return count > 0 ? `${rule} ${t('traceability.lineage.evidenceKinds.logs', { count })}` : rule;
}
