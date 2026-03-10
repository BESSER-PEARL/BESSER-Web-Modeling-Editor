import type { GeneratorMenuMode } from '../components/sidebar/workspace-types';

interface WorkspaceContext {
  isQuantumContext: boolean;
  isGuiContext: boolean;
  isClassContext: boolean;
  isAgentContext: boolean;
  isDeploymentAvailable: boolean;
  generatorMenuMode: GeneratorMenuMode;
}

export const getWorkspaceContext = (pathname: string, currentDiagramType?: string): WorkspaceContext => {
  const isQuantumContext = currentDiagramType === 'QuantumCircuitDiagram';
  const isGuiContext = currentDiagramType === 'GUINoCodeDiagram';
  const isClassContext =
    currentDiagramType === 'ClassDiagram'
    || currentDiagramType === 'ObjectDiagram'
    || currentDiagramType === 'StateMachineDiagram';
  const isAgentContext = currentDiagramType === 'AgentDiagram';

  const generatorMenuMode: GeneratorMenuMode = isQuantumContext
    ? 'quantum'
    : isGuiContext
      ? 'gui'
      : isAgentContext
        ? 'agent'
        : isClassContext
          ? 'class'
          : 'none';

  return {
    isQuantumContext,
    isGuiContext,
    isClassContext,
    isAgentContext,
    isDeploymentAvailable: isGuiContext || isClassContext,
    generatorMenuMode,
  };
};
