import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { TraceArtifact } from '../../shared/types/traceability';
import { isCodeArtifact, isModelArtifact } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { qualifiedName } from '../../shared/traceability/traceQueries';
import type { Lineage } from '../../shared/traceability/lineage';
import { lineageStartingPoints } from '../../shared/traceability/lineage';
import { elementTypeLabel, formatTime, operationLabel, requirementKindLabel } from './traceLabels';
import type { ComboItem } from './components/SearchableCombobox';
import { SearchableCombobox } from './components/SearchableCombobox';

export const WHOLE_PROJECT = '__whole_project__';

/** What an artifact is called in the list and in the box. */
function artifactLabel(t: TFunction, index: TraceIndex, artifact: TraceArtifact): string {
  if (isModelArtifact(artifact)) return qualifiedName(index, artifact);
  if (isCodeArtifact(artifact) && artifact.startLine !== undefined) {
    return `${artifact.path} · ${t('traceability.lineage.lines', { start: artifact.startLine, end: artifact.endLine })}`;
  }
  return isCodeArtifact(artifact) ? artifact.path : artifact.name;
}

interface LineageRootPickerProps {
  index: TraceIndex;
  /** The whole project's lineage without history, computed once by the page. */
  projectLineage: Lineage;
  rootId: string | null;
  onChange: (id: string | null) => void;
}

/**
 * Where the lineage starts: the whole project, a model or one of its elements, a prompt, a requirement or a
 * generated file, in a searchable list. Only what takes part in links is offered (anything else has no
 * lineage to show).
 */
export const LineageRootPicker: React.FC<LineageRootPickerProps> = ({ index, projectLineage, rootId, onChange }) => {
  const { t, i18n } = useTranslation();
  const points = useMemo(() => lineageStartingPoints(index, projectLineage), [index, projectLineage]);
  const root = rootId ? index.artifacts.get(rootId) : undefined;

  const items = useMemo(() => {
    const list: ComboItem[] = [
      { kind: 'option', value: WHOLE_PROJECT, label: t('traceability.lineage.wholeProject'), emphasis: true },
    ];
    const listed = new Set<string>();
    const option = (item: Extract<ComboItem, { kind: 'option' }>) => {
      listed.add(item.value);
      list.push(item);
    };
    if (points.models.length > 0) {
      list.push({ kind: 'heading', key: 'models', label: t('traceability.lineage.picker.models'), level: 1 });
      for (const { model, elements } of points.models) {
        const type = elementTypeLabel(t, model.elementType);
        option({ kind: 'option', value: model.id, label: model.name, detail: type, emphasis: true });
        for (const element of elements) {
          option({
            kind: 'option', value: element.id, label: element.name, detail: elementTypeLabel(t, element.elementType),
            keywords: model.name, indent: true,
          });
        }
      }
    }
    if (points.prompts.length > 0) {
      list.push({ kind: 'heading', key: 'prompts', label: t('traceability.lineage.picker.prompts'), level: 1 });
      for (const prompt of points.prompts) {
        option({ kind: 'option', value: prompt.id, label: prompt.name, detail: formatTime(prompt.timestamp, i18n.language), keywords: prompt.content });
      }
    }
    if (points.requirements.length > 0) {
      list.push({ kind: 'heading', key: 'requirements', label: t('traceability.lineage.picker.requirements'), level: 1 });
      for (const requirement of points.requirements) {
        option({ kind: 'option', value: requirement.id, label: requirement.name, detail: requirementKindLabel(t, requirement.kind), keywords: requirement.quote });
      }
    }
    if (points.runs.length > 0) {
      list.push({ kind: 'heading', key: 'code', label: t('traceability.lineage.picker.code'), level: 1 });
      for (const { operation, files } of points.runs) {
        list.push({
          kind: 'heading', key: operation.id, level: 2,
          label: `${operationLabel(t, operation, index)} · ${formatTime(operation.startedAt, i18n.language)}`,
        });
        for (const file of files) option({ kind: 'option', value: file.id, label: file.path, indent: true });
      }
    }
    // An artifact reached from the graph (a member, a code fragment) is not in the sections above.
    if (root && !listed.has(root.id)) {
      list.splice(
        1, 0,
        { kind: 'heading', key: 'selected', label: t('traceability.lineage.picker.selected'), level: 1 },
        {
          kind: 'option', value: root.id, label: artifactLabel(t, index, root),
          detail: isModelArtifact(root) ? elementTypeLabel(t, root.elementType) : undefined,
        },
      );
    }
    return list;
  }, [points, root, index, t, i18n.language]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-sm text-muted-foreground">{t('traceability.lineage.startFrom')}</span>
      <SearchableCombobox
        className="w-72 max-w-full"
        items={items}
        value={rootId ?? WHOLE_PROJECT}
        onChange={(value) => onChange(value === WHOLE_PROJECT ? null : value)}
        valueLabel={root ? artifactLabel(t, index, root) : t('traceability.lineage.wholeProject')}
        label={t('traceability.lineage.startFrom')}
        searchPlaceholder={t('traceability.lineage.picker.search')}
        emptyText={t('traceability.lineage.picker.noMatch')}
        moreText={(count) => t('traceability.lineage.picker.more', { count })}
      />
    </div>
  );
};
