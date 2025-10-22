import { useCallback } from 'react';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { BACKEND_URL } from '../../constant';
import { uuid } from '../../utils/uuid';
import { Diagram } from '../diagram/diagramSlice';

/**
 * Custom hook for converting BUML files to diagram objects
 * Returns diagram data instead of directly creating diagrams in the store
 */
export const useBumlToDiagram = () => {
  
  const convertBumlToDiagram = useCallback(async (file: File): Promise<Diagram> => {
    const formData = new FormData();
    formData.append('buml_file', file);

    try {
      const response = await fetch(`${BACKEND_URL}/get-single-json-model`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
        console.error('Response not OK:', response.status, errorData);

        if (response.status === 400 && errorData.detail) {
          throw new Error(errorData.detail);
        }
        
        if (response.status === 500 && errorData.detail) {
          throw new Error(errorData.detail);
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle both single diagram and project responses
      let diagramData;
      let title;
      
      if (data.project) {
        // This is a project response - extract the first available diagram
        const projectData = data.project;
        
        if (projectData.ClassDiagram) {
          diagramData = projectData.ClassDiagram;
          title = diagramData.title || 'Imported Class Diagram';
        } else if (projectData.ObjectDiagram) {
          diagramData = projectData.ObjectDiagram;
          title = diagramData.title || 'Imported Object Diagram';
        } else if (projectData.StateMachineDiagram) {
          diagramData = projectData.StateMachineDiagram;
          title = diagramData.title || 'Imported State Machine Diagram';
        } else if (projectData.AgentDiagram) {
          diagramData = projectData.AgentDiagram;
          title = diagramData.title || 'Imported Agent Diagram';
        } else {
          throw new Error('No valid diagram found in the BUML file');
        }
      } else {
        // This is a direct diagram response (legacy format)
        diagramData = data;
        title = data.title || file.name.replace('.py', '');
      }

      // Determine diagram type
      let modelType: UMLDiagramType;
      const diagramType = diagramData.model?.type || diagramData.type;
      
      switch (diagramType) {
        case 'StateMachineDiagram':
          modelType = UMLDiagramType.StateMachineDiagram;
          break;
        case 'AgentDiagram':
          modelType = UMLDiagramType.AgentDiagram;
          break;
        case 'ObjectDiagram':
          modelType = UMLDiagramType.ObjectDiagram;
          break;
        case 'ClassDiagram':
        default:
          modelType = UMLDiagramType.ClassDiagram;
          break;
      }

      // Create the diagram object
      const diagram: Diagram = {
        id: uuid(),
        title: title,
        model: {
          ...diagramData.model,
          type: modelType
        },
        lastUpdate: new Date().toISOString(),
        description: `Imported from ${file.name}`
      };

      return diagram;

    } catch (error) {
      console.error('Error converting BUML to diagram:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      throw new Error(`Failed to import BUML file: ${errorMessage}`);
    }
  }, []);

  return convertBumlToDiagram;
};

/**
 * Utility function to check if a file is a BUML/Python file
 */
export const isBumlFile = (file: File): boolean => {
  return file.name.toLowerCase().endsWith('.py');
};

/**
 * Utility function to check if a file is a JSON file
 */
export const isJsonFile = (file: File): boolean => {
  return file.name.toLowerCase().endsWith('.json');
};
