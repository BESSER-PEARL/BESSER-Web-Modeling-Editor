import type { TFunction } from 'i18next';
import type { TraceArtifact, TraceChange, TraceOperation } from '../../shared/types/traceability';
import { isModelArtifact } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { qualifiedName } from '../../shared/traceability/traceQueries';

/** Display text for trace records; the trace itself stores only data. */

/** The translated name of a B-UML metaclass (`Property` -> "attribute"). */
export const elementTypeLabel = (t: TFunction, elementType: string): string =>
  t(`traceability.elementTypes.${elementType}`, { defaultValue: elementType });

/** The Timeline's filter of an operation: its class, for display. */
export type OperationKind = 'modeling' | 'generation' | 'conversation';

export const operationKind = (operation: TraceOperation): OperationKind =>
  operation.type === 'CodeGeneration' ? 'generation' : operation.type === 'Conversation' ? 'conversation' : 'modeling';

/** Whether an agent (the assistant) is among the operation's actors. */
export const byAgent = (operation: TraceOperation, index: TraceIndex): boolean =>
  operation.performedBy.some((id) => index.trace.actors.find((a) => a.id === id)?.type === 'Agent');

export const operationLabel = (t: TFunction, operation: TraceOperation, index: TraceIndex): string => {
  if (operation.type === 'CodeGeneration') {
    const generator = operation.uses.map((id) => index.trace.tools.find((tool) => tool.id === id)?.name).find(Boolean);
    return t('traceability.operations.generation', { generator: generator ?? '?' });
  }
  if (operation.type === 'Conversation') return t('traceability.operations.conversation');
  return t(byAgent(operation, index) ? 'traceability.operations.assistant' : 'traceability.operations.modeling');
};

export const actorNames = (operation: TraceOperation, index: TraceIndex): string =>
  operation.performedBy.map((id) => index.trace.actors.find((a) => a.id === id)?.name ?? '?').join(', ');

/** "Renamed attribute Book.title to name", "Created class Book", ... */
export function describeChange(t: TFunction, change: TraceChange, index: TraceIndex): string {
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
