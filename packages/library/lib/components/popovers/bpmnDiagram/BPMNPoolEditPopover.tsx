import { useState } from "react"
import { Box, Button, Stack } from "@mui/material"
import { DividerLine, NodeStyleEditor, TextField } from "@/components/ui"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  InspectorSectionHeader,
  RowActionButton,
  TrashIcon,
} from "@/components/inspectors/_shared"
import { useTranslation } from "@/i18n"
import { PopoverProps } from "../types"
import { useDiagramStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { Node } from "@xyflow/react"
import { BPMNPoolProps } from "@/types"
import { generateUUID } from "@/utils"
import { addPoolLane, removePoolLane, swapPoolLanes } from "./poolLanes"

/**
 * Pool editor: name and colours + a Swimlanes section (add / rename / reorder /
 * delete lanes), ported from develop's bpmn-pool-update.tsx.
 *
 * Adding the FIRST lane reparents all of the pool's existing direct
 * children onto that lane (develop's `insertSwimlane`), so they stay
 * inside a lane instead of floating at the pool level. Lane edits keep the
 * pool wrapping its lanes (`poolLanes.ts`).
 */
export const BPMNPoolEditPopover = ({ elementId }: PopoverProps) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const [newLaneName, setNewLaneName] = useState("")
  const { t } = useTranslation()

  const poolNode = nodes.find((node) => node.id === elementId) as
    | Node<BPMNPoolProps>
    | undefined

  if (!poolNode) {
    return null
  }

  const lanes = nodes
    .filter((n) => n.parentId === elementId && n.type === "bpmnSwimlane")
    .sort((a, b) => a.position.y - b.position.y)

  const updatePoolField = (key: string, value: string) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, [key]: value } } : n
      )
    )

  const updateLaneName = (laneId: string, value: string) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === laneId ? { ...n, data: { ...n.data, name: value } } : n
      )
    )

  // Swap two lanes; their heights travel with them (develop's swapLaneBounds).
  const swapLanes = (i: number, j: number) =>
    setNodes((ns) => swapPoolLanes(ns, elementId, i, j))

  // Removing a lane shrinks the pool (an occupied lane merges into its
  // neighbour instead, so its content stays put).
  const deleteLane = (laneId: string) =>
    setNodes((ns) => removePoolLane(ns, elementId, laneId))

  // Adding a lane grows the pool so the new lane sits inside it.
  const addLane = () => {
    const name =
      newLaneName.trim() ||
      `${t("packages.BPMNDiagram.BPMNSwimlane", "Lane")} ${lanes.length + 1}`
    setNodes((ns) => addPoolLane(ns, elementId, { id: generateUUID(), name }))
    setNewLaneName("")
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={poolNode.data}
        handleDataFieldUpdate={updatePoolField}
        inputPlaceholder={t("popup.bpmn.poolName", "Pool Name")}
      />
      <DividerLine width="100%" />

      <InspectorSectionHeader>
        {t("packages.BPMNDiagram.BPMNSwimlanes", "Lanes")}
      </InspectorSectionHeader>
      {lanes.map((lane, i) => (
        <Stack key={lane.id} direction="row" spacing={0.5} alignItems="center">
          <TextField
            fullWidth
            size="small"
            value={(lane.data?.name as string) ?? ""}
            onChange={(e) => updateLaneName(lane.id, e.target.value)}
          />
          <RowActionButton
            label={t("popup.bpmn.moveLaneUp", "Move lane up")}
            disabled={i === 0}
            onClick={() => swapLanes(i, i - 1)}
          >
            <ChevronUpIcon size={14} />
          </RowActionButton>
          <RowActionButton
            label={t("popup.bpmn.moveLaneDown", "Move lane down")}
            disabled={i === lanes.length - 1}
            onClick={() => swapLanes(i, i + 1)}
          >
            <ChevronDownIcon size={14} />
          </RowActionButton>
          <RowActionButton
            danger
            label={t("popup.bpmn.deleteLane", "Delete lane")}
            onClick={() => deleteLane(lane.id)}
          >
            <TrashIcon size={14} />
          </RowActionButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={0.5} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder={t("popup.bpmn.newLaneName", "New lane name")}
          value={newLaneName}
          onChange={(e) => setNewLaneName(e.target.value)}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={addLane}
          sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
        >
          {t("popup.bpmn.addLane", "Add Lane")}
        </Button>
      </Stack>
    </Box>
  )
}
