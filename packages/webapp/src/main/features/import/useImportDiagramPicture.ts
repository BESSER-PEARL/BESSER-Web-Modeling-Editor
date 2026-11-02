// Import diagram from image using backend API
import { reportError } from '../../shared/services/errors/reportError';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getJsonModelFromImage } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { useAppDispatch } from '../../app/store/hooks';
import { uuid } from '../../shared/utils/uuid';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { toSupportedDiagramType } from '../../shared/types/project';
import { loadProjectThunk } from '../../app/store/workspaceSlice';

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
      const activeClassElements = (activeClassDiagram as any)?.model?.elements;
      const existingModel =
        activeClassElements && Object.keys(activeClassElements).length > 0
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
      if (!data || !data.model || !data.model.type) {
        throw new Error(t('import.errors.invalidFromBackend'));
      }

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
        description: data.description || t('import.descriptions.importedFromImage', { diagramType }),
      };

      // Update the active diagram in the array (preserving the array structure)
      const existingDiagrams = currentProject.diagrams[diagramType] ?? [];
      const activeIndex = currentProject.currentDiagramIndices?.[diagramType] ?? 0;
      const updatedDiagrams = [...existingDiagrams];
      const newDiagram = {
        id: newId,
        title: importedDiagram.title,
        model: importedDiagram.model,
        lastUpdate: importedDiagram.lastUpdate,
        description: importedDiagram.description,
      };

      if (updatedDiagrams.length === 0) {
        updatedDiagrams.push(newDiagram);
      } else {
        updatedDiagrams[Math.min(activeIndex, updatedDiagrams.length - 1)] = newDiagram;
      }

      const updatedProject = {
        ...currentProject,
        diagrams: {
          ...currentProject.diagrams,
          [diagramType]: updatedDiagrams,
        }
      };

      // Save to localStorage and reload the project into Redux to keep them in sync
      ProjectStorageRepository.saveProject(updatedProject);
      await dispatch(loadProjectThunk(currentProject.id));

      return {
        success: true,
        diagramType,
        diagramTitle: importedDiagram.title,
        message: t('import.success.image', { diagramType, projectName: currentProject.name })
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('import.errors.unknownDuringImport');
      dispatch(displayError(t('import.errors.title'), t('import.errors.couldNotImportFromImage', { message: errorMessage })));
      throw error;
    }
  }, [dispatch, t]);

  return importDiagramFromImage;
};
