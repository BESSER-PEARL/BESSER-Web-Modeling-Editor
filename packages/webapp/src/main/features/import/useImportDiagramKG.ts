// Import diagram from KG using backend API
import { reportError } from '../../shared/services/errors/reportError';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getJsonModelFromKg } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { useAppDispatch } from '../../app/store/hooks';
import { uuid } from '../../shared/utils/uuid';
import { bumpEditorRevision } from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { isUMLModel, toSupportedDiagramType } from '../../shared/types/project';
import { useBumlToDiagram } from './useBumlToDiagram';



// Helper function to import a single diagram JSON and add it to the current project
// Hook to import diagram from kg file and API key
export const useImportDiagramFromKG = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const convertBumlToDiagram = useBumlToDiagram();

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
      // Should be a diagram JSON
      if (!isUMLModel(data.model)) {
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
        description: t('import.descriptions.importedFromKg', { diagramType }),
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


