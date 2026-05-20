import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { ComposePreview, PreviewElement } from '../compose-preview';

import { AgentIntent } from './agent-intent-object-component/agent-intent';
import { AgentRagElement } from './agent-rag-element/agent-rag-element';

import { UMLStateInitialNode } from '../uml-state-diagram/uml-state-initial-node/uml-state-initial-node';

import { AgentState } from './agent-state/agent-state';
import { AgentStateBody } from './agent-state-body/agent-state-body';
import { AgentTool } from './agent-tool/agent-tool';
import { AgentSkill } from './agent-skill/agent-skill';
import { AgentWorkspace } from './agent-workspace/agent-workspace';
import { AgentReasoningState } from './agent-reasoning-state/agent-reasoning-state';
import { AgentSectionTitle, AgentSectionSeparator } from './agent-section-elements';

// Palette section dividers/titles are inert (not draggable) — matches the NN diagram.
const inert = (element: UMLElement): UMLElement => {
  (element as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };
  return element;
};
const sectionTitle = (name: string): UMLElement => inert(new AgentSectionTitle({ name }));
const sectionSeparator = (): UMLElement => inert(new AgentSectionSeparator());

const computeDimension = (scale: number, value: number): number => {
  return Math.round((scale * value) / 10) * 10;
};

export const composeBotPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  // Build every preview element first, then push in the palette's display
  // order below (flow/states → reasoning → reasoning primitives → knowledge).

  // State Initial Node
  const stateInitialNode = new UMLStateInitialNode({
    bounds: { x: 0, y: 0, width: 45, height: 45 },
  });

  // Empty State
  const emptyAgentState = new AgentState({ name: "AgentState" });
  emptyAgentState.bounds = {
    ...emptyAgentState.bounds,
    width: emptyAgentState.bounds.width,
    height: emptyAgentState.bounds.height,
  };

  // State with Body
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
  const agentStateRendered = agentState.render(layer, [botBody]) as UMLElement[];

  const reasoningState = new AgentReasoningState({ name: 'ReasoningState' });
  reasoningState.bounds = {
    ...reasoningState.bounds,
    width: computeDimension(1.0, 200),
    height: computeDimension(1.0, 80),
  };
  reasoningState.render(layer);

  const toolElement = new AgentTool({ name: 'tool_name', description: 'What this tool does' });
  toolElement.bounds = {
    ...toolElement.bounds,
    width: computeDimension(1.0, toolElement.bounds.width),
    height: computeDimension(1.0, toolElement.bounds.height),
  };
  toolElement.render(layer);

  const skillElement = new AgentSkill({ name: 'skill_name', description: 'What this skill teaches' });
  skillElement.bounds = {
    ...skillElement.bounds,
    width: computeDimension(1.0, skillElement.bounds.width),
    height: computeDimension(1.0, skillElement.bounds.height),
  };
  skillElement.render(layer);

  const workspaceElement = new AgentWorkspace({ name: 'workspace_name', path: '/path/to/dir' });
  workspaceElement.bounds = {
    ...workspaceElement.bounds,
    width: computeDimension(1.0, workspaceElement.bounds.width),
    height: computeDimension(1.0, workspaceElement.bounds.height),
  };
  workspaceElement.render(layer);

  const emptyIntent = new AgentIntent({ name: "Intent Name" });
  emptyIntent.bounds = {
    ...emptyIntent.bounds,
    width: emptyIntent.bounds.width,
    height: emptyIntent.bounds.height,
  };

  const ragElement = new AgentRagElement({ name: 'RAG DB Name' });
  ragElement.bounds = {
    ...ragElement.bounds,
    width: computeDimension(1.0, ragElement.bounds.width),
    height: computeDimension(1.0, ragElement.bounds.height),
  };
  ragElement.render(layer);

  // Display order, grouped into titled sections (mirrors the NN palette):
  // Flow → Reasoning → Capabilities → Knowledge.
  const elements: UMLElement[] = [
    sectionTitle('Flow'),
    stateInitialNode,
    emptyAgentState,
    ...agentStateRendered,
    sectionSeparator(),
    sectionTitle('Reasoning'),
    reasoningState,
    sectionSeparator(),
    sectionTitle('Knowledge'),
    emptyIntent,
    ragElement,
    sectionSeparator(),
    sectionTitle('Capabilities'),
    toolElement,
    skillElement,
    workspaceElement,
  ];

  return elements;
};
