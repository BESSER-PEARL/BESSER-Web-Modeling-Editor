import { SupportedDiagramType } from '../types/project';

export const PERSPECTIVE_LABELS: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Class Diagram',
  ObjectDiagram: 'Object Diagram',
  StateMachineDiagram: 'State Machine Diagram',
  AgentDiagram: 'Agent Diagram',
  UserDiagram: 'User Diagram',
  GUINoCodeDiagram: 'GUI Diagram',
  QuantumCircuitDiagram: 'Quantum Circuit Diagram',
  NNDiagram: 'Neural Network Diagram',
};

export const PERSPECTIVE_DESCRIPTIONS: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Structural / data modeling, including OCL constraints attached to classes.',
  ObjectDiagram: 'Instances of a class diagram, used for tests and OCL validation.',
  StateMachineDiagram: 'State-based behavior modeling.',
  AgentDiagram: 'Conversational / AI agent specification.',
  UserDiagram: 'Actors and their interactions.',
  GUINoCodeDiagram: 'Graphical user interface design (IFML-inspired).',
  QuantumCircuitDiagram: 'Quantum program specification.',
  NNDiagram: 'Neural network architecture (PyTorch / TensorFlow).',
};

export const DIAGRAM_TYPE_BADGE: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-300',
  ObjectDiagram: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
  StateMachineDiagram: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
  AgentDiagram: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  UserDiagram: 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-300',
  GUINoCodeDiagram: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300',
  QuantumCircuitDiagram: 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-300',
  NNDiagram: 'bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-300',
};
