// Import diagram from image using backend API
import { reportError } from '../../shared/services/errors/reportError';
import { useCallback } from 'react';
import type { UMLDiagramType } from '@besser/wme';
import { useTranslation } from 'react-i18next';
import { getJsonModelFromImage } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { useAppDispatch } from '../../app/store/hooks';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { loadProjectThunk } from '../../app/store/workspaceSlice';
import { toSupportedDiagramType } from '../../shared/types/project';
import { applyImportedDiagramToProject } from './applyImportedDiagram';

// Hook to import diagram from image file and API key
export const useImportDiagramPictureFromImage = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const importDiagramFromImage = useCallback(async (file: File, apiKey: string) => {
    try {
      // If the active ClassDiagram already has elements, send it so the backend
      // merges the image into it instead of replacing.
      const currentForMerge = ProjectStorageRepository.getCurrentProject();
      const classDiagramsForMerge = currentForMerge?.diagrams?.['ClassDiagram'] ?? [];
      const classActiveIndex = currentForMerge?.currentDiagramIndices?.['ClassDiagram'] ?? 0;
      const activeClassDiagram = classDiagramsForMerge[
        Math.min(classActiveIndex, Math.max(classDiagramsForMerge.length - 1, 0))
      ];
      const activeClassNodes = (activeClassDiagram as any)?.model?.nodes;
      const existingModel =
        Array.isArray(activeClassNodes) && activeClassNodes.length > 0
          ? { title: activeClassDiagram.title, model: (activeClassDiagram as any).model }
          : undefined;

      let data;
      try {
        data = await getJsonModelFromImage(file, apiKey, existingModel);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        const errorMsg = error.detail || `HTTP error! status: ${error.status}`;
        reportError(errorMsg);
        throw new Error(errorMsg);
      }
      // Should be a diagram JSON (v3 or v4 — both carry model.type); the
      // import helper lifts a v3 payload and validates the v4 shape.
      if (!data || !data.model || !data.model.type) {
        throw new Error(t('import.errors.invalidFromBackend'));
      }

      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error(t('import.errors.noProjectOpen'));
      }

      // Enforce v4 shape on the backend's response (lifting v3 payloads
      // first) and replace the active diagram in the array, preserving the
      // ProjectDiagram[] array structure. A partial / malformed LLM
      // response is rejected with a toast instead of an empty canvas. The
      // description default is translated here so the helper stays
      // locale-agnostic.
      const { project: updatedProject, diagramType, diagramTitle } = applyImportedDiagramToProject(
        currentProject,
        {
          ...data,
          description:
            (data as { description?: string }).description ||
            t('import.descriptions.importedFromImage', { diagramType: toSupportedDiagramType(data.model.type as UMLDiagramType) }),
        },
        {
          fallbackTitle: file.name,
          source: 'image',
        },
      );

      // Save to localStorage and reload the project into Redux to keep them in sync
      ProjectStorageRepository.saveProject(updatedProject);
      await dispatch(loadProjectThunk(currentProject.id));

      return {
        success: true,
        diagramType,
        diagramTitle,
        message: t('import.success.image', { diagramType, projectName: currentProject.name }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('import.errors.unknownDuringImport');
      dispatch(displayError(t('import.errors.title'), t('import.errors.couldNotImportFromImage', { message: errorMessage })));
      throw error;
    }
  }, [dispatch, t]);

  return importDiagramFromImage;
};
