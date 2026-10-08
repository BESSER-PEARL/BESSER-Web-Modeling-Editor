import React, { useState } from "react"
import { Button } from "@mui/material"
import { DividerLine } from "@/components/ui"
import { useAgentDiagramLinker } from "@/components/hostProviders/contexts"
import { useTranslation } from "@/i18n"

export interface AgentDiagramLinkSectionProps {
  /** Id of the agentic BPMN lane or task. */
  laneId: string
  /** Its name; the suggested title of a new Agent diagram. */
  laneName: string
  /** The element's `agentDiagramRef`, if any. */
  agentDiagramRef?: string
}

/**
 * "Define / Open agent behavior" for an agentic lane or task. Renders nothing
 * without a host linker. A live ref opens its Agent diagram; a missing or
 * dangling one offers to create a new diagram. The host writes
 * `agentDiagramRef`, never this component.
 */
export const AgentDiagramLinkSection: React.FC<AgentDiagramLinkSectionProps> = ({
  laneId,
  laneName,
  agentDiagramRef,
}) => {
  const linker = useAgentDiagramLinker()
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  if (!linker) return null

  const alive = agentDiagramRef !== undefined && linker.isRefAlive(agentDiagramRef)

  const onDefine = async () => {
    // A second click while the host is still creating would create a second diagram.
    if (pending) return
    setPending(true)
    try {
      await linker.createForLane(
        laneName || t("packages.BPMNDiagram.BPMNDefaultAgentTitle", "Agent"),
        laneId
      )
    } catch (error) {
      console.error("[agent-diagram-linker] defining the agent diagram failed:", error)
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-testid="agent-diagram-link-section">
      <DividerLine />
      {alive ? (
        <Button variant="outlined" fullWidth onClick={() => linker.openByRef(agentDiagramRef as string)}>
          {t("packages.BPMNDiagram.BPMNOpenAgentDiagram", "Open agent behavior")}
        </Button>
      ) : (
        <Button variant="contained" fullWidth onClick={onDefine} disabled={pending} aria-busy={pending}>
          {t("packages.BPMNDiagram.BPMNDefineAgentDiagram", "Define agent behavior")}
        </Button>
      )}
    </div>
  )
}
