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
import { AGENTIC_LANE_HEADER_WIDTH } from "@/utils/bpmnConstraints"
import { useDiagramStore, useMetadataStore, usePopoverStore } from "@/store/context"
import { BPMNSwimlaneProps } from "@/types"
import {
  clampMultiplicity,
  clampTrustScore,
  displayLaneCopies,
  displayTrustScore,
  migrateLegacyRole,
  parseLaneCopies,
  parseTrustScore,
} from "@/types/bpmnAgentic"
import { useTranslation } from "@/i18n"
import { PopoverProps } from "../types"
import { lanesOf, removePoolLane, swapPoolLanes } from "./poolLanes"
import { stashAgenticFields, stashedAgenticFields } from "./agenticStash"

/** Lane keys that exist only while "Agentic" is on. */
export const LANE_AGENTIC_KEYS = ["role", "trustScore", "multiplicity"] as const

/**
 * Switch "Agentic" on or off for a lane. Off drops every agentic key except
 * `agentDiagramRef`, so a plain lane's JSON carries none (develop 52ae1c89).
 * On restores `previous` (the values it had when switched off), otherwise
 * fills develop's defaults, and moves children out of the wider agentic
 * header so its marker column stays readable.
 */
export const setLaneAgentic = <N extends Node>(
  nodes: N[],
  laneId: string,
  isAgentic: boolean,
  previous: Partial<BPMNSwimlaneProps> = {}
): N[] =>
  nodes.map((n) => {
    if (n.id === laneId) {
      const data = { ...(n.data as BPMNSwimlaneProps) }
      if (!isAgentic) {
        delete data.isAgentic
        for (const key of LANE_AGENTIC_KEYS) delete data[key]
        return { ...n, data }
      }
      const merged = { ...previous, ...data }
      return {
        ...n,
        data: {
          ...merged,
          isAgentic: true,
          role: migrateLegacyRole(merged.role),
          trustScore: clampTrustScore(merged.trustScore ?? 0),
          multiplicity: clampMultiplicity(merged.multiplicity ?? 1),
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
                onChange={(_, checked) => {
                  if (!checked) stashAgenticFields(elementId, data, LANE_AGENTIC_KEYS)
                  setNodes((ns) =>
                    setLaneAgentic(ns, elementId, checked, stashedAgenticFields(elementId))
                  )
                }}
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
            value={String(displayTrustScore(data.trustScore))}
            onChange={(e) => setField({ trustScore: parseTrustScore(e.target.value) })}
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          <TextField
            size="small"
            fullWidth
            label={t("packages.BPMNDiagram.BPMNMultiplicity", "Copies (≥1)")}
            value={String(displayLaneCopies(data.multiplicity))}
            onChange={(e) => setField({ multiplicity: parseLaneCopies(e.target.value) })}
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
