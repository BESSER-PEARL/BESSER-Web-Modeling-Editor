// Convert a Knowledge Graph diagram into a Class or Object Diagram via the
// backend's deterministic /kg-to-class-diagram and /kg-to-object-diagram
// endpoints, then open the result in a new tab in the current project.
//
// Triggered from the Generate menu when in a KnowledgeGraphDiagram context.
import { useCallback } from 'react';
import { toast } from 'react-toastify';

import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import {
  addDiagramThunk,
  switchDiagramIndexThunk,
  switchDiagramTypeThunk,
} from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject, SupportedDiagramType } from '../../shared/types/project';

type KgConversionTarget = 'kg_to_class' | 'kg_to_object';

const ENDPOINT_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: '/kg-to-class-diagram',
  kg_to_object: '/kg-to-object-diagram',
};

const DIAGRAM_TYPE_BY_TARGET: Record<KgConversionTarget, SupportedDiagramType> = {
  kg_to_class: 'ClassDiagram',
  kg_to_object: 'ObjectDiagram',
};

const TITLE_SUFFIX_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: 'Class Diagram',
  kg_to_object: 'Object Diagram',
};

/**
 * Surface unique warning codes from the backend response as toast warnings,
 * one per code, so users see anomalies (UNDECLARED_CLASS, BLANK_SKIPPED, …)
 * without being spammed when many edges trigger the same code.
 */
function reportWarnings(warnings: unknown): void {
  if (!Array.isArray(warnings)) return;
  const seen = new Set<string>();
  for (const warning of warnings as Array<Record<string, unknown>>) {
    const code = typeof warning?.code === 'string' ? warning.code : '';
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const message = typeof warning?.message === 'string' ? warning.message : code;
    toast.warn(message, { toastId: `kg-conv-${code}` });
  }
}

export const useKgToUmlConversion = () => {
  const dispatch = useAppDispatch();

  return useCallback(
    async (target: KgConversionTarget): Promise<void> => {
      const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
      if (!project) {
        toast.error('Open a project before converting.');
        return;
      }

      const kgDiagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
      if (!kgDiagram || !kgDiagram.model) {
        toast.error('No active Knowledge Graph diagram to convert.');
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}${ENDPOINT_BY_TARGET[target]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: kgDiagram.id,
            title: kgDiagram.title,
            model: kgDiagram.model,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data?.model || !data?.diagramType) {
          throw new Error('Invalid response from KG conversion endpoint.');
        }

        reportWarnings(data.warnings);

        const targetType = DIAGRAM_TYPE_BY_TARGET[target];
        const baseTitle = kgDiagram.title || project.name || 'KG';
        const newTitle = `${baseTitle} (${TITLE_SUFFIX_BY_TARGET[target]})`;

        const addResult = await dispatch(
          addDiagramThunk({ diagramType: targetType, title: newTitle }),
        ).unwrap();

        ProjectStorageRepository.updateDiagram(
          project.id,
          targetType,
          {
            ...addResult.diagram,
            model: data.model,
            lastUpdate: new Date().toISOString(),
          },
          addResult.index,
        );

        await dispatch(switchDiagramTypeThunk({ diagramType: targetType }));
        await dispatch(switchDiagramIndexThunk({ diagramType: targetType, index: addResult.index }));

        toast.success(`Generated ${TITLE_SUFFIX_BY_TARGET[target]} from Knowledge Graph.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'KG conversion failed.';
        dispatch(displayError('KG → UML conversion failed', message));
        toast.error(message);
      }
    },
    [dispatch],
  );
};
