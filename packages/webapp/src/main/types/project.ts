import { UMLDiagramType, UMLModel } from '@besser/wme';
// Supported diagram types in projects
export type SupportedDiagramType = 'ClassDiagram' | 'ObjectDiagram' | 'StateMachineDiagram' | 'AgentDiagram' | 'GUINoCodeDiagram' | 'QuantumCircuitDiagram';

// GrapesJS project data structure
export interface GrapesJSProjectData {
  pages: any[];
  styles: any[];
  assets: any[];
  symbols: any[];
  version: string;
}

// Quantum Circuit data structure 
export interface QuantumCircuitData {
  cols: any[][]; // Each column is an array where 1 = empty, strings = gate symbols
  gates: any[]; // Custom gates (optional)
  gateMetadata?: Record<string, any>; // Metadata for gates with nested circuits, custom labels, etc.
  initialStates?: string[]; // Initial qubit states
  version?: string;
}

// Diagram structure within a project
export interface ProjectDiagram {
  id: string;
  title: string;
  model?: UMLModel | GrapesJSProjectData | QuantumCircuitData;
  lastUpdate: string;
  description?: string;
}

export type ProjectDiagramModel = UMLModel | GrapesJSProjectData;

// New centralized project structure
export interface BesserProject {
  id: string;
  type: 'Project';
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  currentDiagramType: SupportedDiagramType; // Which diagram is currently active
  diagrams: {
    ClassDiagram: ProjectDiagram;
    ObjectDiagram: ProjectDiagram;
    StateMachineDiagram: ProjectDiagram;
    AgentDiagram: ProjectDiagram;
    GUINoCodeDiagram: ProjectDiagram;
    QuantumCircuitDiagram: ProjectDiagram;
  };
  settings: {
    defaultDiagramType: SupportedDiagramType;
    autoSave: boolean;
    collaborationEnabled: boolean;
  };
}

// Helper to convert UMLDiagramType to SupportedDiagramType
export const toSupportedDiagramType = (type: UMLDiagramType): SupportedDiagramType => {
  switch (type) {
    case UMLDiagramType.ClassDiagram:
      return 'ClassDiagram';
    case UMLDiagramType.ObjectDiagram:
      return 'ObjectDiagram';
    case UMLDiagramType.StateMachineDiagram:
      return 'StateMachineDiagram';
    case UMLDiagramType.AgentDiagram:
      return 'AgentDiagram';
    default:
      return 'ClassDiagram'; // fallback
  }
};

// Helper to convert SupportedDiagramType to UMLDiagramType
export const toUMLDiagramType = (type: SupportedDiagramType): UMLDiagramType | null => {
  switch (type) {
    case 'ClassDiagram':
      return UMLDiagramType.ClassDiagram;
    case 'ObjectDiagram':
      return UMLDiagramType.ObjectDiagram;
    case 'StateMachineDiagram':
      return UMLDiagramType.StateMachineDiagram;
    case 'AgentDiagram':
      return UMLDiagramType.AgentDiagram;
    case 'GUINoCodeDiagram':
      return null; // GUINoCodeDiagram doesn't have a UML diagram type
    case 'QuantumCircuitDiagram':
      return null; // QuantumCircuitDiagram doesn't have a UML diagram type
    default:
      return null;
  }
};

// Default diagram factory
export const createEmptyDiagram = (title: string, type: UMLDiagramType | null, diagramKind?: 'gui' | 'quantum'): ProjectDiagram => {
  // For Quantum Circuit diagram
  if (diagramKind === 'quantum') {
    return {
      id: crypto.randomUUID(),
      title,
      model: {
        cols: [],
        gates: [],
        gateMetadata: {},
        initialStates: [],
        version: '1.0.0'
      } as QuantumCircuitData,
      lastUpdate: new Date().toISOString(),
    };
  }

  // For GUI/No-Code diagram
  if (type === null || diagramKind === 'gui') {
    // ========================================
    // 🎨 EMPTY GUI DIAGRAM
    // ========================================
    // The GUI diagram starts with one empty page - users can drag blocks from Templates category
    return {
      id: crypto.randomUUID(),
      title,
      model: {
        pages: [
          {
            name: 'Home',
            frames: [
              {
                component: {
                  type: 'wrapper',
                  stylable: [
                    'background',
                    'background-color',
                    'background-image',
                    'background-repeat',
                    'background-attachment',
                    'background-position',
                    'background-size'
                  ],
                  components: [],
                  head: { type: 'head' },
                  docEl: { tagName: 'html' }
                }
              }
            ]
          }
        ],
        styles: [],
        assets: [],
        symbols: [],
        version: '0.21.13'
      } as GrapesJSProjectData,
      lastUpdate: new Date().toISOString(),
    };
  }

  // For UML diagrams
  return {
    id: crypto.randomUUID(),
    title,
    model: {
      version: '3.0.0' as const,
      type,
      size: { width: 1400, height: 740 },
      elements: {},
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    },
    lastUpdate: new Date().toISOString(),
  };
};

// Factory to create default GUI template (used on first editor load)
// Returns a minimal structure with one empty page - users can drag the "Full Home Page" block from Templates category
export const createDefaultGUITemplate = (): GrapesJSProjectData => {
  return {
    pages: [
      {
        name: 'Home',
        frames: [
          {
            component: {
              type: 'wrapper',
              stylable: [
                'background',
                'background-color',
                'background-image',
                'background-repeat',
                'background-attachment',
                'background-position',
                'background-size'
              ],
              components: [],
              head: { type: 'head' },
              docEl: { tagName: 'html' }
            }
          }
        ]
      }
    ],
    styles: [],
    assets: [],
    symbols: [],
    version: '0.21.13'
  };
};

// Default project factory
export const createDefaultProject = (
  name: string,
  description: string,
  owner: string
): BesserProject => {
  const projectId = crypto.randomUUID();

  return {
    id: projectId,
    type: 'Project',
    name,
    description,
    owner,
    createdAt: new Date().toISOString(),
    currentDiagramType: 'ClassDiagram',
    diagrams: {
      ClassDiagram: createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram),
      ObjectDiagram: createEmptyDiagram('Object Diagram', UMLDiagramType.ObjectDiagram),
      StateMachineDiagram: createEmptyDiagram('State Machine Diagram', UMLDiagramType.StateMachineDiagram),
      AgentDiagram: createEmptyDiagram('Agent Diagram', UMLDiagramType.AgentDiagram),
      GUINoCodeDiagram: createEmptyDiagram('GUI Diagram', null, 'gui'),
      QuantumCircuitDiagram: createEmptyDiagram('Quantum Circuit', null, 'quantum'),
    },
    settings: {
      defaultDiagramType: 'ClassDiagram',
      autoSave: true,
      collaborationEnabled: false,
    },
  };
};

// Type guards
export const isProject = (obj: any): obj is BesserProject => {
  if (!obj || typeof obj !== 'object' || obj.type !== 'Project') {
    return false;
  }

  if (!obj.diagrams || typeof obj.diagrams !== 'object' || !obj.currentDiagramType) {
    return false;
  }

  // Check for required diagram types (QuantumCircuitDiagram is optional for backward compatibility)
  const hasRequiredDiagrams =
    obj.diagrams.ClassDiagram &&
    obj.diagrams.ObjectDiagram &&
    obj.diagrams.StateMachineDiagram &&
    obj.diagrams.AgentDiagram &&
    obj.diagrams.GUINoCodeDiagram;

  if (!hasRequiredDiagrams) {
    return false;
  }

  // Add QuantumCircuitDiagram if missing (for backward compatibility with older projects)
  if (!obj.diagrams.QuantumCircuitDiagram) {
    obj.diagrams.QuantumCircuitDiagram = createEmptyDiagram('Quantum Circuit', null, 'quantum');
  }

  return true;
};

export const isUMLModel = (model: unknown): model is UMLModel => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as Partial<UMLModel>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.version === 'string' &&
    typeof candidate.elements === 'object' &&
    typeof candidate.relationships === 'object'
  );
};

export const isGrapesJSProjectData = (model: unknown): model is GrapesJSProjectData => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as any;
  // More lenient check - only require at least one of the expected properties to exist
  return (
    candidate.pages !== undefined ||
    candidate.styles !== undefined ||
    candidate.assets !== undefined ||
    candidate.symbols !== undefined ||
    (candidate.version !== undefined && !candidate.qubitCount)
  );
};

export const isQuantumCircuitData = (model: unknown): model is QuantumCircuitData => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as any;
  return Array.isArray(candidate.cols);
};


// Normalize any data to valid GrapesJS format
export const normalizeToGrapesJSProjectData = (data: unknown): GrapesJSProjectData => {
  const candidate = (data && typeof data === 'object') ? data as any : {};

  return {
    pages: Array.isArray(candidate.pages) ? candidate.pages : [],
    styles: Array.isArray(candidate.styles) ? candidate.styles : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    symbols: Array.isArray(candidate.symbols) ? candidate.symbols : [],
    version: typeof candidate.version === 'string' ? candidate.version : '0.21.13'
  };
};
