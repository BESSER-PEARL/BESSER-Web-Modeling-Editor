// Import diagram from KG using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { uuid } from '../../shared/utils/uuid';
import { bumpEditorRevision } from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { toSupportedDiagramType } from '../../shared/types/project';
import { useBumlToDiagram } from './useBumlToDiagram';



// Helper function to import a single diagram JSON and add it to the current project
// Hook to import diagram from kg file and API key
export const useImportDiagramFromKG = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const convertBumlToDiagram = useBumlToDiagram();

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
      // Should be a diagram JSON
      if (!data || !data.model || !data.model.type) {
        throw new Error(t('import.errors.invalidFromBackend'));
      }

      // Add to current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error(t('import.errors.noProjectOpen'));
      }
      const diagramType = toSupportedDiagramType(data.model.type);
      const newId = uuid();
      const importedDiagram = {
        ...data,
        id: newId,
        title: data.title || file.name,
        lastUpdate: new Date().toISOString(),
        description: data.description || t('import.descriptions.importedFromKg', { diagramType }),
      };
      const updatedProject = {
        ...currentProject,
        diagrams: {
          ...currentProject.diagrams,
          [diagramType]: {
            id: newId,
            title: importedDiagram.title,
            model: importedDiagram.model,
            lastUpdate: importedDiagram.lastUpdate,
            description: importedDiagram.description,
          }
        }
      };
      ProjectStorageRepository.saveProject(updatedProject);
      if (diagramType === currentProject.currentDiagramType) {
        dispatch(bumpEditorRevision());
      }
      return {
        success: true,
        diagramType,
        diagramTitle: importedDiagram.title,
        message: t('import.success.kg', { diagramType, projectName: currentProject.name })
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('import.errors.unknownDuringImport');
      dispatch(displayError(t('import.errors.title'), t('import.errors.couldNotImportFromKg', { message: errorMessage })));
      throw error;
    }
  }, [dispatch, convertBumlToDiagram, t]);

  return importDiagramFromKG;
};


