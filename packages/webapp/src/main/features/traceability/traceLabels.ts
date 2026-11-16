import type { TFunction } from 'i18next';
import type {
  ExecutionStatus, RequirementKind, TraceArtifact, TraceChangeEvent, TraceOperation, TraceTool,
} from '../../shared/types/traceability';
import { isModelArtifact, toolIdsOf } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { qualifiedName } from '../../shared/traceability/traceQueries';

/** Display text for trace records; the trace itself stores only data. */

/** The translated name of a B-UML metaclass (`Property` -> "attribute"). */
export const elementTypeLabel = (t: TFunction, elementType: string): string =>
  t(`traceability.elementTypes.${elementType}`, { defaultValue: elementType });

/** The Timeline's filter of an operation: its class, for display. */
export type OperationKind = 'modeling' | 'generation' | 'extraction' | 'conversation';

const OPERATION_KINDS: Record<TraceOperation['type'], OperationKind> = {
  ModelingSession: 'modeling',
  CodeGeneration: 'generation',
  RequirementExtraction: 'extraction',
  Conversation: 'conversation',
};

export const operationKind = (operation: TraceOperation): OperationKind => OPERATION_KINDS[operation.type];

/** Whether an agent (the assistant) is among the operation's actors. */
export const byAgent = (operation: TraceOperation, index: TraceIndex): boolean =>
  operation.performedBy.some((id) => index.actorsById.get(id)?.type === 'Agent');

/** The model generator that derived a modeling session's changes in one run, or undefined when they were made
 *  in the editor. */
export const derivedBy = (operation: TraceOperation, index: TraceIndex): TraceTool | undefined =>
  operation.type === 'ModelingSession'
    ? toolIdsOf(operation).map((id) => index.toolsById.get(id)).find((tool) => tool?.type === 'ModelGenerator')
    : undefined;

export const operationLabel = (t: TFunction, operation: TraceOperation, index: TraceIndex): string => {
  if (operation.type === 'CodeGeneration') {
    const generator = toolIdsOf(operation).map((id) => index.toolsById.get(id)?.name).find(Boolean);
    return generator
      ? t('traceability.operations.generation', { generator })
      : t('traceability.operations.generationUnknown');
  }
  if (operation.type === 'RequirementExtraction') return t('traceability.operations.extraction');
  if (operation.type === 'Conversation') return t('traceability.operations.conversation');
  return t(byAgent(operation, index) ? 'traceability.operations.assistant' : 'traceability.operations.modeling');
};

export const actorNames = (operation: TraceOperation, index: TraceIndex, t: TFunction): string =>
  operation.performedBy
    .map((id) => index.actorsById.get(id)?.name ?? t('traceability.unknownActor'))
    .join(', ');

/** The tools an operation's calls invoked, each with its version: "sqlalchemy 8.5.0, gpt-6-luna". */
export const toolNames = (operation: TraceOperation, index: TraceIndex): string =>
  toolIdsOf(operation)
    .flatMap((id) => {
      const tool = index.toolsById.get(id);
      return tool ? [tool.version ? `${tool.name} ${tool.version}` : tool.name] : [];
    })
    .join(', ');

/** How an operation went, translated ("Failed", "Timed out"). */
export const statusLabel = (t: TFunction, status: ExecutionStatus): string =>
  t(`traceability.executionStatus.${status}`, { defaultValue: status });

/** What a requirement asks for, translated ("uniqueness", "user interface"). */
export const requirementKindLabel = (t: TFunction, kind: RequirementKind): string =>
  t(`traceability.requirementKinds.${kind}`, { defaultValue: kind });

/** "uniqueness requirement". */
export const requirementLabel = (t: TFunction, kind: RequirementKind): string =>
  t('traceability.lineage.requirement', { kind: requirementKindLabel(t, kind) });

/** "Renamed attribute Book.title to name", "Created class Book", ... */
export function describeChange(t: TFunction, change: TraceChangeEvent, index: TraceIndex): string {
  const artifact: TraceArtifact | undefined = index.artifacts.get(change.artifactId);
  const type = isModelArtifact(artifact) ? elementTypeLabel(t, artifact.elementType) : '';
  const name = artifact ? qualifiedName(index, artifact) : change.artifactId;
  if (change.kind === 'CREATED') return t('traceability.changes.created', { type, name: change.newValue || name });
  if (change.kind === 'DELETED') return t('traceability.changes.deleted', { type, name: change.oldValue || name });
  if (change.feature === 'name') {
    return t('traceability.changes.renamed', { type, from: change.oldValue ?? '', to: change.newValue ?? '' });
  }
  return t('traceability.changes.updated', {
    type,
    name,
    feature: t(`traceability.features.${change.feature}`, { defaultValue: change.feature ?? '' }),
    from: change.oldValue || '∅',
    to: change.newValue || '∅',
  });
}

export const formatTime = (iso: string, locale?: string): string =>
  new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** At most this many changes are spelled out in the one-line summary of a modeling session. */
const SUMMARY_CHANGES = 3;

/**
 * One line about an operation, for the assistant's trace digest: its label, and for a modeling session its first
 * changes ("Modeling session: Created class Book; Created attribute Book.isbn (+4 more)"). Pass the English `t`:
 * the assistant answers in the user's language.
 */
export function operationSummary(t: TFunction, operation: TraceOperation, index: TraceIndex): string {
  const label = operationLabel(t, operation, index);
  if (operation.type !== 'ModelingSession' || operation.changes.length === 0) return label;
  const shown = operation.changes.slice(0, SUMMARY_CHANGES).map((change) => describeChange(t, change, index));
  const more = operation.changes.length - shown.length;
  return `${label}: ${shown.join('; ')}${more > 0 ? ` (+${more} more)` : ''}`;
}
