// Import diagram from kg using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { BACKEND_URL } from '../../constant';
import { useAppDispatch } from '../../components/store/hooks';
import { uuid } from '../../utils/uuid';
import { Diagram, loadImportedDiagram } from '../diagram/diagramSlice';
import { displayError } from '../error-management/errorManagementSlice';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { toSupportedDiagramType } from '../../types/project';
import { useBumlToDiagram } from './useBumlToDiagram';



// Helper function to import a single diagram JSON and add it to the current project
// Hook to import diagram from kg file and API key
export const useImportDiagramFromKG = () => {
  const dispatch = useAppDispatch();
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
        const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));
        const errorMsg = errorData.detail || `HTTP error! status: ${response.status}`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      // Should be a diagram JSON
      if (!data || !data.model || !data.model.type) {
        throw new Error('Invalid diagram returned from backend');
      }

      // Add to current project
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
        description: data.description || `Imported ${diagramType} diagram from kg`,
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
        dispatch(loadImportedDiagram(importedDiagram));
      }
      return {
        success: true,
        diagramType,
        diagramTitle: importedDiagram.title,
        message: `${diagramType} diagram imported successfully from kg and added to project "${currentProject.name}".`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
      dispatch(displayError('Import failed', `Could not import diagram from kg: ${errorMessage}`));
      throw error;
    }
  }, [dispatch, convertBumlToDiagram]);

  return importDiagramFromKG;
};


