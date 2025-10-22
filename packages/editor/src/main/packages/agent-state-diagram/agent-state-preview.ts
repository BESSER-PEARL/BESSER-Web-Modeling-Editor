import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { ComposePreview } from '../compose-preview';




import { AgentIntent } from './agent-intent-object-component/agent-intent';

import { UMLStateFinalNode } from '../uml-state-diagram/uml-state-final-node/uml-state-final-node';
import { UMLStateInitialNode } from '../uml-state-diagram/uml-state-initial-node/uml-state-initial-node';
import { UMLStateCodeBlock } from '../uml-state-diagram/uml-state-code-block/uml-state-code-block';


import { AgentState } from './agent-state/agent-state';
import { AgentStateBody } from './agent-state-body/agent-state-body';
import { AgentStateFallbackBody } from './agent-state-fallback-body/agent-state-fallback-body';

const computeDimension = (scale: number, value: number): number => {
  return Math.round((scale * value) / 10) * 10;
};

export const composeBotPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  const elements: UMLElement[] = [];
  //UMLStateForkNode.defaultWidth = Math.round(20 / 10) * 10;
  //UMLStateForkNode.defaultHeight = Math.round(60 / 10) * 10;
  //UMLStateForkNodeHorizontal.defaultWidth = Math.round(60 / 10) * 10;
  //UMLStateForkNodeHorizontal.defaultHeight = Math.round(20 / 10) * 10;
  
  const emptyIntent = new AgentIntent({ name: "Intent Name" });
  emptyIntent.bounds = {
    ...emptyIntent.bounds,
    width: emptyIntent.bounds.width,
    height: emptyIntent.bounds.height,
  };
  elements.push(emptyIntent);

   // Empty State
   const emptyAgentState = new AgentState({ name: "AgentState" });
   emptyAgentState.bounds = {
     ...emptyAgentState.bounds,
     width: emptyAgentState.bounds.width,
     height: emptyAgentState.bounds.height,
   };
   elements.push(emptyAgentState);

   const agentState = new AgentState({ name: "AgentState" });
   agentState.bounds = {
     ...agentState.bounds,
     width: agentState.bounds.width,
     height: agentState.bounds.height,
   };
   const botBody = new AgentStateBody({
    name: "Body",
    owner: agentState.id,
    bounds: {
      x: 0,
      y: 0,
      width: computeDimension(1.0, 200),
      height: computeDimension(1.0, 30),
    },
  });
  agentState.ownedElements = [botBody.id];
  elements.push(...(agentState.render(layer, [botBody]) as UMLElement[]));
  
  // State with Body and Fallback Body
  const stateWithBothBodies = new AgentState({ name: "AgentState" });
  stateWithBothBodies.bounds = {
    ...stateWithBothBodies.bounds,
    width: stateWithBothBodies.bounds.width,
    height: stateWithBothBodies.bounds.height,
  };
  const stateBody2 = new AgentStateBody({
    name: "Body",
    owner: stateWithBothBodies.id,
    bounds: {
      x: 0,
      y: 0,
      width: computeDimension(1.0, 200),
      height: computeDimension(1.0, 30),
    },
  });
  const fallbackBody = new AgentStateFallbackBody({
    name: "Fallback Body",
    owner: stateWithBothBodies.id,
    bounds: {
      x: 0,
      y: 40,
      width: computeDimension(1.0, 200),
      height: computeDimension(1.0, 30),
    },
  });
  stateWithBothBodies.ownedElements = [stateBody2.id, fallbackBody.id];
  elements.push(...(stateWithBothBodies.render(layer, [stateBody2, fallbackBody]) as UMLElement[]));

  // State Initial Node
  const stateInitialNode = new UMLStateInitialNode({
    bounds: { x: 0, y: 0, width: 45, height: 45 },
  });
  elements.push(stateInitialNode);

  // // State Final Node
  // const stateFinalNode = new UMLStateFinalNode({
  //   bounds: { x: 0, y: 0, width: 45, height: 45 },
  // });
  // elements.push(stateFinalNode);

 

  return elements;
};
