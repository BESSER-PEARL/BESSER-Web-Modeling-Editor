import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { ComposePreview, PreviewElement } from '../compose-preview';
import { UMLStateInitialNode } from '../uml-state-diagram/uml-state-initial-node/uml-state-initial-node';

import { AgentSectionTitle } from './agent-section-elements';
import { AgentState } from './agent-state/agent-state';

// Palette section titles are inert (not draggable) — matches the NN diagram.
const inert = (element: UMLElement): PreviewElement => {
  (element as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };
  return element;
};

/**
 * Sidebar palette of the agent diagram. Only the conversation flow lives on the canvas (initial
 * node + states; comments are added by the create pane for every diagram). Agent components
 * (intents, LLMs, RAG databases, tools, skills, workspaces, GUIs) are off-canvas and edited in the
 * webapp's agent components panel.
 */
export const composeBotPreview: ComposePreview = (_layer: ILayer): PreviewElement[] => {
  // The title's name is an i18n key, resolved by AgentSectionTitleComponent at render time
  // (compose functions are called without a translate function).
  const flowTitle = inert(new AgentSectionTitle({ name: 'packages.AgentDiagram.palette.flow' }));

  const stateInitialNode = new UMLStateInitialNode({
    bounds: { x: 0, y: 0, width: 45, height: 45 },
  });

  const agentState = new AgentState({ name: 'AgentState' });

  return [flowTitle, stateInitialNode, agentState];
};
