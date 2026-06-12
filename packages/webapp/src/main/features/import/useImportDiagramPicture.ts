// Import diagram from image using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { loadProjectThunk } from '../../app/store/workspaceSlice';
import { applyImportedDiagramToProject } from './applyImportedDiagram';

// Hook to import diagram from image file and API key
export const useImportDiagramPictureFromImage = () => {
  const dispatch = useAppDispatch();

  const importDiagramFromImage = useCallback(async (file: File, apiKey: string) => {
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('api_key', apiKey);

      // If the active ClassDiagram already has elements, send it so the backend
      // merges the image into it instead of replacing.
      const currentForMerge = ProjectStorageRepository.getCurrentProject();
      const classDiagramsForMerge = currentForMerge?.diagrams?.['ClassDiagram'] ?? [];
      const classActiveIndex = currentForMerge?.currentDiagramIndices?.['ClassDiagram'] ?? 0;
      const activeClassDiagram = classDiagramsForMerge[
        Math.min(classActiveIndex, Math.max(classDiagramsForMerge.length - 1, 0))
      ];
      const activeClassNodes = (activeClassDiagram as any)?.model?.nodes;
      if (Array.isArray(activeClassNodes) && activeClassNodes.length > 0) {
        formData.append('existing_model', JSON.stringify({
          title: activeClassDiagram.title,
          model: (activeClassDiagram as any).model,
        }));
      }

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
      if (!data || !data.model) {
        throw new Error('Invalid diagram returned from backend');
      }

      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project is currently open. Please create or open a project first.');
      }

      // Enforce v4 shape on the backend's response (lifting v3 payloads
      // first) and replace the active diagram in the array, preserving the
      // ProjectDiagram[] array structure. A partial / malformed LLM
      // response is rejected with a toast instead of an empty canvas.
      const { project: updatedProject, diagramType, diagramTitle } = applyImportedDiagramToProject(
        currentProject,
        data,
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
