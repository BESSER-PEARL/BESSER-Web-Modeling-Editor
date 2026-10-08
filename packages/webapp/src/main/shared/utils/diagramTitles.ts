import type { SupportedDiagramType } from '../types/project';

/** Title of each type's first diagram in `createDefaultProject` (kept in sync by a unit test). */
export const DEFAULT_DIAGRAM_TITLES: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Class Diagram',
  ObjectDiagram: 'Object Diagram',
  StateMachineDiagram: 'State Machine Diagram',
  AgentDiagram: 'Agent Diagram',
  UserDiagram: 'User Diagram',
  GUINoCodeDiagram: 'GUI Diagram',
  QuantumCircuitDiagram: 'Quantum Circuit',
  NNDiagram: 'NN Diagram',
  BPMN: 'BPMN Diagram',
  ComponentDiagram: 'Component Diagram',
  DeploymentDiagram: 'Deployment Diagram',
};

/**
 * Default title for a new diagram tab, numbered from the type's default title
 * ("Class Diagram 2") and bumped past any existing title (case-insensitive).
 */
export function nextDiagramTitle(diagramType: SupportedDiagramType, existingTitles: string[]): string {
  const base = DEFAULT_DIAGRAM_TITLES[diagramType];
  const taken = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  if (existingTitles.length === 0 && !taken.has(base.toLowerCase())) return base;
  let n = existingTitles.length + 1;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}
