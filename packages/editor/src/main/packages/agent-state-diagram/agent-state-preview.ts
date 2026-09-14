import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { ComposePreview } from '../compose-preview';

import { AgentState } from './agent-state/agent-state';
import { AgentStateBody } from './agent-state-body/agent-state-body';

const computeDimension = (scale: number, value: number): number => {
  return Math.round((scale * value) / 10) * 10;
};

export const composeBotPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  // Empty State
  const emptyAgentState = new AgentState({ name: 'AgentState' });

  // State with Body
  const agentState = new AgentState({ name: 'AgentState' });
  const botBody = new AgentStateBody({
    name: 'Body',
    owner: agentState.id,
    bounds: {
      x: 0,
      y: 0,
      width: computeDimension(1.0, 200),
      height: computeDimension(1.0, 30),
    },
  });
  agentState.ownedElements = [botBody.id];
  const agentStateRendered = agentState.render(layer, [botBody]) as UMLElement[];

  return [
    emptyAgentState,
    ...agentStateRendered,
  ];
};
