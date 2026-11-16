import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TraceArtifact, TraceOperation } from '../../../../shared/types/traceability';
import type { TraceIndex } from '../../../../shared/traceability/traceQueries';
import type { Lineage } from '../../../../shared/traceability/lineage';
import { actorNames, formatTime, operationLabel, toolNames } from '../../traceLabels';
import { DetailPane, DetailSection } from './DetailPane';

/** A generation run: who ran which generator when, and its files that take part in the lineage. */
export const RunDetail: React.FC<{
  index: TraceIndex;
  lineage: Lineage;
  operation: TraceOperation;
  onSelectNode: (id: string) => void;
}> = ({ index, lineage, operation, onSelectNode }) => {
  const { t, i18n } = useTranslation();
  const inLineage = (file: TraceArtifact) =>
    lineage.nodes.has(file.id) || (index.children.get(file.id) ?? []).some((part) => lineage.nodes.has(part.id));
  const files = operation.writes
    .map((id) => index.artifacts.get(id))
    .filter((file): file is TraceArtifact => file !== undefined && !file.parentId && inLineage(file))
    .sort((a, b) => a.name.localeCompare(b.name));
  const tools = toolNames(operation, index);
  return (
    <DetailPane>
      <h3 className="font-semibold">{operationLabel(t, operation, index)}</h3>
      <p className="text-xs text-muted-foreground">
        {formatTime(operation.startedAt, i18n.language)} · {actorNames(operation, index, t)}
        {tools && ` · ${tools}`}
      </p>
      <DetailSection title={t('traceability.lineage.files', { count: files.length })}>
        <ul className="space-y-0.5 text-xs">
          {files.map((file) => (
            <li key={file.id}>
              <button type="button" onClick={() => onSelectNode(file.id)} className="w-full truncate rounded px-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      </DetailSection>
    </DetailPane>
  );
};
