import type { GeneratorMenuMode } from '../../app/shell/workspace-types';

interface WorkspaceContext {
  isQuantumContext: boolean;
  isGuiContext: boolean;
  isClassContext: boolean;
  isObjectContext: boolean;
  isUserContext: boolean;
  isStateMachineContext: boolean;
  isAgentContext: boolean;
  isNNContext: boolean;
  isDeploymentAvailable: boolean;
  generatorMenuMode: GeneratorMenuMode;
}

export const getWorkspaceContext = (pathname: string, currentDiagramType?: string): WorkspaceContext => {
  const isQuantumContext = currentDiagramType === 'QuantumCircuitDiagram';
  const isGuiContext = currentDiagramType === 'GUINoCodeDiagram';
  const isClassContext = currentDiagramType === 'ClassDiagram';
  const isObjectContext = currentDiagramType === 'ObjectDiagram';
  const isUserContext = currentDiagramType === 'UserDiagram';
  const isStateMachineContext = currentDiagramType === 'StateMachineDiagram';
  const isAgentContext = currentDiagramType === 'AgentDiagram';
  const isNNContext = currentDiagramType === 'NNDiagram';

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
            : isUserContext
              ? 'user'
              : isStateMachineContext
                ? 'statemachine'
                : isNNContext
                  ? 'nn'
                  : 'none';

  return {
    isQuantumContext,
    isGuiContext,
    isClassContext,
    isObjectContext,
    isUserContext,
    isStateMachineContext,
    isAgentContext,
    isNNContext,
    isDeploymentAvailable: isGuiContext || isClassContext || isAgentContext,
    generatorMenuMode,
  };
};