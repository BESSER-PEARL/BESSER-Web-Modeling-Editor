import { useCallback } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { getJsonModel } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { uuid } from '../../shared/utils/uuid';
import { ProjectDiagram, isUMLModel } from '../../shared/types/project';
import { reportImportRepairs } from '../../shared/services/project-import/reportImportRepairs';

/**
 * Custom hook for converting BUML files to diagram objects
 * Returns diagram data instead of directly creating diagrams in the store
 */
export const useBumlToDiagram = () => {
  const convertBumlToDiagram = useCallback(async (file: File): Promise<ProjectDiagram> => {
    try {
      let data;
      try {
        data = await getJsonModel(file);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        console.error('Response not OK:', error.status, error.message);
        throw new Error(
          error.detail && (error.status === 400 || error.status === 500)
            ? error.detail
            : `HTTP error! status: ${error.status}`,
        );
      }
      reportImportRepairs(data.warnings);

      // The backend answers one diagram; for a project file, its active (or first non-empty) one.
      if (!isUMLModel(data.model)) {
        throw new Error('Invalid diagram: missing model or type information');
      }
      const title = data.title || file.name.replace('.py', '');

      // Determine diagram type
      let modelType: UMLDiagramType;
      switch (data.model.type) {
        case 'StateMachineDiagram':
          modelType = UMLDiagramType.StateMachineDiagram;
          break;
        case 'AgentDiagram':
          modelType = UMLDiagramType.AgentDiagram;
          break;
        case 'ObjectDiagram':
          modelType = UMLDiagramType.ObjectDiagram;
          break;
        case 'BPMNDiagram':
          modelType = UMLDiagramType.BPMN;
          break;
        case 'ClassDiagram':
        default:
          modelType = UMLDiagramType.ClassDiagram;
          break;
      }

      // Create the diagram object
      const diagram: ProjectDiagram = {
        id: uuid(),
        title: title,
        model: {
          ...data.model,
          type: modelType,
        },
        lastUpdate: new Date().toISOString(),
        description: `Imported from ${file.name}`,
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

/**
 * Utility function to check if a file is a BPMN 2.0 XML file.
 * Accepts .bpmn, .bpmn.xml, and raw .xml (content-sniff in bpmnXmlToApollon
 * rejects non-BPMN .xml files cleanly).
 */
export const isBpmnXmlFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith('.bpmn') || name.endsWith('.bpmn.xml') || name.endsWith('.xml');
};
