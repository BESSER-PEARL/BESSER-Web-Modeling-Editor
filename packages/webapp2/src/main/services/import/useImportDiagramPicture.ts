// Import diagram from image using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { BACKEND_URL } from '../../constant';
import { useAppDispatch } from '../../store/hooks';
import { uuid } from '../../utils/uuid';
import { displayError } from '../error-management/errorManagementSlice';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { toSupportedDiagramType } from '../../types/project';
import { loadProjectThunk } from '../workspace/workspaceSlice';

// Hook to import diagram from image file and API key
export const useImportDiagramPictureFromImage = () => {
  const dispatch = useAppDispatch();

  const importDiagramFromImage = useCallback(async (file: File, apiKey: string) => {
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('api_key', apiKey);

      const response = await fetch(`${BACKEND_URL}/get-json-model-from-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));
        const errorMsg = errorData.detail || `HTTP error! status: ${response.status}`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data || !data.model || !data.model.type) {
        throw new Error('Invalid diagram returned from backend');
      }

      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project is currently open. Please create or open a project first.');
      }

      const diagramType = toSupportedDiagramType(data.model.type);
      const newId = uuid();
      const importedDiagram = {
        ...data,
        id: newId,
        title: data.title || file.name,
        lastUpdate: new Date().toISOString(),
        description: data.description || `Imported ${diagramType} diagram from image`,
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
        message: `${diagramType} diagram imported successfully from image and added to project "${currentProject.name}".`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
      dispatch(displayError('Import failed', `Could not import diagram from image: ${errorMessage}`));
      throw error;
    }
  }, [dispatch]);

  return importDiagramFromImage;
};
