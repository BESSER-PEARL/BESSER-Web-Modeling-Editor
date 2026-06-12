// Import diagram from KG using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { displayError } from '../../app/store/errorManagementSlice';
import { loadProjectThunk } from '../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { applyImportedDiagramToProject } from './applyImportedDiagram';

// Hook to import diagram from kg file and API key
export const useImportDiagramFromKG = () => {
  const dispatch = useAppDispatch();

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
        const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));
        const errorMsg = errorData.detail || `HTTP error! status: ${response.status}`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      // Should be a diagram JSON
      if (!data || !data.model) {
        throw new Error('Invalid diagram returned from backend');
      }

      // Add to current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project is currently open. Please create or open a project first.');
      }

      // Validates the model (v4 shape, lifting v3 payloads first) and
      // replaces the active diagram of that type while preserving the
      // ProjectDiagram[] array invariant.
      const { project: updatedProject, diagramType, diagramTitle } = applyImportedDiagramToProject(
        currentProject,
        data,
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
        message: `${diagramType} diagram imported successfully from Knowledge Graph and added to project "${currentProject.name}".`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
      dispatch(displayError('Import failed', `Could not import diagram from Knowledge Graph: ${errorMessage}`));
      throw error;
    }
  }, [dispatch]);

  return importDiagramFromKG;
};
