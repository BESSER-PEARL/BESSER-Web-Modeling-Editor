import type { GeneratorMenuMode, GeneratorType } from '../workspace-types';

export interface GeneratorMenuAction {
  kind: 'action';
  label: string;
  generator: GeneratorType;
}

export interface GeneratorMenuGroup {
  kind: 'group';
  label: string;
  actions: GeneratorMenuAction[];
}

export interface GeneratorMenuNotice {
  kind: 'notice';
  label: string;
}

export type GeneratorMenuEntry = GeneratorMenuAction | GeneratorMenuGroup | GeneratorMenuNotice;

const CLASS_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'group',
    label: 'Platform',
    actions: [
      { kind: 'action', label: 'Instance Editor Platform', generator: 'platform' },
    ],
  },
  {
    kind: 'group',
    label: 'Web',
    actions: [
      { kind: 'action', label: 'Django Project', generator: 'django' },
      { kind: 'action', label: 'Full Backend', generator: 'backend' },
      { kind: 'action', label: 'Web Application', generator: 'web_app' },
    ],
  },
  {
    kind: 'group',
    label: 'Database',
    actions: [
      { kind: 'action', label: 'SQL DDL', generator: 'sql' },
      { kind: 'action', label: 'SQLAlchemy DDL', generator: 'sqlalchemy' },
    ],
  },
  {
    kind: 'group',
    label: 'OOP',
    actions: [
      { kind: 'action', label: 'Python Classes', generator: 'python' },
      { kind: 'action', label: 'Java Classes', generator: 'java' },
    ],
  },
  {
    kind: 'group',
    label: 'Schema',
    actions: [
      { kind: 'action', label: 'Pydantic Models', generator: 'pydantic' },
      { kind: 'action', label: 'JSON Schema', generator: 'jsonschema' },
      { kind: 'action', label: 'Smart Data Models', generator: 'smartdata' },
    ],
  },
];

const AGENT_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'BESSER Agent', generator: 'agent' },
];

const GUI_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'Web Application', generator: 'web_app' },
];

const OBJECT_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'group',
    label: 'Data',
    actions: [
      { kind: 'action', label: 'JSON Object Export', generator: 'jsonobject' },
    ],
  },
];

const STATEMACHINE_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'notice', label: 'State machines are used as method implementations in Class Diagrams. Generate code from the Class Diagram.' },
];

const QUANTUM_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'Qiskit Code', generator: 'qiskit' },
];

const UNAVAILABLE_GENERATORS: GeneratorMenuEntry[] = [{ kind: 'notice', label: 'Not yet available for this diagram' }];

export const GENERATOR_MENU_CONFIG: Record<GeneratorMenuMode, GeneratorMenuEntry[]> = {
  class: CLASS_GENERATORS,
  object: OBJECT_GENERATORS,
  statemachine: STATEMACHINE_GENERATORS,
  agent: AGENT_GENERATORS,
  gui: GUI_GENERATORS,
  quantum: QUANTUM_GENERATORS,
  none: UNAVAILABLE_GENERATORS,
};
