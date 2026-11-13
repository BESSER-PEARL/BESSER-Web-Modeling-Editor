import { useMemo } from 'react';
import { convertV3NodeTypeToV4, type ElementPickerProvider, type PickableElement } from '@besser/wme';
import { useAppSelector } from '../../app/store/hooks';
import { selectProject, selectActiveDiagram } from '../../app/store/workspaceSlice';
import { BesserProject, isUMLModel } from '../../shared/types/project';

/**
 * Pure enumerator: every node of the given `typeTokens` across all diagrams
 * of `project` except `excludeDiagramId`. The tokens are v4 node types
 * (`class`, `component`); a v3 element name (`Class`, `AbstractClass`, ...)
 * is mapped to its node type. Exported for unit tests.
 */
export function collectPickableElements(
  project: BesserProject | null,
  typeTokens: string[],
  excludeDiagramId?: string,
): PickableElement[] {
  if (!project) return [];
  const wanted = new Set(typeTokens.map(convertV3NodeTypeToV4));
  const out: PickableElement[] = [];
  for (const bucket of Object.values(project.diagrams)) {
    if (!Array.isArray(bucket)) continue;
    for (const diagram of bucket) {
      if (excludeDiagramId && diagram.id === excludeDiagramId) continue;
      if (!isUMLModel(diagram.model)) continue;
      for (const node of diagram.model.nodes) {
        if (wanted.has(node.type)) {
          const name = node.data?.name;
          out.push({ id: node.id, name: typeof name === 'string' ? name : '', diagramTitle: diagram.title });
        }
      }
    }
  }
  return out;
}

/**
 * Host-side element-picker provider for the editor. Recomputed when the
 * project or active diagram changes; registered imperatively in
 * BesserEditorComponent (mirrors the lineage provider).
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
