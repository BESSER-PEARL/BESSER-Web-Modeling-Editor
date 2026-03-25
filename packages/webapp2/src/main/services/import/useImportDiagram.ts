import { useCallback } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { uuid } from '../../utils/uuid';
import { ProjectDiagram, isUMLModel, toSupportedDiagramType, MAX_DIAGRAMS_PER_TYPE } from '../../types/project';
import { bumpEditorRevision, loadProjectThunk } from '../../store/workspaceSlice';
import { displayError } from '../../store/errorManagementSlice';
import { useNavigate } from 'react-router-dom';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { useBumlToDiagram, isBumlFile, isJsonFile } from './useBumlToDiagram';

export const useImportDiagram = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const convertBumlToDiagram = useBumlToDiagram();
  
  const importDiagram = useCallback(async (file: File) => {
    try {
      let diagram: ProjectDiagram;

      if (isBumlFile(file)) {
        // Handle Python/BUML file - convert to diagram
        diagram = await convertBumlToDiagram(file);

      } else if (isJsonFile(file)) {
        // Handle JSON file - parse directly
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
        
        diagram = JSON.parse(fileContent);
        diagram.id = uuid();
      } else {
        throw new Error('Unsupported file type. Please select a .json or .py file.');
      }

      // Ensure the diagram has a valid model with type
      if (!isUMLModel(diagram.model)) {
        throw new Error('Invalid diagram: missing model or type information');
      }

      dispatch(bumpEditorRevision());
      navigate('/', { relative: 'path' });
      
    } catch (error) {
      console.error('Error importing diagram:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      dispatch(
        displayError('Import failed', `Could not import selected file: ${errorMessage}`)
      );
    }
  }, [dispatch, navigate, convertBumlToDiagram]);

  return importDiagram;
};

// Helper function to import a single diagram JSON and add it to the current project
export const useImportDiagramToProject = () => {
  const dispatch = useAppDispatch();
  const convertBumlToDiagram = useBumlToDiagram();
  
  const importDiagramToProject = useCallback(async (file: File) => {
    try {
      let diagram: ProjectDiagram;

      if (isBumlFile(file)) {
        // Handle Python/BUML file - convert to diagram
        diagram = await convertBumlToDiagram(file);
      } else if (isJsonFile(file)) {
        // Handle JSON file - parse directly
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
        
        diagram = JSON.parse(fileContent);
      } else {
        throw new Error('Unsupported file type. Please select a .json or .py file.');
      }
      
      // Validate that it's a valid diagram
      if (!isUMLModel(diagram.model)) {
        throw new Error('Invalid diagram format: missing model or type');
      }

      // Get the current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project is currently open. Please create or open a project first.');
      }

      // Convert UMLDiagramType to SupportedDiagramType
      const diagramType = toSupportedDiagramType(diagram.model.type);
      
      // Generate new ID for the imported diagram to avoid conflicts
      const newId = uuid();
      const importedDiagram: ProjectDiagram = {
        ...diagram,
        id: newId,
        title: `${diagram.title}`,
        lastUpdate: new Date().toISOString()
      };

      // Add the imported diagram as a new entry (never overwrite existing diagrams)
      const existingDiagrams = currentProject.diagrams[diagramType] ?? [];
      if (existingDiagrams.length >= MAX_DIAGRAMS_PER_TYPE) {
        throw new Error(`Cannot import: maximum of ${MAX_DIAGRAMS_PER_TYPE} ${diagramType} diagrams per project has been reached.`);
      }
      const newDiagram = {
        id: newId,
        title: importedDiagram.title,
        model: importedDiagram.model,
        lastUpdate: importedDiagram.lastUpdate,
        description: importedDiagram.description || `Imported ${diagramType} diagram`
      };

      const updatedDiagrams = [...existingDiagrams, newDiagram];
      const newIndex = updatedDiagrams.length - 1;

      const updatedProject = {
        ...currentProject,
        diagrams: {
          ...currentProject.diagrams,
          [diagramType]: updatedDiagrams,
        },
        currentDiagramIndices: {
          ...currentProject.currentDiagramIndices,
          [diagramType]: newIndex,
        },
      };

      // Save to localStorage and reload the project into Redux to keep them in sync
      ProjectStorageRepository.saveProject(updatedProject);
      await dispatch(loadProjectThunk(currentProject.id));

      // If importing a Class Diagram, update the diagram bridge for Object Diagram compatibility
      if (diagramType === 'ClassDiagram' && isUMLModel(importedDiagram.model)) {
        try {
          const { diagramBridge } = await import('@besser/wme');
          diagramBridge.setClassDiagramData(importedDiagram.model);
        } catch {
          /* bridge not available */
        }
      }

      const fileType = isBumlFile(file) ? 'Python/BUML' : 'JSON';
      return {
        success: true,
        diagramType,
        diagramTitle: importedDiagram.title,
        message: `${diagramType} diagram imported successfully and added to project "${currentProject.name}". This diagram has been converted from ${fileType} format to the new project format.`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
      dispatch(
        displayError('Import failed', `Could not import diagram: ${errorMessage}`)
      );
      throw error;
    }
  }, [dispatch, convertBumlToDiagram]);

  return importDiagramToProject;
};

// Helper function to trigger file selection for importing diagrams to project
export function selectDiagramFileForProject(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.py'; // Accept both JSON and Python files
    input.multiple = false;
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };
    
    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };
    
    input.click();
  });
}

// Complete workflow function for importing a diagram to the current project
export const useImportDiagramToProjectWorkflow = () => {
  const importDiagramToProject = useImportDiagramToProject();
  
  const handleImportDiagramToProject = useCallback(async () => {
    try {
      // Select the file
      const file = await selectDiagramFileForProject();
      
      // Import the diagram to the project (now handles both JSON and Python files)
      const result = await importDiagramToProject(file);
      
      return result;
    } catch (error) {
      console.error('Failed to import diagram to project:', error);
      throw error;
    }
  }, [importDiagramToProject]);
  
  return handleImportDiagramToProject;
};
