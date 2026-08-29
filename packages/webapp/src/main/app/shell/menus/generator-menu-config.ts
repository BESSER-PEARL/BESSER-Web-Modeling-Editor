import type { GeneratorMenuMode, GeneratorType } from '../workspace-types';

export interface GeneratorMenuAction {
  kind: 'action';
  label: string;
  /** Optional i18n key; falls back to `label` (e.g. product/format names stay in English). */
  labelKey?: string;
  generator: GeneratorType;
  config?: Record<string, any>;
}

export interface GeneratorMenuGroup {
  kind: 'group';
  label: string;
  /** Optional i18n key; falls back to `label` (e.g. product names stay in English). */
  labelKey?: string;
  actions: GeneratorMenuAction[];
}

export interface GeneratorMenuNotice {
  kind: 'notice';
  label: string;
  /** Optional i18n key; falls back to `label`. */
  labelKey?: string;
}

export type GeneratorMenuEntry = GeneratorMenuAction | GeneratorMenuGroup | GeneratorMenuNotice;

const CLASS_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'group',
    label: 'Web',
    labelKey: 'menu.generate.groups.web',
    actions: [
      { kind: 'action', label: 'Django Project', labelKey: 'menu.generate.actions.djangoProject', generator: 'django' },
      { kind: 'action', label: 'Full Backend', labelKey: 'menu.generate.actions.fullBackend', generator: 'backend' },
      {
        kind: 'action',
        label: 'Web Application',
        labelKey: 'menu.generate.actions.webApplication',
        generator: 'web_app',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Database',
    labelKey: 'menu.generate.groups.database',
    actions: [
      { kind: 'action', label: 'SQL DDL', generator: 'sql' },
      { kind: 'action', label: 'Supabase', generator: 'supabase' },
      { kind: 'action', label: 'SQLAlchemy DDL', generator: 'sqlalchemy' },
    ],
  },
  {
    kind: 'group',
    label: 'OOP',
    labelKey: 'menu.generate.groups.oop',
    actions: [
      { kind: 'action', label: 'Python Classes', labelKey: 'menu.generate.actions.pythonClasses', generator: 'python' },
      { kind: 'action', label: 'Java Classes', labelKey: 'menu.generate.actions.javaClasses', generator: 'java' },
    ],
  },
  {
    kind: 'group',
    label: 'Testing',
    actions: [
      { kind: 'action', label: 'Python Test Cases', generator: 'test_case' },
    ],
  },
  {
    kind: 'group',
    label: 'Schema',
    labelKey: 'menu.generate.groups.schema',
    actions: [
      {
        kind: 'action',
        label: 'Pydantic Models',
        labelKey: 'menu.generate.actions.pydanticModels',
        generator: 'pydantic',
      },
      { kind: 'action', label: 'JSON Schema', generator: 'jsonschema' },
      { kind: 'action', label: 'Smart Data Models', generator: 'smartdata' },
    ],
  },
  {
    kind: 'group',
    label: 'Formal Notations',
    labelKey: 'menu.generate.groups.formalNotations',
    actions: [
      {
        kind: 'action',
        label: 'Alloy Specification',
        labelKey: 'menu.generate.actions.alloySpecification',
        generator: 'alloy',
      },
    ],
  },
];

const AGENT_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'BESSER Agent', labelKey: 'menu.generate.actions.besserAgent', generator: 'agent' },
];

const GUI_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'Web Application', labelKey: 'menu.generate.actions.webApplication', generator: 'web_app' },
];

const OBJECT_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'group',
    label: 'Data',
    labelKey: 'menu.generate.groups.data',
    actions: [
      {
        kind: 'action',
        label: 'JSON Object Export',
        labelKey: 'menu.generate.actions.jsonObjectExport',
        generator: 'jsonobject',
      },
    ],
  },
];

const USER_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'group',
    label: 'Data',
    labelKey: 'menu.generate.groups.data',
    actions: [
      {
        kind: 'action',
        label: 'User Profile JSON',
        labelKey: 'menu.generate.actions.userProfileJson',
        generator: 'jsonobject',
      },
    ],
  },
];

const STATEMACHINE_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'notice',
    label: 'State machines are used as method implementations in Class Diagrams. Generate code from the Class Diagram.',
    labelKey: 'menu.generate.notices.statemachine',
  },
];

const QUANTUM_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'Qiskit Code', labelKey: 'menu.generate.actions.qiskitCode', generator: 'qiskit' },
];

const BPMN_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'action', label: 'BPMN 2.0 XML', generator: 'bpmn' },
];

const NN_GENERATORS: GeneratorMenuEntry[] = [
  {
    kind: 'group',
    label: 'PyTorch',
    actions: [
      { kind: 'action', label: 'Subclassing', generator: 'pytorch', config: { generation_type: 'subclassing' } },
      { kind: 'action', label: 'Sequential', generator: 'pytorch', config: { generation_type: 'sequential' } },
    ],
  },
  {
    kind: 'group',
    label: 'TensorFlow',
    actions: [
      { kind: 'action', label: 'Subclassing', generator: 'tensorflow', config: { generation_type: 'subclassing' } },
      { kind: 'action', label: 'Sequential', generator: 'tensorflow', config: { generation_type: 'sequential' } },
    ],
  },
];

const UNAVAILABLE_GENERATORS: GeneratorMenuEntry[] = [
  { kind: 'notice', label: 'Not yet available for this diagram', labelKey: 'menu.generate.notices.unavailable' },
];

export const GENERATOR_MENU_CONFIG: Record<GeneratorMenuMode, GeneratorMenuEntry[]> = {
  class: CLASS_GENERATORS,
  object: OBJECT_GENERATORS,
  user: USER_GENERATORS,
  statemachine: STATEMACHINE_GENERATORS,
  agent: AGENT_GENERATORS,
  gui: GUI_GENERATORS,
  quantum: QUANTUM_GENERATORS,
  nn: NN_GENERATORS,
  bpmn: BPMN_GENERATORS,
  none: UNAVAILABLE_GENERATORS,
};
