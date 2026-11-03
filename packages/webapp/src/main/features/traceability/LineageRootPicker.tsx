import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TraceArtifact } from '../../shared/types/traceability';
import { isCodeArtifact, isModelArtifact } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { qualifiedName } from '../../shared/traceability/traceQueries';
import { lineageOf, lineageStartingPoints } from '../../shared/traceability/lineage';
import { elementTypeLabel, formatTime, operationLabel } from './traceLabels';

export const WHOLE_PROJECT = '__whole_project__';

/** A section heading of the list: not a choice. */
const SECTION = 'pl-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
/** A group heading inside a section (a generation run): not a choice either. */
const SUBHEADING = 'pl-4 pt-1.5 text-xs font-medium text-muted-foreground';

/** What an artifact is called in the list and in the box. */
function artifactLabel(t: ReturnType<typeof useTranslation>['t'], index: TraceIndex, artifact: TraceArtifact): string {
  if (isModelArtifact(artifact)) return qualifiedName(index, artifact);
  if (isCodeArtifact(artifact) && artifact.startLine !== undefined) {
    return `${artifact.path} · ${t('traceability.lineage.lines', { start: artifact.startLine, end: artifact.endLine })}`;
  }
  return isCodeArtifact(artifact) ? artifact.path : artifact.name;
}

/** A choice with its kind on the right, muted. */
const Choice: React.FC<{ value: string; label: string; kind?: string; className?: string }> = ({ value, label, kind, className }) => (
  // The item text fills the row, so the kind sits at its right edge.
  <SelectItem value={value} className={`[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1 ${className ?? ''}`} textValue={label}>
    <span className="flex w-full min-w-0 items-baseline gap-3">
      <span className="truncate">{label}</span>
      {kind && <span className="ml-auto shrink-0 text-[10px] uppercase text-muted-foreground">{kind}</span>}
    </span>
  </SelectItem>
);

/**
 * Where the lineage starts: the whole project, a model or one of its elements, a prompt, or a
 * generated file. Only what takes part in links is offered (anything else has no lineage to show).
 */
export const LineageRootPicker: React.FC<{ index: TraceIndex; rootId: string | null; onChange: (id: string | null) => void }> = ({
  index, rootId, onChange,
}) => {
  const { t, i18n } = useTranslation();
  const points = useMemo(() => lineageStartingPoints(index, lineageOf(index, null, { latestGenerationOnly: true })), [index]);
  const root = rootId ? index.artifacts.get(rootId) : undefined;
  const listed = useMemo(
    () => new Set([
      ...points.models.flatMap(({ model, elements }) => [model.id, ...elements.map((e) => e.id)]),
      ...points.prompts.map((p) => p.id),
      ...points.runs.flatMap((run) => run.files.map((f) => f.id)),
    ]),
    [points],
  );
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('traceability.lineage.startFrom')}</span>
      <Select value={rootId ?? WHOLE_PROJECT} onValueChange={(value) => onChange(value === WHOLE_PROJECT ? null : value)}>
        <SelectTrigger className="h-8 w-64" aria-label={t('traceability.lineage.startFrom')}>
          <SelectValue>{root ? artifactLabel(t, index, root) : t('traceability.lineage.wholeProject')}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[60vh] w-80">
          <SelectItem value={WHOLE_PROJECT} className="font-medium">{t('traceability.lineage.wholeProject')}</SelectItem>

          {/* An artifact reached from the graph (a member, a code fragment) is not in the sections below. */}
          {root && !listed.has(root.id) && (
            <SelectGroup>
              <SelectLabel className={SECTION}>{t('traceability.lineage.picker.selected')}</SelectLabel>
              <Choice value={root.id} label={artifactLabel(t, index, root)} kind={isModelArtifact(root) ? elementTypeLabel(t, root.elementType) : undefined} />
            </SelectGroup>
          )}

          {points.models.length > 0 && <SelectSeparator />}
          {points.models.length > 0 && (
            <SelectGroup>
              <SelectLabel className={SECTION}>{t('traceability.lineage.picker.models')}</SelectLabel>
              {points.models.map(({ model, elements }) => (
                <React.Fragment key={model.id}>
                  <Choice value={model.id} label={model.name} kind={elementTypeLabel(t, model.elementType)} className="font-medium" />
                  {elements.map((element) => (
                    <Choice key={element.id} value={element.id} label={element.name} kind={elementTypeLabel(t, element.elementType)} className="pl-12" />
                  ))}
                </React.Fragment>
              ))}
            </SelectGroup>
          )}

          {points.prompts.length > 0 && (
            <SelectGroup>
              <SelectLabel className={SECTION}>{t('traceability.lineage.picker.prompts')}</SelectLabel>
              {points.prompts.map((prompt) => (
                <Choice key={prompt.id} value={prompt.id} label={prompt.name} kind={formatTime(prompt.timestamp, i18n.language)} />
              ))}
            </SelectGroup>
          )}

          {points.runs.length > 0 && (
            <SelectGroup>
              <SelectLabel className={SECTION}>{t('traceability.lineage.picker.code')}</SelectLabel>
              {points.runs.map(({ operation, files }) => (
                <React.Fragment key={operation.id}>
                  <SelectLabel className={SUBHEADING}>
                    {operationLabel(t, operation, index)} · {formatTime(operation.startedAt, i18n.language)}
                  </SelectLabel>
                  {files.map((file) => (
                    <Choice key={file.id} value={file.id} label={file.path} className="pl-12" />
                  ))}
                </React.Fragment>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
