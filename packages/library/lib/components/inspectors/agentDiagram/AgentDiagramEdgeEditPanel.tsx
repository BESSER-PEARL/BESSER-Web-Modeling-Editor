import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { DividerLine, Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector body for the `AgentStateTransition` edge — the most
 * complex panel in the migration.
 *
 * Mode toggle:
 *   - `predefined`: pick a `predefinedType` from the known list. Renders
 *     intent-name / variable-operator-target / file-type sub-fields
 *     based on which `predefinedType` is selected.
 *   - `custom`:     pick a `custom.event`, edit `custom.condition[]`.
 *
 * Either branch can also edit the shared `name` and `params`. The edge
 * data shape mirrors `docs/source/migrations/uml-v4-shape.md`'s canonical
 * `AgentStateTransitionData`.
 *
 * Round-trip note: the migrator collapses the 5 legacy v3 transition
 * shapes onto this canonical form. The migrator preserves a `legacy` bag
 * + `legacyShape` discriminator so the v3 → v4 → v3 cycle round-trips
 * structurally — see `versionConverter.ts::migrateAgentDiagramV3ToV4`.
 */
type EdgeData = {
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

export const AgentDiagramEdgeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
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

  const update = (patch: Partial<EdgeData>) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  // Sub-field helpers.
  const setPredefined = (patch: Partial<NonNullable<EdgeData["predefined"]>>) =>
    update({ predefined: { ...predefined, ...patch } })

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
    setCustom({ condition: [...(custom.condition ?? []), ""] })
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

  const setVariableOp = (
    next: { variable?: string; operator?: string; targetValue?: string }
  ) => {
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
            <Typography variant="caption" sx={{ minWidth: 90 }}>
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

          {predefined.predefinedType === "when_intent_matched" ? (
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              label="intentName"
              value={predefined.intentName ?? ""}
              onChange={(e) => setPredefined({ intentName: e.target.value })}
            />
          ) : null}

          {predefined.predefinedType === "when_file_received" ? (
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              label="fileType"
              value={predefined.fileType ?? ""}
              onChange={(e) => setPredefined({ fileType: e.target.value })}
              placeholder="image/png, application/pdf, …"
            />
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
                onChange={(e) => setVariableOp({ targetValue: e.target.value })}
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
            <Typography variant="caption">conditions</Typography>
            <Typography
              variant="caption"
              sx={{ cursor: "pointer", color: "var(--apollon-primary)" }}
              onClick={addCondition}
            >
              + add
            </Typography>
          </Stack>
          {(custom.condition ?? []).map((c, idx) => (
            <Stack
              key={idx}
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ padding: "4px 0" }}
            >
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                placeholder="condition expression"
                value={c}
                onChange={(e) => setCondition(idx, e.target.value)}
              />
              <IconButton size="small" onClick={() => removeCondition(idx)}>
                <DeleteIcon width={14} height={14} />
              </IconButton>
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
        <Typography variant="caption">parameters</Typography>
        <Typography
          variant="caption"
          sx={{ cursor: "pointer", color: "var(--apollon-primary)" }}
          onClick={addParam}
        >
          + add
        </Typography>
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
