import React, { useState } from 'react';
import { Button } from '../controls/button/button';
import { Divider } from '../controls/divider/divider';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';
import { useAgentDiagramLinker } from './AgentDiagramLinkerContext';

interface OwnProps {
  laneId: string;
  laneName: string;
  agentDiagramRef?: string;
}

type Props = OwnProps & I18nContext;

/**
 * Popup section for the agentic-lane → Agent-diagram link.
 *
 * Mount unconditionally inside the lane's `{isAgentic && ...}` block.
 * Renders nothing if no linker is registered (e.g. editor used standalone
 * outside the host app). Otherwise renders one of two affordances:
 *
 *   - **alive ref** → "Open Agent diagram" button
 *   - **no ref / dead ref** → "Define BESSER agent" button — click
 *     creates a new Agent diagram and overwrites whatever (if anything)
 *     was in the ref slot.
 */
const AgentDiagramLinkSectionComponent: React.FC<Props> = ({ laneId, laneName, agentDiagramRef, translate }) => {
  const linker = useAgentDiagramLinker();
  const [pending, setPending] = useState(false);
  if (!linker) return null;

  const alive = agentDiagramRef !== undefined && linker.isRefAlive(agentDiagramRef);

  const onDefine = async () => {
    // A second click while the host is still creating the diagram would
    // create a second Agent diagram for the same element.
    if (pending) return;
    setPending(true);
    // The host flushes the editor model, adds the Agent diagram, writes the
    // ref to the source element in storage and switches the active type; it
    // reports failures to the user itself.
    try {
      await linker.createForLane(laneName || translate('packages.BPMNDiagram.BPMNDefaultAgentTitle'), laneId);
    } catch (error) {
      console.error('[agent-diagram-linker] defining the agent diagram failed:', error);
    } finally {
      setPending(false);
    }
  };

  const onOpen = () => {
    if (agentDiagramRef) linker.openByRef(agentDiagramRef);
  };

  return (
    <section>
      <Divider />
      {alive ? (
        <Button color="link" onClick={onOpen}>
          {translate('packages.BPMNDiagram.BPMNOpenAgentDiagram')}
        </Button>
      ) : (
        <Button color="primary" onClick={onDefine} disabled={pending}>
          {translate('packages.BPMNDiagram.BPMNDefineAgentDiagram')}
        </Button>
      )}
    </section>
  );
};

export const AgentDiagramLinkSection = localized(AgentDiagramLinkSectionComponent);
