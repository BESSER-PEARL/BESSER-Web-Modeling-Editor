import { ModelingPerspective } from '@besser/wme';
import type { SupportedDiagramType } from './types/project';

/**
 * Frontend-side definition of a modeling perspective.
 *
 * Each perspective declares the diagram types relevant to that kind of
 * project. A diagram is visible in the sidebar / mobile nav / command
 * palette whenever at least one **enabled** perspective lists it — so
 * perspectives may freely share entries (e.g. ClassDiagram appears in
 * `dataModeling`, `database`, `webApplication`, and `stateMachine`;
 * AgentDiagram appears in `agent`, `webApplication`, and `userModeling`).
 *
 * Generators are intentionally **not** filtered by perspective. The
 * Generate menu only narrows entries by the currently active diagram
 * type — once a user is on a given diagram, all of its supported
 * generators stay reachable regardless of perspective settings.
 */
export interface PerspectiveDefinition {
  key: ModelingPerspective;
  label: string;
  description: string;
  diagrams: SupportedDiagramType[];
}

/**
 * The perspectives users can toggle. Order is the order shown in settings.
 */
export const PERSPECTIVES: PerspectiveDefinition[] = [
  {
    key: 'dataModeling',
    label: 'Data Modeling',
    description: 'Model your domain with class and object diagrams (Python, Java, Pydantic, JSON Schema, Smart Data Models)',
    diagrams: ['ClassDiagram', 'ObjectDiagram'],
  },
  {
    key: 'database',
    label: 'Database Modeling',
    description: 'Class diagrams for SQL DDL and SQLAlchemy schema generation',
    diagrams: ['ClassDiagram'],
  },
  {
    key: 'webApplication',
    label: 'Web Applications',
    description: 'Class diagrams plus a no-code GUI and an optional agent for full-stack web apps (Django, FastAPI, React)',
    diagrams: ['ClassDiagram', 'GUINoCodeDiagram', 'AgentDiagram'],
  },
  {
    key: 'agent',
    label: 'Agent Modeling',
    description: 'Design conversational agents (BESSER Agent Framework)',
    diagrams: ['AgentDiagram'],
  },
  {
    key: 'stateMachine',
    label: 'State Machines',
    description: 'Model behaviour as state machines used inside class methods',
    diagrams: ['ClassDiagram', 'StateMachineDiagram'],
  },
  {
    key: 'userModeling',
    label: 'User Modeling',
    description: 'User diagrams plus agents for educational/learner scenarios',
    diagrams: ['UserDiagram', 'AgentDiagram'],
  },
  {
    key: 'quantum',
    label: 'Quantum Computing',
    description: 'Quantum circuits for Qiskit code generation',
    diagrams: ['QuantumCircuitDiagram'],
  },
];

/**
 * Whether a diagram type is currently visible: any **enabled** perspective
 * lists it.
 */
export function isDiagramVisible(
  type: SupportedDiagramType,
  enabled: Partial<Record<ModelingPerspective, boolean>>,
): boolean {
  return PERSPECTIVES.some(
    (p) => enabled[p.key] !== false && p.diagrams.includes(type),
  );
}
