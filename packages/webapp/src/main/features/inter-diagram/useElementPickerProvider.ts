import { useMemo } from 'react';
import type { ElementPickerProvider, PickableElement } from '@besser/wme';
import { useAppSelector } from '../../app/store/hooks';
import { selectProject, selectActiveDiagram } from '../../app/store/workspaceSlice';
import { BesserProject, isUMLModel } from '../../shared/types/project';

/**
 * Pure enumerator: every element of the given `typeTokens` across all
 * diagrams of `project` except `excludeDiagramId`. Exported for unit tests
 * (editor popups cannot be unit-tested in this repo; host-side vitest can).
 */
export function collectPickableElements(
  project: BesserProject | null,
  typeTokens: string[],
  excludeDiagramId?: string,
): PickableElement[] {
  if (!project) return [];
  const wanted = new Set(typeTokens);
  const out: PickableElement[] = [];
  for (const bucket of Object.values(project.diagrams)) {
    if (!Array.isArray(bucket)) continue;
    for (const diagram of bucket) {
      if (excludeDiagramId && diagram.id === excludeDiagramId) continue;
      if (!isUMLModel(diagram.model)) continue;
      const elements = diagram.model.elements ?? {};
      for (const [id, el] of Object.entries(elements)) {
        if (wanted.has((el as { type: string }).type)) {
          out.push({ id, name: (el as { name?: string }).name ?? '', diagramTitle: diagram.title });
        }
      }
    }
  }
  return out;
}

/**
 * Host-side element-picker provider for the editor. Recomputed when the
 * project or active diagram changes; registered imperatively in
 * ApollonEditorComponent (mirrors the lineage provider).
 */
export function useElementPickerProvider(): ElementPickerProvider {
  const project = useAppSelector(selectProject);
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const activeId = activeDiagram?.id;
  return useMemo<ElementPickerProvider>(
    () => ({
      listElements: (typeTokens: string[]) => collectPickableElements(project, typeTokens, activeId),
    }),
    [project, activeId],
  );
}
