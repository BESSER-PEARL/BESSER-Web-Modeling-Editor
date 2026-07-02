import { useState } from "react"
import { Box, Button, IconButton, Stack, Typography } from "@mui/material"
import { TextField } from "@/components/ui"
import { PopoverProps } from "../types"
import { useDiagramStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { Node } from "@xyflow/react"
import { BPMNPoolProps } from "@/types"
import { generateUUID } from "@/utils"
import {
  POOL_HEADER_WIDTH,
  SWIMLANE_MIN_HEIGHT,
} from "@/hooks/useSwimlaneLayout"

/**
 * Pool editor: name field + a Swimlanes section (add / rename / reorder /
 * delete lanes), ported from develop's bpmn-pool-update.tsx.
 *
 * Adding the FIRST lane reparents all of the pool's existing direct
 * children onto that lane (develop's `insertSwimlane`), so they stay
 * inside a lane instead of floating at the pool level.
 */
export const BPMNPoolEditPopover = ({ elementId }: PopoverProps) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const [newLaneName, setNewLaneName] = useState("")

  const poolNode = nodes.find((node) => node.id === elementId) as
    | Node<BPMNPoolProps>
    | undefined

  if (!poolNode) {
    return null
  }

  const lanes = nodes
    .filter((n) => n.parentId === elementId && n.type === "bpmnSwimlane")
    .sort((a, b) => a.position.y - b.position.y)

  const updatePoolName = (value: string) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, name: value } } : n
      )
    )

  const updateLaneName = (laneId: string, value: string) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === laneId ? { ...n, data: { ...n.data, name: value } } : n
      )
    )

  // Swap two lanes' vertical positions (develop's swapLaneBounds).
  const swapLanes = (i: number, j: number) => {
    const a = lanes[i]
    const b = lanes[j]
    if (!a || !b) return
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id === a.id)
          return { ...n, position: { ...n.position, y: b.position.y } }
        if (n.id === b.id)
          return { ...n, position: { ...n.position, y: a.position.y } }
        return n
      })
    )
  }

  const deleteLane = (laneId: string) =>
    setNodes((ns) =>
      ns
        // Reparent the lane's children back onto the pool before removing it.
        .map((n) => (n.parentId === laneId ? { ...n, parentId: elementId } : n))
        .filter((n) => n.id !== laneId)
    )

  const addLane = () => {
    const name = newLaneName.trim() || `Lane ${lanes.length + 1}`
    const newLaneId = generateUUID()
    const poolWidth = poolNode.width ?? 200
    const poolHeight = poolNode.height ?? 120
    const isFirstLane = lanes.length === 0
    const existingTotal = lanes.reduce(
      (sum, l) => sum + (l.height ?? SWIMLANE_MIN_HEIGHT),
      0
    )
    const newLane: Node = {
      id: newLaneId,
      type: "bpmnSwimlane",
      parentId: elementId,
      position: { x: POOL_HEADER_WIDTH, y: isFirstLane ? 0 : existingTotal },
      width: poolWidth - POOL_HEADER_WIDTH,
      // The first lane fills the pool; subsequent lanes start at the floor.
      height: isFirstLane ? poolHeight : SWIMLANE_MIN_HEIGHT,
      // Lanes are pool-driven, not free-dragging.
      draggable: false,
      data: { name },
    }
    setNodes((ns) => {
      let next = ns
      if (isFirstLane) {
        // Reparent all existing direct pool children onto the new first lane.
        next = next.map((n) =>
          n.parentId === elementId && n.id !== newLaneId
            ? { ...n, parentId: newLaneId }
            : n
        )
      }
      return [...next, newLane]
    })
    setNewLaneName("")
  }

  return (
    <Box
      sx={{
        width: 280,
        padding: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <TextField
        fullWidth
        label="Pool Name"
        value={poolNode.data.name ?? ""}
        onChange={(e) => updatePoolName(e.target.value)}
        variant="outlined"
        size="small"
      />

      <Typography variant="subtitle2">Swimlanes</Typography>
      {lanes.map((lane, i) => (
        <Stack key={lane.id} direction="row" spacing={0.5} alignItems="center">
          <TextField
            fullWidth
            size="small"
            value={(lane.data?.name as string) ?? ""}
            onChange={(e) => updateLaneName(lane.id, e.target.value)}
          />
          <IconButton
            size="small"
            disabled={i === 0}
            onClick={() => swapLanes(i, i - 1)}
            aria-label="Move lane up"
          >
            ↑
          </IconButton>
          <IconButton
            size="small"
            disabled={i === lanes.length - 1}
            onClick={() => swapLanes(i, i + 1)}
            aria-label="Move lane down"
          >
            ↓
          </IconButton>
          <IconButton
            size="small"
            onClick={() => deleteLane(lane.id)}
            aria-label="Delete lane"
          >
            ✕
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={0.5} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="New lane name"
          value={newLaneName}
          onChange={(e) => setNewLaneName(e.target.value)}
        />
        <Button size="small" variant="outlined" onClick={addLane}>
          Add Swimlane
        </Button>
      </Stack>
    </Box>
  )
}
