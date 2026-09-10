// Import diagram from KG using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BACKEND_URL } from '../../shared/constants/constant';
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
      const formData = new FormData();
      formData.append('kg_file', file);
      formData.append('api_key', apiKey);

      // Call backend endpoint
      const response = await fetch(`${BACKEND_URL}/get-json-model-from-kg`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: t('import.errors.couldNotParseError') }));
        const errorMsg = errorData.detail || `HTTP error! status: ${response.status}`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      // Should be a diagram JSON (v3 or v4 — both carry model.type)
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
            data.description ||
            t('import.descriptions.importedFromKg', { diagramType: toSupportedDiagramType(data.model.type) }),
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
