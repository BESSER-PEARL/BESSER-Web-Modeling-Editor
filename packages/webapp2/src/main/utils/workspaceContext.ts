import type { GeneratorMenuMode } from '../components/sidebar/workspace-types';

interface WorkspaceContext {
  isQuantumContext: boolean;
  isGuiContext: boolean;
  isClassContext: boolean;
  isObjectContext: boolean;
  isStateMachineContext: boolean;
  isAgentContext: boolean;
  isDeploymentAvailable: boolean;
  generatorMenuMode: GeneratorMenuMode;
}

export const getWorkspaceContext = (pathname: string, currentDiagramType?: string): WorkspaceContext => {
  const isQuantumContext = currentDiagramType === 'QuantumCircuitDiagram';
  const isGuiContext = currentDiagramType === 'GUINoCodeDiagram';
  const isClassContext = currentDiagramType === 'ClassDiagram';
  const isObjectContext = currentDiagramType === 'ObjectDiagram';
  const isStateMachineContext = currentDiagramType === 'StateMachineDiagram';
  const isAgentContext = currentDiagramType === 'AgentDiagram';

  const generatorMenuMode: GeneratorMenuMode = isQuantumContext
    ? 'quantum'
    : isGuiContext
      ? 'gui'
      : isAgentContext
        ? 'agent'
        : isClassContext
          ? 'class'
          : isObjectContext
            ? 'object'
            : isStateMachineContext
              ? 'statemachine'
              : 'none';

  return {
    isQuantumContext,
    isGuiContext,
    isClassContext,
    isObjectContext,
    isStateMachineContext,
    isAgentContext,
    isDeploymentAvailable: isGuiContext || isClassContext,
    generatorMenuMode,
  };
};
