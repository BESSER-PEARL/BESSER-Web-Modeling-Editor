import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@mui/material"
import type { Node } from "@xyflow/react"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { AgentDiagramLinkSection } from "@/components/inspectors/shared"
import { agenticTaskMinHeight } from "@/components/svgs/nodes/bpmnDiagram/BPMNTaskNodeSVG"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { PopoverProps } from "../types"
import {
  BPMNMarkerType,
  BPMNSwimlaneProps,
  BPMNTaskProps,
  BPMNTaskType,
} from "@/types"
import { BPMNReflectionMode, clampTrustScore } from "@/types/bpmnAgentic"
import { supportsMultilineName } from "@/utils/nodeUtils"
import { useTranslation } from "@/i18n"

/**
 * Data of a task with "Agentic" switched on or off. Off drops every agentic
 * key except `agentDiagramRef`, so a plain task's JSON carries none (develop
 * 52ae1c89); on fills develop's defaults.
 */
export const withTaskAgentic = (
  data: BPMNTaskProps,
  isAgentic: boolean
): BPMNTaskProps => {
  if (!isAgentic) {
    const rest: BPMNTaskProps = { ...data }
    delete rest.isAgentic
    delete rest.reflectionMode
    delete rest.trustScore
    delete rest.reflectionReviewerLaneId
    return rest
  }
  return {
    ...data,
    isAgentic: true,
    reflectionMode: data.reflectionMode ?? "none",
    trustScore: clampTrustScore(data.trustScore ?? 0),
  }
}

/**
 * Patch a task's data in one store write (one undo step), growing it to the
 * agentic minimum height when the patch needs more room.
 */
export const patchTask = <N extends Node>(
  nodes: N[],
  taskId: string,
  update: (data: BPMNTaskProps) => BPMNTaskProps
): N[] =>
  nodes.map((n) => {
    if (n.id !== taskId) return n
    const data = update(n.data as BPMNTaskProps)
    const height = n.height ?? n.measured?.height
    const minHeight = agenticTaskMinHeight(data)
    if (height === undefined || height >= minHeight) return { ...n, data }
    return {
      ...n,
      data,
      height: minHeight,
      measured: { ...n.measured, height: minHeight },
    }
  })

/** Parse a typed trust score as develop does: NaN -> 0, clamped to 0-100. */
export const parseTrustScore = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  return clampTrustScore(Number.isFinite(parsed) ? parsed : 0)
}

const REFLECTION_MODES: { value: BPMNReflectionMode; key: string; fallback: string }[] = [
  { value: "none", key: "BPMNReflectionNone", fallback: "No reflection" },
  { value: "self", key: "BPMNReflectionSelf", fallback: "Self-reflection" },
  { value: "cross", key: "BPMNReflectionCross", fallback: "Cross-reflection" },
  { value: "human", key: "BPMNReflectionHuman", fallback: "Human-reflection" },
]

export const BPMNTaskEditPopover: React.FC<PopoverProps> = ({ elementId }) => {
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  const setNodes = useDiagramStore((state) => state.setNodes)
  const agenticEnabled = useMetadataStore((state) => state.agenticEnabled)
  const nodes = useDiagramStore((state) => state.nodes)
  if (!node) return null

  const data = node.data as BPMNTaskProps
  // Cross-reflection reviewers: agentic lanes other than the task's own.
  const reviewerLanes = nodes.filter(
    (n) =>
      n.type === "bpmnSwimlane" &&
      (n.data as BPMNSwimlaneProps).isAgentic === true &&
      n.id !== node.parentId
  )
  const update = (fn: (data: BPMNTaskProps) => BPMNTaskProps) =>
    setNodes((nodes) => patchTask(nodes, elementId, fn))
  const setField = (patch: Partial<BPMNTaskProps>) =>
    update((d) => ({ ...d, ...patch }))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        handleDataFieldUpdate={(key, value) => setField({ [key]: value })}
        nodeData={data}
        isMultilineName={supportsMultilineName(node.type)}
      />

      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-task-type-label">
          {t("popup.bpmn.taskType", "Task Type")}
        </InputLabel>
        <Select
          labelId="bpmn-task-type-label"
          id="bpmn-task-type-select"
          value={data.taskType ?? "default"}
          label={t("popup.bpmn.taskType", "Task Type")}
          onChange={(e) => setField({ taskType: e.target.value as BPMNTaskType })}
        >
          <MenuItem value="default">
            {t("packages.BPMNDiagram.BPMNTask", "Task")}
          </MenuItem>
          <MenuItem value="user">
            {t("packages.BPMNDiagram.BPMNUserTask", "User Task")}
          </MenuItem>
          <MenuItem value="service">
            {t("packages.BPMNDiagram.BPMNServiceTask", "Service Task")}
          </MenuItem>
          <MenuItem value="send">
            {t("packages.BPMNDiagram.BPMNSendTask", "Send Task")}
          </MenuItem>
          <MenuItem value="receive">
            {t("packages.BPMNDiagram.BPMNReceiveTask", "Receive Task")}
          </MenuItem>
          <MenuItem value="manual">
            {t("packages.BPMNDiagram.BPMNManualTask", "Manual Task")}
          </MenuItem>
          <MenuItem value="business-rule">
            {t("packages.BPMNDiagram.BPMNBusinessRuleTask", "Business Rule Task")}
          </MenuItem>
          <MenuItem value="script">
            {t("packages.BPMNDiagram.BPMNScriptTask", "Script Task")}
          </MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-task-marker-label">
          {t("popup.bpmn.marker", "Marker")}
        </InputLabel>
        <Select
          labelId="bpmn-task-marker-label"
          id="bpmn-task-marker-select"
          value={data.marker ?? "none"}
          label={t("popup.bpmn.marker", "Marker")}
          onChange={(e) => setField({ marker: e.target.value as BPMNMarkerType })}
        >
          <MenuItem value="none">{t("common.none", "None")}</MenuItem>
          <MenuItem value="parallel multi instance">
            {t(
              "popup.bpmn.markerParallelMultiInstance",
              "Parallel multi instance"
            )}
          </MenuItem>
          <MenuItem value="sequential multi instance">
            {t(
              "popup.bpmn.markerSequentialMultiInstance",
              "Sequential multi instance"
            )}
          </MenuItem>
          <MenuItem value="loop">{t("popup.bpmn.markerLoop", "Loop")}</MenuItem>
        </Select>
      </FormControl>

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
                  update((d) => withTaskAgentic(d, checked))
                }
              />
            }
            label={t("packages.BPMNDiagram.BPMNAgentic", "Agentic")}
          />
        </>
      )}

      {agenticEnabled && data.isAgentic && (
        <>
          <TextField
            select
            size="small"
            fullWidth
            value={data.reflectionMode ?? "none"}
            onChange={(e) =>
              setField({ reflectionMode: e.target.value as BPMNReflectionMode })
            }
            label={t("packages.BPMNDiagram.BPMNReflectionMode", "Reflection")}
          >
            {REFLECTION_MODES.map((mode) => (
              <MenuItem key={mode.value} value={mode.value}>
                {t(`packages.BPMNDiagram.${mode.key}`, mode.fallback)}
              </MenuItem>
            ))}
          </TextField>

          {data.reflectionMode === "cross" && (
            <TextField
              select
              size="small"
              fullWidth
              label={t("packages.BPMNDiagram.BPMNReflectionReviewerLabel", "Reviewer agent")}
              value={data.reflectionReviewerLaneId ?? ""}
              onChange={(e) =>
                setField({ reflectionReviewerLaneId: e.target.value || undefined })
              }
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">
                {t("packages.BPMNDiagram.BPMNReflectionReviewerUnspecified", "(Unspecified)")}
              </MenuItem>
              {reviewerLanes.map((lane) => (
                <MenuItem key={lane.id} value={lane.id}>
                  {(lane.data as BPMNSwimlaneProps).name || lane.id}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            size="small"
            fullWidth
            label={t("packages.BPMNDiagram.BPMNTrustScore", "Trust score (0-100)")}
            value={String(data.trustScore ?? 0)}
            onChange={(e) => setField({ trustScore: parseTrustScore(e.target.value) })}
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
