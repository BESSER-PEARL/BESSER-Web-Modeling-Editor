import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material"
import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DividerLine, EdgeStyleEditor, Typography } from "@/components/ui"
import { DeleteIcon, SwapHorizIcon } from "@/components/Icon"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader, AddRowButton } from "../_shared"

/**
 * SA-4 / SA-2.2 inspector body for the `AgentStateTransition` edge.
 *
 * Source-of-truth port:
 * `packages/editor/.../agent-state-transition-update.tsx`.
 *
 * SA-2.2 deltas (audit recommendations 23–26):
 *   - #23: when `predefinedType === 'when_intent_matched'`, the
 *     intent-name picker is a Select sourced from sibling
 *     `AgentIntent` nodes (was free TextField).
 *   - #24: when `predefinedType === 'when_file_received'`, fileType
 *     becomes a Select with options PDF / TXT / JSON.
 *   - #25: the custom-condition editor uses CodeMirror with Python
 *     syntax highlighting.
 *   - #26: flip + color editing surface via `EdgeStyleEditor` +
 *     `SwapHorizIcon`, mirroring SA-2.1's class-edge approach.
 *
 * The edge data shape mirrors `docs/source/migrations/uml-v4-shape.md`'s
 * canonical `AgentStateTransitionData`. The migrator collapses the 5
 * legacy v3 transition shapes onto this canonical form (see
 * `versionConverter.ts::liftAgentTransitionDataToV4`).
 */
type EdgeData = CustomEdgeProps & {
  name?: string
  transitionType?: "predefined" | "custom"
  predefined?: {
    predefinedType?: string
    intentName?: string
    fileType?: string
    conditionValue?:
      | string
      | { variable?: string; operator?: string; targetValue?: string }
  }
  custom?: {
    event?: string
    condition?: string[]
  }
  params?: { [key: string]: string }
  // Legacy bag — preserved verbatim by the migrator.
  legacyShape?: 1 | 2 | 3 | 4 | 5
  legacy?: Record<string, unknown>
  // Flat aliases (writer convenience).
  customEvent?: string
  customCondition?: string
  customParams?: Record<string, unknown>
}

const PREDEFINED_TYPES = [
  "when_intent_matched",
  "when_no_intent_matched",
  "when_variable_operation_matched",
  "when_file_received",
  "auto",
] as const

const CUSTOM_EVENTS = [
  "None",
  "DummyEvent",
  "WildcardEvent",
  "ReceiveMessageEvent",
  "ReceiveTextEvent",
  "ReceiveJSONEvent",
  "ReceiveFileEvent",
] as const

const VARIABLE_OPERATORS = ["==", "!=", "<", "<=", ">", ">="] as const

const FILE_TYPES = ["PDF", "TXT", "JSON"] as const

const CUSTOM_CONDITION_TEMPLATE = `def condition(session: 'Session', params: dict) -> bool:
    """Boolean function

    Args:
        session (Session): the current user session
        params (dict): the function parameters

    Returns:
        bool: True or False
    """
    if session.get('x') > 10:
        return True
    else:
        return False`

export const AgentDiagramEdgeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setEdges: state.setEdges,
    }))
  )
  const edge = edges.find((e) => e.id === elementId)
  if (!edge) return null

  const data: EdgeData = (edge.data ?? {}) as EdgeData
  const mode = data.transitionType ?? "predefined"
  const predefined = data.predefined ?? {}
  const custom = data.custom ?? { event: "None", condition: [] }
  const params = data.params ?? {}

  // SA-2.2 #23: source intent-name options from sibling AgentIntent
  // nodes. v3 read these from `state.elements`; v4 reads them off the
  // store's `nodes` array.
  const intentNames = React.useMemo(
    () =>
      Array.from(
        new Set(
          nodes
            .filter((n) => n.type === "AgentIntent")
            .map((n) => ((n.data as { name?: string }).name ?? "").trim())
            .filter((s) => s.length > 0)
        )
      ),
    [nodes]
  )

  const update = (patch: Partial<EdgeData>) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    update({ [key]: value } as Partial<EdgeData>)
  }

  // SA-2.2 #26: flip swaps source/target/handle pairs on the edge,
  // mirroring SA-2.1's `ClassEdgeEditPanel.handleSwap`.
  const handleSwap = () => {
    setEdges((all) =>
      all.map((e) => {
        if (e.id !== elementId) return e
        return {
          ...e,
          source: e.target,
          sourceHandle: e.targetHandle,
          target: e.source,
          targetHandle: e.sourceHandle,
        }
      })
    )
  }

  // Sub-field helpers.
  const setPredefined = (
    patch: Partial<NonNullable<EdgeData["predefined"]>>
  ) => update({ predefined: { ...predefined, ...patch } })

  const setCustom = (patch: Partial<NonNullable<EdgeData["custom"]>>) =>
    update({ custom: { ...custom, ...patch } })

  const setMode = (next: "predefined" | "custom") => {
    if (next === mode) return
    if (next === "predefined") {
      update({
        transitionType: "predefined",
        predefined: predefined.predefinedType
          ? predefined
          : { predefinedType: "when_intent_matched", intentName: "" },
      })
    } else {
      update({
        transitionType: "custom",
        custom: custom.event ? custom : { event: "WildcardEvent", condition: [] },
      })
    }
  }

  // Param helpers (numeric-keyed dict).
  const setParam = (key: string, value: string) =>
    update({ params: { ...params, [key]: value } })
  const removeParam = (key: string) => {
    const next = { ...params }
    delete next[key]
    update({ params: next })
  }
  const addParam = () => {
    const numericKeys = Object.keys(params)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
    const nextKey = (
      (numericKeys.length ? Math.max(...numericKeys) : -1) + 1
    ).toString()
    update({ params: { ...params, [nextKey]: "" } })
  }

  // Custom-condition list helpers.
  const setCondition = (idx: number, value: string) => {
    const next = [...(custom.condition ?? [])]
    next[idx] = value
    setCustom({ condition: next })
  }
  const addCondition = () =>
    setCustom({
      condition: [
        ...(custom.condition ?? []),
        CUSTOM_CONDITION_TEMPLATE,
      ],
    })
  const removeCondition = (idx: number) => {
    const next = [...(custom.condition ?? [])]
    next.splice(idx, 1)
    setCustom({ condition: next })
  }

  // Variable-operation conditionValue (object form).
  const cv = predefined.conditionValue
  const variable =
    typeof cv === "object" && cv !== null && "variable" in cv
      ? (cv.variable ?? "")
      : ""
  const operator =
    typeof cv === "object" && cv !== null && "operator" in cv
      ? (cv.operator ?? "==")
      : "=="
  const targetValue =
    typeof cv === "object" && cv !== null && "targetValue" in cv
      ? (cv.targetValue ?? "")
      : ""

  const setVariableOp = (next: {
    variable?: string
    operator?: string
    targetValue?: string
  }) => {
    setPredefined({
      conditionValue: {
        variable: next.variable ?? variable,
        operator: next.operator ?? operator,
        targetValue: next.targetValue ?? targetValue,
      },
    })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* SA-2.2 #26: color editor + flip action */}
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label="Transition"
        sideElements={[
          <Tooltip key="flip" title="Flip source / target">
            <IconButton size="small" onClick={handleSwap}>
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>,
        ]}
      />
      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={(_, v) => v && setMode(v as "predefined" | "custom")}
      >
        <ToggleButton value="predefined">predefined</ToggleButton>
        <ToggleButton value="custom">custom</ToggleButton>
      </ToggleButtonGroup>

      {mode === "predefined" ? (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {/* SA-FINAL-3 #6: caption col 90 → 70 for sibling consistency. */}
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              predefinedType
            </Typography>
            <Select
              size="small"
              value={predefined.predefinedType ?? "when_intent_matched"}
              onChange={(e) =>
                setPredefined({ predefinedType: String(e.target.value) })
              }
              sx={{ flex: 1 }}
            >
              {PREDEFINED_TYPES.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          {/* SA-2.2 #23 — intent-name dropdown sourced from sibling
              AgentIntent nodes; falls back to a free TextField when no
              intents exist (pre-authoring scenario). */}
          {predefined.predefinedType === "when_intent_matched" ? (
            intentNames.length > 0 ? (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" sx={{ minWidth: 70 }}>
                  intentName
                </Typography>
                <Select
                  size="small"
                  value={predefined.intentName ?? ""}
                  onChange={(e) =>
                    setPredefined({ intentName: String(e.target.value) })
                  }
                  displayEmpty
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">— select intent —</MenuItem>
                  {intentNames.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            ) : (
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                label="intentName"
                value={predefined.intentName ?? ""}
                onChange={(e) => setPredefined({ intentName: e.target.value })}
                helperText="No AgentIntent nodes — create one to enable the dropdown."
              />
            )
          ) : null}

          {/* SA-2.2 #24 — fileType dropdown (PDF / TXT / JSON). */}
          {predefined.predefinedType === "when_file_received" ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" sx={{ minWidth: 70 }}>
                fileType
              </Typography>
              <Select
                size="small"
                value={predefined.fileType ?? ""}
                onChange={(e) =>
                  setPredefined({ fileType: String(e.target.value) })
                }
                displayEmpty
                sx={{ flex: 1 }}
              >
                <MenuItem value="">— select file type —</MenuItem>
                {FILE_TYPES.map((ft) => (
                  <MenuItem key={ft} value={ft}>
                    {ft}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          ) : null}

          {predefined.predefinedType === "when_variable_operation_matched" ? (
            <Stack direction="row" spacing={0.5}>
              <MuiTextField
                size="small"
                variant="outlined"
                label="variable"
                value={variable}
                onChange={(e) => setVariableOp({ variable: e.target.value })}
                sx={{ flex: 1 }}
              />
              <Select
                size="small"
                value={operator}
                onChange={(e) =>
                  setVariableOp({ operator: String(e.target.value) })
                }
              >
                {VARIABLE_OPERATORS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
              <MuiTextField
                size="small"
                variant="outlined"
                label="targetValue"
                value={targetValue}
                onChange={(e) =>
                  setVariableOp({ targetValue: e.target.value })
                }
                sx={{ flex: 1 }}
              />
            </Stack>
          ) : null}
        </>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              event
            </Typography>
            <Select
              size="small"
              value={custom.event ?? "WildcardEvent"}
              onChange={(e) => setCustom({ event: String(e.target.value) })}
              sx={{ flex: 1 }}
            >
              {CUSTOM_EVENTS.map((ev) => (
                <MenuItem key={ev} value={ev}>
                  {ev}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <InspectorSectionHeader>conditions</InspectorSectionHeader>
            <AddRowButton onClick={addCondition} />
          </Stack>
          {(custom.condition ?? []).map((c, idx) => (
            <Stack
              key={idx}
              direction="column"
              alignItems="stretch"
              spacing={0.5}
              sx={{ padding: "4px 0" }}
            >
              {/* SA-2.2 #25 — CodeMirror Python editor for custom
                  conditions, mirroring v3's `react-codemirror2` Python
                  mode at `agent-state-transition-update.tsx:329-348`. */}
              <Box
                sx={{
                  border: "1px solid var(--besser-gray, #ccc)",
                  borderRadius: "4px",
                  "& .cm-editor": { fontSize: "13px", minHeight: 120 },
                }}
              >
                <CodeMirror
                  value={c}
                  extensions={[python()]}
                  onChange={(v) => setCondition(idx, v)}
                  basicSetup={{
                    lineNumbers: true,
                    tabSize: 4,
                    indentOnInput: true,
                  }}
                />
              </Box>
              <Stack direction="row" justifyContent="flex-end">
                <IconButton
                  size="small"
                  onClick={() => removeCondition(idx)}
                  aria-label="Remove condition"
                >
                  <DeleteIcon width={14} height={14} />
                </IconButton>
              </Stack>
            </Stack>
          ))}
        </>
      )}

      <DividerLine width="100%" />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <InspectorSectionHeader>parameters</InspectorSectionHeader>
        <AddRowButton onClick={addParam} />
      </Stack>
      {Object.keys(params)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => (
          <Stack
            key={key}
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ padding: "4px 0" }}
          >
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              placeholder={`param ${key}`}
              value={params[key]}
              onChange={(e) => setParam(key, e.target.value)}
            />
            <IconButton size="small" onClick={() => removeParam(key)}>
              <DeleteIcon width={14} height={14} />
            </IconButton>
          </Stack>
        ))}
    </Box>
  )
}
