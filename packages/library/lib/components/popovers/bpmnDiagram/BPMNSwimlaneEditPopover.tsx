import { Box, FormControlLabel, Switch, TextField } from "@mui/material"
import type { Node } from "@xyflow/react"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { AgentDiagramLinkSection, PresetField } from "@/components/inspectors/shared"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  RowActionButton,
  TrashIcon,
} from "@/components/inspectors/_shared"
import { AGENTIC_LANE_HEADER_WIDTH } from "@/components/svgs/nodes/bpmnDiagram/BPMNSwimlaneNodeSVG"
import { useDiagramStore, useMetadataStore, usePopoverStore } from "@/store/context"
import { BPMNSwimlaneProps } from "@/types"
import {
  clampMultiplicity,
  clampTrustScore,
  migrateLegacyRole,
} from "@/types/bpmnAgentic"
import { useTranslation } from "@/i18n"
import { PopoverProps } from "../types"
import { lanesOf, removePoolLane, swapPoolLanes } from "./poolLanes"
import { parseTrustScore } from "./BPMNTaskEditPopover"

/**
 * Switch "Agentic" on or off for a lane. Off drops every agentic key except
 * `agentDiagramRef`, so a plain lane's JSON carries none (develop 52ae1c89).
 * On fills develop's defaults and moves children out of the wider agentic
 * header so its marker column stays readable.
 */
export const setLaneAgentic = <N extends Node>(
  nodes: N[],
  laneId: string,
  isAgentic: boolean
): N[] =>
  nodes.map((n) => {
    if (n.id === laneId) {
      const data = { ...(n.data as BPMNSwimlaneProps) }
      if (!isAgentic) {
        delete data.isAgentic
        delete data.role
        delete data.trustScore
        delete data.multiplicity
        return { ...n, data }
      }
      return {
        ...n,
        data: {
          ...data,
          isAgentic: true,
          role: migrateLegacyRole(data.role),
          trustScore: clampTrustScore(data.trustScore ?? 0),
          multiplicity: clampMultiplicity(data.multiplicity ?? 1),
        },
      }
    }
    if (isAgentic && n.parentId === laneId && n.position.x < AGENTIC_LANE_HEADER_WIDTH) {
      return { ...n, position: { ...n.position, x: AGENTIC_LANE_HEADER_WIDTH } }
    }
    return n
  })

/**
 * The role shown in the field: a legacy token (worker / manager /
 * supervisor) as its current preset, anything else verbatim so typing a
 * custom role is never rewritten under the cursor.
 */
export const displayLaneRole = (role: unknown): string => {
  if (typeof role !== "string") return "solution"
  if (role.trim() === "") return role
  const migrated = migrateLegacyRole(role)
  return migrated === role.trim() ? role : migrated
}

/** Parse typed copies as develop does: NaN -> 1, at least 1. */
export const parseMultiplicity = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  return clampMultiplicity(Number.isFinite(parsed) ? parsed : 1)
}

/**
 * Lane editor (develop's bpmn-swimlane-update.tsx): name, colours, move
 * up / down within the pool, delete and, with the agentic perspective on,
 * the agentic switch, role, trust score, copies and agent-diagram link.
 */
export const BPMNSwimlaneEditPopover: React.FC<PopoverProps> = ({ elementId }) => {
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  const nodes = useDiagramStore((state) => state.nodes)
  const setNodes = useDiagramStore((state) => state.setNodes)
  const agenticEnabled = useMetadataStore((state) => state.agenticEnabled)
  const setPopOverElementId = usePopoverStore((state) => state.setPopOverElementId)
  if (!node) return null

  const data = node.data as BPMNSwimlaneProps
  const poolId = node.parentId
  const lanes = poolId ? lanesOf(nodes, poolId) : []
  const index = lanes.findIndex((lane) => lane.id === elementId)

  const setField = (patch: Partial<BPMNSwimlaneProps>) =>
    setNodes((ns) =>
      ns.map((n) => (n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n))
    )
  const move = (offset: -1 | 1) => {
    if (poolId) setNodes((ns) => swapPoolLanes(ns, poolId, index, index + offset))
  }
  const deleteLane = () => {
    if (!poolId) return
    setNodes((ns) => removePoolLane(ns, poolId, elementId))
    setPopOverElementId(null)
  }

  const laneActions = [
    <RowActionButton
      key="up"
      label={t("popup.bpmn.moveLaneUp", "Move lane up")}
      disabled={index <= 0}
      onClick={() => move(-1)}
    >
      <ChevronUpIcon size={14} />
    </RowActionButton>,
    <RowActionButton
      key="down"
      label={t("popup.bpmn.moveLaneDown", "Move lane down")}
      disabled={index === -1 || index >= lanes.length - 1}
      onClick={() => move(1)}
    >
      <ChevronDownIcon size={14} />
    </RowActionButton>,
    <RowActionButton
      key="delete"
      danger
      label={t("popup.bpmn.deleteLane", "Delete lane")}
      disabled={!poolId}
      onClick={deleteLane}
    >
      <TrashIcon size={14} />
    </RowActionButton>,
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={(key, value) => setField({ [key]: value })}
        sideElements={laneActions}
      />

      {agenticEnabled && (
        <>
          <DividerLine width="100%" />
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                size="small"
                checked={data.isAgentic === true}
                onChange={(_, checked) =>
                  setNodes((ns) => setLaneAgentic(ns, elementId, checked))
                }
              />
            }
            label={t("packages.BPMNDiagram.BPMNAgentic", "Agentic")}
          />
        </>
      )}

      {agenticEnabled && data.isAgentic && (
        <>
          <PresetField
            label={t("packages.BPMNDiagram.BPMNAgentRole", "Role")}
            value={displayLaneRole(data.role)}
            placeholder={t("packages.BPMNDiagram.BPMNAgentRolePlaceholder", "e.g. solution")}
            presets={[
              {
                value: "solution",
                label: t("packages.BPMNDiagram.BPMNAgentRoleSolution", "Solution"),
              },
              {
                value: "supervision",
                label: t("packages.BPMNDiagram.BPMNAgentRoleSupervision", "Supervision"),
              },
            ]}
            onChange={(role) => setField({ role })}
          />
          <TextField
            size="small"
            fullWidth
            label={t("packages.BPMNDiagram.BPMNTrustScore", "Trust score (0-100)")}
            value={String(data.trustScore ?? 0)}
            onChange={(e) => setField({ trustScore: parseTrustScore(e.target.value) })}
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          <TextField
            size="small"
            fullWidth
            label={t("packages.BPMNDiagram.BPMNMultiplicity", "Copies (≥1)")}
            value={String(data.multiplicity ?? 1)}
            onChange={(e) => setField({ multiplicity: parseMultiplicity(e.target.value) })}
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          <AgentDiagramLinkSection
            laneId={elementId}
            laneName={data.name}
            agentDiagramRef={data.agentDiagramRef ?? undefined}
          />
        </>
      )}
    </Box>
  )
}
