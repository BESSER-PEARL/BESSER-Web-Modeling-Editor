import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import i18n from '../../shared/i18n';
import { useAppDispatch } from '../../app/store/hooks';
import { uuid } from '../../shared/utils/uuid';
import {
  ProjectDiagram,
  isUMLModel,
  isV3UMLModel,
  toSupportedDiagramType,
  MAX_DIAGRAMS_PER_TYPE,
} from '../../shared/types/project';
import { migrateUMLModelV3ToV4 } from '../../shared/services/storage/migrate-uml-v3-to-v4';
import { bumpEditorRevision, loadProjectThunk } from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { useNavigate } from 'react-router-dom';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { useBumlToDiagram, isBumlFile, isJsonFile, isBpmnXmlFile } from './useBumlToDiagram';
import { useImportBpmnXml } from './useImportBpmnXml';

/**
 * Detect v3-shape `{elements, relationships}` UMLModels
 * inside an imported `ProjectDiagram`, migrate them to v4 `{nodes, edges}`,
 * and surface a user-facing toast so the user knows the file was migrated.
 *
 * Returns the (possibly-migrated) diagram. Throws if the v3 detector fired
 * but the migrator threw — callers should let that bubble up so the import
 * is rejected with a clear error instead of silently corrupting data.
 *
 * Exported for unit-testing the v3 acceptance branch in isolation. It is a
 * plain function (not a hook), so it reads the shared i18n instance directly.
 */
export const maybeMigrateImportedDiagram = (diagram: ProjectDiagram): ProjectDiagram => {
  const model = diagram?.model;
  if (!model || !isV3UMLModel(model)) return diagram;

  // The wrapping ProjectDiagram doesn't carry a SupportedDiagramType tag —
  // migrateUMLModelV3ToV4 falls back to (model as any).type which v3
  // models always carry.
  const migratedModel = migrateUMLModelV3ToV4(model);
  toast.info(i18n.t('import.toasts.migratedFromV3'), {
    autoClose: 4000,
  });
  return { ...diagram, model: migratedModel };
};

/** Read a `File` as UTF-8 text via `FileReader` (rejects with a translated message). */
const readFileAsText = (file: File, readFailedMessage: string): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error(readFailedMessage));
    reader.readAsText(file);
  });

export const useImportDiagram = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convertBumlToDiagram = useBumlToDiagram();
  const convertBpmnXmlToDiagram = useImportBpmnXml();

  const importDiagram = useCallback(
    async (file: File) => {
      try {
        let diagram: ProjectDiagram;

        if (isBumlFile(file)) {
          // Handle Python/BUML file - convert to diagram
          diagram = await convertBumlToDiagram(file);
        } else if (isBpmnXmlFile(file)) {
          // Handle BPMN 2.0 XML file - parse to a v4 diagram (already v4-shape)
          diagram = await convertBpmnXmlToDiagram(file);
        } else if (isJsonFile(file)) {
          // Handle JSON file - parse directly
          const fileContent = await readFileAsText(file, t('import.errors.readFileFailed'));

          diagram = JSON.parse(fileContent);
          diagram.id = uuid();
        } else {
          throw new Error(t('import.errors.unsupportedFileTypeBpmn'));
        }

        // Accept legacy v3 single-file exports by
        // migrating them through the v3 → v4 shape converter before
        // validation. Without this, v3 JSON exports (elements/relationships
        // shape) are rejected with "Invalid diagram: missing model or
        // type information" because isUMLModel checks for the v4
        // nodes/edges arrays.
        diagram = maybeMigrateImportedDiagram(diagram);

        // Ensure the diagram has a valid model with type
        if (!isUMLModel(diagram.model)) {
          throw new Error(t('import.errors.invalidMissingType'));
        }

        dispatch(bumpEditorRevision());
        navigate('/', { relative: 'path' });
      } catch (error) {
        console.error('Error importing diagram:', error);

        let errorMessage = t('import.errors.unknownOccurred');
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        dispatch(displayError(t('import.errors.title'), t('import.errors.couldNotImportFile', { message: errorMessage })));
      }
    },
    [dispatch, navigate, convertBumlToDiagram, convertBpmnXmlToDiagram, t],
  );

  return importDiagram;
};

// Helper function to import a single diagram JSON and add it to the current project
export const useImportDiagramToProject = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const convertBumlToDiagram = useBumlToDiagram();
  const convertBpmnXmlToDiagram = useImportBpmnXml();

  const importDiagramToProject = useCallback(
    async (file: File) => {
      // Errors are NOT dispatched to errorManagementSlice here — the callers
      // (WorkspaceShell handlers, ProjectHubDialog) surface them via
      // react-toastify, and a duplicate persistent banner would be noise.
      let diagram: ProjectDiagram;

      if (isBumlFile(file)) {
        // Handle Python/BUML file - convert to diagram
        diagram = await convertBumlToDiagram(file);
      } else if (isBpmnXmlFile(file)) {
        // Handle BPMN 2.0 XML file - parse to a v4 diagram (already v4-shape)
        diagram = await convertBpmnXmlToDiagram(file);
      } else if (isJsonFile(file)) {
        // Handle JSON file - parse directly
        const fileContent = await readFileAsText(file, t('import.errors.readFileFailed'));

        diagram = JSON.parse(fileContent);
      } else {
        throw new Error(t('import.errors.unsupportedFileTypeBpmn'));
      }

      // Migrate v3-shape uploads before validation.
      diagram = maybeMigrateImportedDiagram(diagram);

      // Validate that it's a valid diagram
      if (!isUMLModel(diagram.model)) {
        throw new Error(t('import.errors.invalidFormat'));
      }

      // Get the current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error(t('import.errors.noProjectOpen'));
      }

      // Convert UMLDiagramType to SupportedDiagramType
      const diagramType = toSupportedDiagramType(diagram.model.type);

      // Generate new ID for the imported diagram to avoid conflicts
      const newId = uuid();
      const importedDiagram: ProjectDiagram = {
        ...diagram,
        id: newId,
        title: `${diagram.title}`,
        lastUpdate: new Date().toISOString(),
      };

      // Add the imported diagram as a new entry (never overwrite existing diagrams)
      const existingDiagrams = currentProject.diagrams[diagramType] ?? [];
      if (existingDiagrams.length >= MAX_DIAGRAMS_PER_TYPE) {
        throw new Error(t('import.errors.maxDiagramsReached', { max: MAX_DIAGRAMS_PER_TYPE, diagramType }));
      }
      const newDiagram = {
        id: newId,
        title: importedDiagram.title,
        model: importedDiagram.model,
        lastUpdate: importedDiagram.lastUpdate,
        description: importedDiagram.description || t('import.descriptions.imported', { diagramType }),
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

      return {
        success: true,
        diagramType,
        diagramTitle: importedDiagram.title,
        message: t('import.success.diagramImported', { diagramType, projectName: currentProject.name }),
      };
    },
    [dispatch, convertBumlToDiagram, convertBpmnXmlToDiagram, t],
  );

  return importDiagramToProject;
};

// Helper function to trigger file selection for importing diagrams to project
export function selectDiagramFileForProject(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.py,.bpmn,.xml'; // JSON, BUML (Python), and BPMN 2.0 XML
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

// File picker restricted to BPMN 2.0 XML files.
export function selectBpmnXmlFileForProject(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpmn,.xml'; // BPMN 2.0 XML only
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

      // Import the diagram to the project (JSON, Python/BUML, or BPMN 2.0 XML)
      const result = await importDiagramToProject(file);

      return result;
    } catch (error) {
      console.error('Failed to import diagram to project:', error);
      throw error;
    }
  }, [importDiagramToProject]);

  return handleImportDiagramToProject;
};

// Workflow scoped to BPMN diagrams: pick a .bpmn / .xml file and add it to the current project.
export const useImportBpmnDiagramToProjectWorkflow = () => {
  const importDiagramToProject = useImportDiagramToProject();

  const handleImportBpmnDiagramToProject = useCallback(async () => {
    try {
      // Select a BPMN 2.0 XML file
      const file = await selectBpmnXmlFileForProject();

      // Import the BPMN diagram to the project
      const result = await importDiagramToProject(file);

      return result;
    } catch (error) {
      console.error('Failed to import BPMN diagram to project:', error);
      throw error;
    }
  }, [importDiagramToProject]);

  return handleImportBpmnDiagramToProject;
};
