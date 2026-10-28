import { toast } from 'react-toastify';
import i18n from '../../i18n';
import {
  ALL_DIAGRAM_TYPES,
  BesserProject,
  DIAGRAM_KIND_BY_TYPE,
  ProjectDiagram,
  PROJECT_SCHEMA_VERSION,
  SupportedDiagramType,
  createDefaultPerspectives,
  createEmptyDiagram,
  ensureProjectMigrated,
  getActiveDiagram,
  isV3UMLModel,
  toSupportedDiagramType,
} from '../../types/project';
import { migrateUMLModelV3ToV4 } from '../storage/migrate-uml-v3-to-v4';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { LocalStorageRepository } from '../storage/local-storage-repository';
import {
  StoredAgentConfiguration,
  StoredAgentProfileConfigurationMapping,
  StoredUserProfile,
} from '../storage/local-storage-types';
import { BACKEND_URL } from '../../constants/constant';
import { UMLDiagramType, UMLModel, convertV3HandleToV4 } from '@besser/wme';

// The library's HandleId values (nodes/wrappers/DefaultNodeWrapper.tsx).
const V4_HANDLE_IDS = new Set(
  ['top', 'right', 'bottom', 'left'].flatMap((side) => {
    const across = side === 'top' || side === 'bottom' ? ['left', 'right'] : ['top', 'bottom'];
    return [side, ...across.flatMap((end) => [`${side}-${end}`, `${side}-mid-${end}`])];
  }),
);

/**
 * Backends before the handle fix emit v3 direction names ("Right", "Up") as
 * v4 edge handles; React Flow drops an edge whose handle does not exist.
 * Ids that are already valid, or have no v4 equivalent ("Center"), are kept.
 */
function normalizeEdgeHandles(project: BesserProject): void {
  for (const type of ALL_DIAGRAM_TYPES) {
    for (const diagram of project.diagrams[type] ?? []) {
      const edges = (diagram?.model as { edges?: unknown } | undefined)?.edges;
      if (!Array.isArray(edges)) continue;
      for (const edge of edges) {
        for (const key of ['sourceHandle', 'targetHandle'] as const) {
          const handle = edge?.[key];
          if (typeof handle !== 'string' || V4_HANDLE_IDS.has(handle)) continue;
          const mapped = convertV3HandleToV4(handle);
          if (V4_HANDLE_IDS.has(mapped)) edge[key] = mapped;
        }
      }
    }
  }
}

/** "Name", or "Name (2)", "Name (3)"... when a stored project already uses it. */
function uniqueProjectName(name: string): string {
  const taken = new Set(ProjectStorageRepository.getAllProjects().map((p) => (p.name ?? '').trim().toLowerCase()));
  if (!taken.has(name.trim().toLowerCase())) return name;
  const base = name.replace(/\s\(\d+\)$/, '');
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n += 1;
  return `${base} (${n})`;
}

// Interface for V2 JSON export format
interface V2ExportData {
  project: BesserProject;
  exportedAt: string;
  version: string;
  agentConfigurations?: StoredAgentConfiguration[];
  userProfiles?: StoredUserProfile[];
  agentProfileMappings?: StoredAgentProfileConfigurationMapping[];
  activeAgentConfigurationId?: string | null;
  agentBaseModels?: Record<string, UMLModel>;
}

// Interface for legacy import validation (V1 format)
interface LegacyImportData {
  project: BesserProject;
  diagrams: ProjectDiagram[];
  exportedAt?: string;
  version?: string;
}

// Validate V2 export format (now allows partial diagrams)
function validateV2ExportData(data: any): data is V2ExportData {
  return (
    data &&
    typeof data === 'object' &&
    data.project &&
    typeof data.project.id === 'string' &&
    typeof data.project.name === 'string' &&
    typeof data.project.diagrams === 'object' &&
    data.project.diagrams !== null
  );
}

// Check if this is an old webapp export (single diagrams instead of arrays, may have UserDiagram)
function isOldWebappFormat(data: any): boolean {
  if (!data?.project?.diagrams) return false;
  const diagrams = data.project.diagrams;
  // Old format: diagrams are plain objects, not arrays
  return Object.values(diagrams).some(
    (d: any) => d && typeof d === 'object' && !Array.isArray(d) && ('title' in d || 'model' in d || 'lastUpdate' in d),
  );
}

// Convert legacy single-diagram webapp format into the current per-project array format
function migrateOldWebappProject(data: any): BesserProject {
  const project = data.project;
  const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Lift legacy v3 UML models ({elements, relationships}) to v4 at import
  // time so the project is stored in its final shape (the load-time
  // `migrateProjectToV5` would also lift them, but only after storing). GUI
  // ({pages}) and quantum ({cols}) models fail isV3UMLModel and pass through
  // untouched. A model that cannot migrate stays v3 and is imported
  // read-only, like on a local load (`storeImportedProject` warns).
  let liftedV3Count = 0;
  const liftV3Model = (diagram: any, diagramType: SupportedDiagramType): void => {
    if (diagram && isV3UMLModel(diagram.model)) {
      try {
        diagram.model = migrateUMLModelV3ToV4(diagram.model, diagramType);
        liftedV3Count += 1;
      } catch (error) {
        console.warn(`[import] Diagram "${diagram.title}" (${diagramType}) stays v3 (read-only):`, error);
      }
    }
  };

  // Build diagram arrays from single diagram objects
  const migratedDiagrams: any = {};
  const allTypes: SupportedDiagramType[] = [
    'ClassDiagram',
    'ObjectDiagram',
    'StateMachineDiagram',
    'AgentDiagram',
    'NNDiagram',
    'ComponentDiagram',
    'DeploymentDiagram',
    'UserDiagram',
    'GUINoCodeDiagram',
    'QuantumCircuitDiagram',
    'BPMN',
  ];

  for (const diagramType of allTypes) {
    const existing = project.diagrams[diagramType];
    if (existing && !Array.isArray(existing) && typeof existing === 'object') {
      // Single diagram object → wrap in array
      if (!existing.id) existing.id = `${diagramType}_${Date.now()}`;
      if (!existing.lastUpdate) existing.lastUpdate = new Date().toISOString();
      liftV3Model(existing, diagramType);
      migratedDiagrams[diagramType] = [existing];
    } else if (Array.isArray(existing)) {
      // Mixed legacy files may carry arrays alongside single objects —
      // their entries need the same v3 → v4 lift.
      for (const d of existing) {
        liftV3Model(d, diagramType);
      }
      migratedDiagrams[diagramType] = existing;
    } else {
      migratedDiagrams[diagramType] = [
        createEmptyDiagram(
          diagramType.replace(/([A-Z])/g, ' $1').trim(),
          DIAGRAM_KIND_BY_TYPE[diagramType] ? null : ((UMLDiagramType as any)[diagramType] ?? null),
          DIAGRAM_KIND_BY_TYPE[diagramType],
        ),
      ];
    }
  }

  if (liftedV3Count > 0) {
    toast.info(i18n.t('import.toasts.migratedFromV3Many'), { autoClose: 4000 });
  }

  const currentDiagramIndices: Record<SupportedDiagramType, number> = {
    ClassDiagram: 0,
    ObjectDiagram: 0,
    StateMachineDiagram: 0,
    AgentDiagram: 0,
    ComponentDiagram: 0,
    DeploymentDiagram: 0,
    UserDiagram: 0,
    GUINoCodeDiagram: 0,
    QuantumCircuitDiagram: 0,
    NNDiagram: 0,
    BPMN: 0,
    KnowledgeGraphDiagram: 0,
  };

  return {
    id: newProjectId,
    type: 'Project',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: project.name || 'Imported Project',
    description: project.description || '',
    owner: project.owner || '',
    createdAt: new Date().toISOString(),
    currentDiagramType: (project.currentDiagramType as SupportedDiagramType) || 'ClassDiagram',
    currentDiagramIndices,
    diagrams: migratedDiagrams,
    settings: project.settings
      ? {
          defaultDiagramType: project.settings.defaultDiagramType ?? 'ClassDiagram',
          autoSave: project.settings.autoSave ?? true,
          collaborationEnabled: project.settings.collaborationEnabled ?? false,
          perspectives: project.settings.perspectives ?? createDefaultPerspectives(),
        }
      : {
          defaultDiagramType: 'ClassDiagram',
          autoSave: true,
          collaborationEnabled: false,
          perspectives: createDefaultPerspectives(),
        },
  };
}

// Fill missing diagrams with empty ones
function fillMissingDiagrams(project: BesserProject): BesserProject {
  const allDiagramTypes: SupportedDiagramType[] = [
    'ClassDiagram',
    'ObjectDiagram',
    'StateMachineDiagram',
    'AgentDiagram',
    'ComponentDiagram',
    'DeploymentDiagram',
    'NNDiagram',
    'UserDiagram',
    'GUINoCodeDiagram',
    'QuantumCircuitDiagram',
    'BPMN',
    'KnowledgeGraphDiagram',
  ];

  const diagramTypeToUMLType: Record<SupportedDiagramType, UMLDiagramType | null> = {
    ClassDiagram: UMLDiagramType.ClassDiagram,
    ObjectDiagram: UMLDiagramType.ObjectDiagram,
    StateMachineDiagram: UMLDiagramType.StateMachineDiagram,
    AgentDiagram: UMLDiagramType.AgentDiagram,
    ComponentDiagram: UMLDiagramType.ComponentDiagram,
    DeploymentDiagram: UMLDiagramType.DeploymentDiagram,
    NNDiagram: UMLDiagramType.NNDiagram,
    UserDiagram: UMLDiagramType.UserDiagram,
    GUINoCodeDiagram: null,
    KnowledgeGraphDiagram: null,
    QuantumCircuitDiagram: null,
    BPMN: UMLDiagramType.BPMN,
  };

  const diagramTitles: Record<SupportedDiagramType, string> = {
    ClassDiagram: 'Class Diagram',
    ObjectDiagram: 'Object Diagram',
    StateMachineDiagram: 'State Machine Diagram',
    AgentDiagram: 'Agent Diagram',
    ComponentDiagram: 'Component Diagram',
    DeploymentDiagram: 'Deployment Diagram',
    NNDiagram: 'NN Diagram',
    UserDiagram: 'User Diagram',
    GUINoCodeDiagram: 'GUI Diagram',
    QuantumCircuitDiagram: 'Quantum Circuit',
    BPMN: 'BPMN Diagram',
    KnowledgeGraphDiagram: 'Knowledge Graph',
  };

  // Ensure all diagram types exist as arrays
  allDiagramTypes.forEach((diagramType) => {
    const existing = project.diagrams[diagramType];
    if (!existing) {
      const umlType = diagramTypeToUMLType[diagramType];
      const title = diagramTitles[diagramType];
      (project.diagrams as any)[diagramType] = [createEmptyDiagram(title, umlType, DIAGRAM_KIND_BY_TYPE[diagramType])];
    } else if (!Array.isArray(existing)) {
      // Migrate single diagram to array
      (project.diagrams as any)[diagramType] = [existing];
    }
  });

  // Ensure currentDiagramIndices is always present so consumers can index safely
  const existingIndices = (project as any).currentDiagramIndices ?? {};
  const indices = allDiagramTypes.reduce((acc, diagramType) => {
    acc[diagramType] = typeof existingIndices[diagramType] === 'number' ? existingIndices[diagramType] : 0;
    return acc;
  }, {} as Record<SupportedDiagramType, number>);
  (project as any).currentDiagramIndices = indices;

  return project;
}

// Validate legacy import data structure (V1 format)
function validateLegacyImportData(data: any): data is LegacyImportData {
  return (
    data &&
    typeof data === 'object' &&
    data.project &&
    Array.isArray(data.diagrams) &&
    typeof data.project.id === 'string' &&
    typeof data.project.name === 'string'
  );
}

// Convert legacy format (with separate diagrams array) to new project format
function convertLegacyToProject(data: LegacyImportData): BesserProject {
  const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    ...data.project,
    id: newProjectId,
    name: `${data.project.name}`,
    createdAt: new Date().toISOString(),
  };
}

// Check if GUI model is empty
function isGUIModelEmpty(guiModel: any): boolean {
  if (!guiModel) return true;

  // Check if it's a GrapesJS model structure
  if (guiModel.pages !== undefined) {
    // Empty if no pages
    if (!guiModel.pages) {
      return true;
    }

    // Handle pages as array (expected format)
    if (Array.isArray(guiModel.pages)) {
      if (guiModel.pages.length === 0) {
        return true;
      }

      // Check if all pages are empty (have no frames or only empty frames)
      for (const page of guiModel.pages) {
        if (!page.frames || page.frames.length === 0) {
          continue; // This page is empty, check next
        }

        // Check if any frame has components
        for (const frame of page.frames) {
          if (frame.component && frame.component.components && frame.component.components.length > 0) {
            return false; // Found a frame with components, not empty
          }
        }
      }

      // All pages checked and none have components
      return true;
    }

    // Handle pages as object (legacy/invalid format) - check if empty object
    if (typeof guiModel.pages === 'object') {
      return Object.keys(guiModel.pages).length === 0;
    }
  }

  return false;
}

interface ImportedPersonalization {
  agentConfigurations?: StoredAgentConfiguration[];
  userProfiles?: StoredUserProfile[];
  agentProfileMappings?: StoredAgentProfileConfigurationMapping[];
  activeAgentConfigurationId?: string | null;
  agentBaseModels?: Record<string, UMLModel>;
}

// Store imported project using the project storage system
/**
 * Migrate an imported project to the current schema (v3 models lifted to v4)
 * and store it; returns the stored project. Only a model that cannot migrate
 * is kept as v3 (read-only); no pre-migration backup is taken of a file the
 * user still has.
 */
function storeImportedProject(imported: BesserProject, personalization?: ImportedPersonalization): BesserProject {
  const project = ensureProjectMigrated(imported);
  // Like a local load: a v3 diagram that cannot migrate is kept and opens
  // read-only (editor and save thunk guard it); the user is told which one.
  const unconverted = ALL_DIAGRAM_TYPES.flatMap((type) =>
    (project.diagrams[type] ?? []).filter((d) => d && isV3UMLModel(d.model)),
  );
  project.name = uniqueProjectName(project.name);
  normalizeEdgeHandles(project);

  // Check if the imported GUI model is empty
  const importedGUIDiagram = getActiveDiagram(project, 'GUINoCodeDiagram');
  const importedGUIModel = importedGUIDiagram?.model;

  if (isGUIModelEmpty(importedGUIModel)) {
    // Try to get the current project's GUI model
    const currentProject = ProjectStorageRepository.getCurrentProject();

    if (currentProject) {
      const existingGUIDiagram = getActiveDiagram(currentProject, 'GUINoCodeDiagram');
      if (existingGUIDiagram?.model && !isGUIModelEmpty(existingGUIDiagram.model)) {
        console.log('Imported GUI model is empty, keeping existing GUI model');
        const guiIndex = project.currentDiagramIndices?.GUINoCodeDiagram ?? 0;
        if (project.diagrams.GUINoCodeDiagram[guiIndex]) {
          project.diagrams.GUINoCodeDiagram[guiIndex] = {
            ...project.diagrams.GUINoCodeDiagram[guiIndex],
            model: existingGUIDiagram.model,
            lastUpdate: existingGUIDiagram.lastUpdate,
          };
        }
      }
    }
  }

  ProjectStorageRepository.saveProject(project);
  for (const d of unconverted) {
    toast.warning(i18n.t('import.warnings.diagramReadOnly', { title: d.title }), {
      toastId: `import-v3-${d.id}`,
    });
  }

  if (personalization) {
    LocalStorageRepository.mergeImportedPersonalization(personalization);
  }
  return project;
}

function extractPersonalization(data: V2ExportData): ImportedPersonalization | undefined {
  const has =
    (Array.isArray(data.agentConfigurations) && data.agentConfigurations.length > 0) ||
    (Array.isArray(data.userProfiles) && data.userProfiles.length > 0) ||
    (Array.isArray(data.agentProfileMappings) && data.agentProfileMappings.length > 0) ||
    (data.agentBaseModels && Object.keys(data.agentBaseModels).length > 0) ||
    !!data.activeAgentConfigurationId;
  if (!has) return undefined;
  return {
    agentConfigurations: data.agentConfigurations,
    userProfiles: data.userProfiles,
    agentProfileMappings: data.agentProfileMappings,
    activeAgentConfigurationId: data.activeAgentConfigurationId,
    agentBaseModels: data.agentBaseModels,
  };
}

// Import from BUML (.py)
export async function importProjectFromBUML(file: File): Promise<BesserProject> {
  const formData = new FormData();
  formData.append('buml_file', file);

  const response = await fetch(`${BACKEND_URL}/get-project-json-model`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Import failed with status ${response.status}`);
  }

  const jsonData = await response.json();

  if (isOldWebappFormat(jsonData)) {
    return storeImportedProject(migrateOldWebappProject(jsonData));
  } else if (validateV2ExportData(jsonData)) {
    const project = fillMissingDiagrams({
      ...jsonData.project,
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${jsonData.project.name}`,
      createdAt: new Date().toISOString(),
    });
    return storeImportedProject(project, extractPersonalization(jsonData));
  } else if (validateLegacyImportData(jsonData)) {
    return storeImportedProject(fillMissingDiagrams(convertLegacyToProject(jsonData)));
  } else {
    throw new Error('Invalid BUML file structure');
  }
}

const UNSUPPORTED_STRUCTURE = 'Invalid project file format - unsupported structure';

// Import from JSON file
export async function importProjectFromJson(file: File): Promise<BesserProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);

        // Check for old webapp format (single diagrams, not arrays) before V2 check
        if (isOldWebappFormat(jsonData)) {
          const importedProject = storeImportedProject(migrateOldWebappProject(jsonData));
          console.log(`Project "${importedProject.name}" imported successfully (old webapp format migrated)`);
          resolve(importedProject);
        } else if (validateV2ExportData(jsonData)) {
          // V2 format - project already contains diagrams
          const project = jsonData.project;

          // Generate new ID for the project to avoid conflicts
          const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const importedProject = storeImportedProject(
            fillMissingDiagrams({
              ...project,
              id: newProjectId,
              name: `${project.name}`,
              createdAt: new Date().toISOString(),
            }),
            extractPersonalization(jsonData),
          );

          console.log(`Project "${importedProject.name}" imported successfully (V2 format)`);
          resolve(importedProject);
        } else if (validateLegacyImportData(jsonData)) {
          // Legacy V1 format - convert to new format and store
          const convertedProject = storeImportedProject(fillMissingDiagrams(convertLegacyToProject(jsonData)));

          console.log(`Project "${convertedProject.name}" imported successfully (Legacy format converted)`);
          resolve(convertedProject);
        } else if (jsonData && jsonData.model && typeof jsonData.model === 'object' && jsonData.model.type) {
          // Raw single-diagram JSON (e.g., exported from old editor as bare diagram).
          // Legacy: pre-`BPMNDiagram` BPMN files used `type: 'BPMN'` — normalize.
          const rawType = (jsonData.model.type as string) || UMLDiagramType.ClassDiagram;
          const wireType = rawType === 'BPMN' ? UMLDiagramType.BPMN : rawType;
          // Map wire type → SupportedDiagramType (bucket key). Unknown types fall
          // back to ClassDiagram; the previous `in UMLDiagramType` check tested
          // *keys* and incorrectly missed entries where key ≠ value (BPMN).
          const knownWireType = (Object.values(UMLDiagramType) as string[]).includes(wireType);
          const supportedType: SupportedDiagramType = knownWireType
            ? toSupportedDiagramType(wireType as UMLDiagramType)
            : 'ClassDiagram';
          const newProjectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Bare v3 exports are lifted to v4 before being stored, like
          // `migrateOldWebappProject` does. v4 bare diagrams pass through
          // untouched. A migrator throw propagates to the catch below so the
          // import is rejected instead of stored broken.
          let bareModel = jsonData.model;
          if (isV3UMLModel(bareModel)) {
            bareModel = migrateUMLModelV3ToV4(bareModel, supportedType);
            toast.info(i18n.t('import.toasts.migratedFromV3'), { autoClose: 4000 });
          }
          if (knownWireType && bareModel && typeof bareModel === 'object' && bareModel.type !== wireType) {
            // Stamp the canonical wire value (only differs for legacy 'BPMN').
            bareModel = { ...bareModel, type: wireType };
          }

          const diagramTypeToUMLType: Record<SupportedDiagramType, UMLDiagramType | null> = {
            ClassDiagram: UMLDiagramType.ClassDiagram,
            ObjectDiagram: UMLDiagramType.ObjectDiagram,
            StateMachineDiagram: UMLDiagramType.StateMachineDiagram,
            AgentDiagram: UMLDiagramType.AgentDiagram,
              ComponentDiagram: UMLDiagramType.ComponentDiagram,
              DeploymentDiagram: UMLDiagramType.DeploymentDiagram,
            UserDiagram: UMLDiagramType.UserDiagram,
            GUINoCodeDiagram: null,
            QuantumCircuitDiagram: null,
            NNDiagram: UMLDiagramType.NNDiagram,
            BPMN: UMLDiagramType.BPMN,
            KnowledgeGraphDiagram: null,
          };
          const diagramTitles: Record<SupportedDiagramType, string> = {
            ClassDiagram: 'Class Diagram',
            ObjectDiagram: 'Object Diagram',
            StateMachineDiagram: 'State Machine Diagram',
            AgentDiagram: 'Agent Diagram',
            ComponentDiagram: 'Component Diagram',
            DeploymentDiagram: 'Deployment Diagram',
            UserDiagram: 'User Diagram',
            GUINoCodeDiagram: 'GUI Diagram',
            QuantumCircuitDiagram: 'Quantum Circuit',
            NNDiagram: 'NN Diagram',
            BPMN: 'BPMN Diagram',
            KnowledgeGraphDiagram: 'Knowledge Graph',
          };

          // ALL_DIAGRAM_TYPES (incl. BPMN) — the prior local list silently
          // dropped BPMN, which produced a project without a BPMN bucket and
          // failed isProject() validation on the next load.
          const diagrams: any = {};
          for (const t of ALL_DIAGRAM_TYPES) {
            if (t === supportedType) {
              diagrams[t] = [
                {
                  id: jsonData.id || `${t}_${Date.now()}`,
                  title: jsonData.title || diagramTitles[t],
                  model: bareModel,
                  lastUpdate: jsonData.lastUpdate || new Date().toISOString(),
                },
              ];
            } else {
              diagrams[t] = [createEmptyDiagram(diagramTitles[t], diagramTypeToUMLType[t], DIAGRAM_KIND_BY_TYPE[t])];
            }
          }

          const rawProject: BesserProject = {
            id: newProjectId,
            type: 'Project',
            schemaVersion: PROJECT_SCHEMA_VERSION,
            name: jsonData.title || 'Imported Diagram',
            description: '',
            owner: '',
            createdAt: new Date().toISOString(),
            currentDiagramType: supportedType,
            currentDiagramIndices: {
              ClassDiagram: 0,
              ObjectDiagram: 0,
              StateMachineDiagram: 0,
              AgentDiagram: 0,
              ComponentDiagram: 0,
              DeploymentDiagram: 0,
              UserDiagram: 0,
              GUINoCodeDiagram: 0,
              QuantumCircuitDiagram: 0,
              NNDiagram: 0,
              BPMN: 0,
              KnowledgeGraphDiagram: 0,
            },
            diagrams,
            settings: {
              defaultDiagramType: 'ClassDiagram',
              autoSave: true,
              collaborationEnabled: false,
              perspectives: createDefaultPerspectives(),
            },
          };

          const importedProject = storeImportedProject(rawProject);
          console.log(`Project "${importedProject.name}" imported successfully (raw diagram format)`);
          resolve(importedProject);
        } else {
          throw new Error(UNSUPPORTED_STRUCTURE);
        }
      } catch (error) {
        // The user gets one sentence; the parser / converter detail stays here.
        console.error('JSON import failed:', error);
        const key =
          error instanceof SyntaxError
            ? 'import.errors.invalidJson'
            : error instanceof Error && error.message === UNSUPPORTED_STRUCTURE
              ? 'import.errors.unsupportedProjectFile'
              : 'import.errors.projectUnreadable';
        reject(new Error(i18n.t(key)));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

// Main import function that handles JSON, ZIP, and BUML files
export async function importProject(file: File): Promise<BesserProject> {
  const fileExtension = file.name.toLowerCase().split('.').pop();

  switch (fileExtension) {
    case 'json':
      return await importProjectFromJson(file);
    case 'py':
      return await importProjectFromBUML(file);
    default:
      throw new Error('Unsupported file format. Please select a .json or .py file.');
  }
}

// Helper function to trigger file selection for JSON/ZIP
export function selectImportFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.py';
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

// Helper function to trigger file selection for BUML
export function selectBUMLFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py';
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

// Helper function to trigger file selection for any supported format
export function selectProjectFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,.py';
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

// Complete import workflow for JSON/ZIP
export async function handleImportProject(): Promise<BesserProject> {
  try {
    const file = await selectImportFile();
    const importedProject = await importProject(file);

    // Trigger a storage event to update UI
    window.dispatchEvent(new Event('storage'));

    return importedProject;
  } catch (error) {
    console.error('Import process failed:', error);
    throw error;
  }
}

// Complete import workflow for BUML
export async function handleImportBUML(): Promise<BesserProject> {
  try {
    const file = await selectBUMLFile();
    const importedProject = await importProject(file);
    window.dispatchEvent(new Event('storage'));
    return importedProject;
  } catch (error) {
    console.error('BUML import failed:', error);
    throw error;
  }
}

// Complete import workflow for any supported format
export async function handleImportAny(): Promise<BesserProject> {
  try {
    const file = await selectProjectFile();
    const importedProject = await importProject(file);

    // Trigger a storage event to update UI
    window.dispatchEvent(new Event('storage'));

    return importedProject;
  } catch (error) {
    console.error('Import process failed:', error);
    throw error;
  }
}
