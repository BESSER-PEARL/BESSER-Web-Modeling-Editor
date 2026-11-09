import { useCallback } from 'react';
import { getJsonModel } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { uuid } from '../../shared/utils/uuid';
import {
  ProjectDiagram,
  isUMLModel,
  isV3UMLModel,
  toSupportedDiagramType,
  toUMLDiagramType,
} from '../../shared/types/project';
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
      // It may still be a v3 model, which callers migrate (see below).
      if (!isUMLModel(data.model) && !isV3UMLModel(data.model)) {
        throw new Error('Invalid diagram: missing model or type information');
      }
      const title = data.title || file.name.replace('.py', '');

      // Keep the model's own type when a project slot holds it; anything else
      // (GUI, quantum, KG...) cannot be placed as an Apollon diagram.
      const modelType = (data.model as { type: string }).type;
      if (toUMLDiagramType(toSupportedDiagramType(modelType)) !== modelType) {
        throw new Error(`Unsupported diagram type for a B-UML diagram import: ${modelType}`);
      }

      // Create the diagram object. The backend may still answer with a v3
      // `{elements, relationships}` model — callers run the result through
      // `maybeMigrateImportedDiagram` before validating it as v4.
      const diagram: ProjectDiagram = {
        id: uuid(),
        title: title,
        model: data.model,
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
 * Accepts .bpmn, .bpmn.xml, and raw .xml (the content sniff in
 * `bpmnXmlToModel` rejects non-BPMN .xml files cleanly).
 */
export const isBpmnXmlFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith('.bpmn') || name.endsWith('.bpmn.xml') || name.endsWith('.xml');
};
