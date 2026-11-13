// Import diagram from KG using backend API
import { reportError } from '../../shared/services/errors/reportError';
import { useCallback } from 'react';
import type { UMLDiagramType } from '@besser/wme';
import { useTranslation } from 'react-i18next';
import { getJsonModelFromKg } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { useAppDispatch } from '../../app/store/hooks';
import { displayError } from '../../app/store/errorManagementSlice';
import { loadProjectThunk } from '../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { toSupportedDiagramType } from '../../shared/types/project';
import { applyImportedDiagramToProject } from './applyImportedDiagram';

// Hook to import diagram from kg file and API key
export const useImportDiagramFromKG = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const importDiagramFromKG = useCallback(async (file: File, apiKey: string) => {
    try {
      let data;
      try {
        data = await getJsonModelFromKg(file, apiKey);
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

      // Add to current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error(t('import.errors.noProjectOpen'));
      }

      // Validates the model (v4 shape, lifting v3 payloads first) and
      // replaces the active diagram of that type while preserving the
      // ProjectDiagram[] array invariant. The description default is
      // translated here so the helper stays locale-agnostic.
      const { project: updatedProject, diagramType, diagramTitle } = applyImportedDiagramToProject(
        currentProject,
        {
          ...data,
          description:
            (data as { description?: string }).description ||
            t('import.descriptions.importedFromKg', { diagramType: toSupportedDiagramType(data.model.type as UMLDiagramType) }),
        },
        {
          fallbackTitle: file.name,
          source: 'Knowledge Graph',
        },
      );

      // Save to localStorage and reload the project into Redux to keep them in sync
      ProjectStorageRepository.saveProject(updatedProject);
      await dispatch(loadProjectThunk(currentProject.id));

      return {
        success: true,
        diagramType,
        diagramTitle,
        message: t('import.success.kg', { diagramType, projectName: currentProject.name }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('import.errors.unknownDuringImport');
      dispatch(displayError(t('import.errors.title'), t('import.errors.couldNotImportFromKg', { message: errorMessage })));
      throw error;
    }
  }, [dispatch, t]);

  return importDiagramFromKG;
};
