import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
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
import { useTranslation } from "@/i18n"
import { InspectorSectionHeader, AddRowButton, useCodeMirrorTheme } from "../_shared"
import { getAgentComponentLists } from "./agentComponentLists"

/**
 * Inspector body for the `AgentStateTransition` edge.
 *
 * Port of smart-gen `agent-state-transition-update.tsx` (+ its constants):
 * a Predefined / Custom toggle, the condition / event option lists with a
 * description of the active option, and per-option parameters:
 *   - when_intent_matched → intent (from the agent Components page)
 *   - when_variable_operation_matched → variable / operator / target value
 *   - when_file_received → file types (free text, e.g. "pdf, txt")
 *   - when_form_submitted → form GUI (`formGuiId`, empty = any form)
 *   - custom GUIEvent → GUI (`guiEventGuiId`, empty = any GUI interaction)
 * Custom transitions also edit Python conditions (CodeMirror). Flip and
 * colors stay on the `EdgeStyleEditor` header; parameters are kept.
 *
 * Edge data is the canonical v4 `AgentStateTransitionData`
 * (`docs/source/migrations/uml-v4-shape.md`).
 */
type EdgeData = CustomEdgeProps & {
  name?: string
  transitionType?: "predefined" | "custom"
  predefined?: {
    predefinedType?: string
    intentName?: string
    fileType?: string
    formGuiId?: string
    conditionValue?:
      | string
      | { variable?: string; operator?: string; targetValue?: string }
  }
  custom?: {
    event?: string
    condition?: string[]
    guiEventGuiId?: string
  }
  params?: { [key: string]: string }
  legacyShape?: 1 | 2 | 3 | 4 | 5
  legacy?: Record<string, unknown>
}

/** smart-gen NEW_TRANSITION_PREDEFINED_TYPE. */
const NEW_TRANSITION_PREDEFINED_TYPE = "auto"

const PREDEFINED_TRANSITIONS = [
  {
    value: "auto",
    labelKey: "packages.AgentDiagram.transitionLabel.auto",
    label: "Auto",
    descriptionKey: "packages.AgentDiagram.transitionDesc.auto",
  },
  {
    value: "when_intent_matched",
    labelKey: "packages.AgentDiagram.transitionLabel.intentMatched",
    label: "Intent Matched",
    descriptionKey: "packages.AgentDiagram.transitionDesc.intentMatched",
  },
  {
    value: "when_no_intent_matched",
    labelKey: "packages.AgentDiagram.transitionLabel.noIntentMatched",
    label: "No Intent Matched",
    descriptionKey: "packages.AgentDiagram.transitionDesc.noIntentMatched",
  },
  {
    value: "when_variable_operation_matched",
    labelKey: "packages.AgentDiagram.transitionLabel.variableOperationMatched",
    label: "Variable Operation Matched",
    descriptionKey: "packages.AgentDiagram.transitionDesc.variableOperationMatched",
  },
  {
    value: "when_file_received",
    labelKey: "packages.AgentDiagram.transitionLabel.fileReceived",
    label: "File Received",
    descriptionKey: "packages.AgentDiagram.transitionDesc.fileReceived",
  },
  {
    value: "when_form_submitted",
    labelKey: "packages.AgentDiagram.transitionLabel.formSubmitted",
    label: "Form Submitted",
    descriptionKey: "packages.AgentDiagram.transitionDesc.formSubmitted",
  },
] as const

/** Event labels are technical identifiers (stored value = label). */
const CUSTOM_EVENTS = [
  { value: "None", descriptionKey: "packages.AgentDiagram.customEventDesc.none" },
  { value: "DummyEvent", descriptionKey: "packages.AgentDiagram.customEventDesc.dummyEvent" },
  { value: "WildcardEvent", descriptionKey: "packages.AgentDiagram.customEventDesc.wildcardEvent" },
  {
    value: "ReceiveMessageEvent",
    descriptionKey: "packages.AgentDiagram.customEventDesc.receiveMessageEvent",
  },
  {
    value: "ReceiveTextEvent",
    descriptionKey: "packages.AgentDiagram.customEventDesc.receiveTextEvent",
  },
  {
    value: "ReceiveJSONEvent",
    descriptionKey: "packages.AgentDiagram.customEventDesc.receiveJsonEvent",
  },
  {
    value: "ReceiveFileEvent",
    descriptionKey: "packages.AgentDiagram.customEventDesc.receiveFileEvent",
  },
  { value: "GUIEvent", descriptionKey: "packages.AgentDiagram.customEventDesc.guiEvent" },
] as const

const VARIABLE_OPERATORS = ["<", "<=", "==", ">=", ">", "!="] as const

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

const OptionButton: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <Button
    size="small"
    variant={active ? "contained" : "outlined"}
    onClick={onClick}
    sx={{ justifyContent: "flex-start", textTransform: "none", fontSize: 12, py: 0.25 }}
  >
    {children}
  </Button>
)

export const AgentDiagramEdgeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const codeTheme = useCodeMirrorTheme()
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
  const custom = data.custom ?? { event: "WildcardEvent", condition: [] }
  const params = data.params ?? {}

  const lists = getAgentComponentLists(nodes)
  const intentNames = lists.intents.map((i) => i.name)
  const selectedIntent = predefined.intentName ?? ""
  // A renamed/deleted intent leaves the transition pointing at nothing.
  const intentMissing =
    selectedIntent !== "" && !intentNames.includes(selectedIntent)
  const allGuis = lists.guis
  const formGuis = allGuis.filter((g) => g.is_form)

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

  const setPredefined = (
    patch: Partial<NonNullable<EdgeData["predefined"]>>
  ) =>
    update({
      transitionType: "predefined",
      predefined: { ...predefined, ...patch },
    })

  const setCustom = (patch: Partial<NonNullable<EdgeData["custom"]>>) =>
    update({ transitionType: "custom", custom: { ...custom, ...patch } })

  const setMode = (next: "predefined" | "custom") => {
    if (next === mode) return
    if (next === "predefined") {
      update({
        transitionType: "predefined",
        predefined: predefined.predefinedType
          ? predefined
          : { predefinedType: NEW_TRANSITION_PREDEFINED_TYPE },
      })
    } else {
      update({
        transitionType: "custom",
        custom: custom.event ? custom : { event: "WildcardEvent", condition: [] },
      })
    }
  }

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

  const setCondition = (idx: number, value: string) => {
    const next = [...(custom.condition ?? [])]
    next[idx] = value
    setCustom({ condition: next })
  }
  const addCondition = () =>
    setCustom({ condition: [...(custom.condition ?? []), CUSTOM_CONDITION_TEMPLATE] })
  const removeCondition = (idx: number) => {
    const next = [...(custom.condition ?? [])]
    next.splice(idx, 1)
    setCustom({ condition: next })
  }

  const cv = predefined.conditionValue
  const cvObj = typeof cv === "object" && cv !== null ? cv : {}
  const variable = cvObj.variable ?? ""
  const operator = cvObj.operator ?? ""
  const targetValue = cvObj.targetValue ?? ""
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

  const activePredefined =
    predefined.predefinedType || NEW_TRANSITION_PREDEFINED_TYPE
  const activePredefinedInfo = PREDEFINED_TRANSITIONS.find(
    (p) => p.value === activePredefined
  )
  const activeEvent = custom.event || "WildcardEvent"
  const activeEventInfo = CUSTOM_EVENTS.find((e) => e.value === activeEvent)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label={t("packages.AgentDiagram.StateTransition", "Transition")}
        sideElements={[
          <Tooltip key="flip" title={t("packages.AgentDiagram.flipTransition", "Flip source / target")}>
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
        label={t("packages.AgentDiagram.transitionName", "name")}
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <InspectorSectionHeader>
        {t("popup.agent.transition.type", "Transition Type")}
      </InspectorSectionHeader>
      <div
        className="bp-segmented"
        role="group"
        aria-label={t("popup.agent.transition.type", "Transition Type")}
      >
        <button
          type="button"
          className="bp-toggle"
          aria-pressed={mode !== "custom"}
          onClick={() => setMode("predefined")}
        >
          {t("popup.agent.transition.predefined", "Predefined transition")}
        </button>
        <button
          type="button"
          className="bp-toggle"
          aria-pressed={mode === "custom"}
          onClick={() => setMode("custom")}
        >
          {t("popup.agent.transition.custom", "Custom transition")}
        </button>
      </div>

      {mode !== "custom" ? (
        <>
          <InspectorSectionHeader>
            {t("popup.agent.transition.condition", "Condition")}
          </InspectorSectionHeader>
          <Stack direction="column" spacing={0.4}>
            {PREDEFINED_TRANSITIONS.map((p) => (
              <OptionButton
                key={p.value}
                active={activePredefined === p.value}
                onClick={() => setPredefined({ predefinedType: p.value })}
              >
                {t(p.labelKey, p.label)}
              </OptionButton>
            ))}
          </Stack>
          {activePredefinedInfo && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t(activePredefinedInfo.descriptionKey)}
            </Typography>
          )}

          {activePredefined === "when_intent_matched" &&
            (intentNames.length > 0 ||
            (predefined.intentName ?? "") !== "" ? (
              <>
                <Select
                  size="small"
                  fullWidth
                  displayEmpty
                  error={intentMissing}
                  value={selectedIntent}
                  onChange={(e) => setPredefined({ intentName: String(e.target.value) })}
                >
                  <MenuItem value="">
                    {t("popup.agent.transition.selectIntent", "Select intent")}
                  </MenuItem>
                  {intentNames.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                  {intentMissing && (
                    <MenuItem value={selectedIntent} sx={{ color: "error.main" }}>
                      {selectedIntent} (
                      {t("popup.agent.transition.missingIntentTag", "missing")})
                    </MenuItem>
                  )}
                </Select>
                {intentMissing && (
                  <Typography
                    variant="caption"
                    role="alert"
                    sx={{ color: "error.main" }}
                  >
                    {t(
                      "popup.agent.transition.missingIntent",
                      'Intent "{{name}}" does not exist. Pick an intent or add it on the Components page.',
                      { name: selectedIntent }
                    )}
                  </Typography>
                )}
              </>
            ) : (
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                placeholder={t("popup.agent.transition.selectIntent", "Select intent")}
                value={predefined.intentName ?? ""}
                onChange={(e) => setPredefined({ intentName: e.target.value })}
              />
            ))}

          {activePredefined === "when_variable_operation_matched" && (
            <Stack direction="column" spacing={0.75}>
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                placeholder={t("popup.agent.transition.variablePlaceholder", "Variable")}
                value={variable}
                onChange={(e) => setVariableOp({ variable: e.target.value })}
              />
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={operator}
                onChange={(e) => setVariableOp({ operator: String(e.target.value) })}
              >
                <MenuItem value="">
                  {t("popup.agent.transition.selectOperator", "Select operator")}
                </MenuItem>
                {VARIABLE_OPERATORS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                placeholder={t("popup.agent.transition.targetValuePlaceholder", "Target value")}
                value={targetValue}
                onChange={(e) => setVariableOp({ targetValue: e.target.value })}
              />
            </Stack>
          )}

          {activePredefined === "when_file_received" && (
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              placeholder={t(
                "popup.agent.transition.fileTypesPlaceholder",
                "File types, e.g. pdf, txt, json"
              )}
              value={predefined.fileType ?? ""}
              onChange={(e) => setPredefined({ fileType: e.target.value })}
            />
          )}

          {activePredefined === "when_form_submitted" &&
            (formGuis.length === 0 ? (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {t(
                  "popup.agent.transition.noFormGuis",
                  'No form GUIs defined. Create one with "is_form = True" in the Components page.'
                )}
              </Typography>
            ) : (
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={predefined.formGuiId ?? ""}
                onChange={(e) => setPredefined({ formGuiId: String(e.target.value) })}
              >
                <MenuItem value="">
                  {t("popup.agent.transition.anyFormSubmission", "Any form submission")}
                </MenuItem>
                {formGuis.map((g) => (
                  <MenuItem key={g.gui_id} value={g.gui_id}>
                    {g.gui_id}
                  </MenuItem>
                ))}
              </Select>
            ))}
        </>
      ) : (
        <>
          <InspectorSectionHeader>
            {t("popup.agent.transition.event", "Event")}
          </InspectorSectionHeader>
          <Stack direction="column" spacing={0.4}>
            {CUSTOM_EVENTS.map((ev) => (
              <OptionButton
                key={ev.value}
                active={activeEvent === ev.value}
                onClick={() => setCustom({ event: ev.value })}
              >
                {ev.value}
              </OptionButton>
            ))}
          </Stack>
          {activeEventInfo && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t(activeEventInfo.descriptionKey)}
            </Typography>
          )}

          {activeEvent === "GUIEvent" && (
            <>
              <InspectorSectionHeader>
                {t("popup.agent.transition.guiMessageId", "GUI (message_id)")}
              </InspectorSectionHeader>
              {allGuis.length === 0 ? (
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {t(
                    "popup.agent.transition.noGuis",
                    "No GUIs defined. Create one in the Components page."
                  )}
                </Typography>
              ) : (
                <Select
                  size="small"
                  fullWidth
                  displayEmpty
                  value={custom.guiEventGuiId ?? ""}
                  onChange={(e) => setCustom({ guiEventGuiId: String(e.target.value) })}
                >
                  <MenuItem value="">
                    {t("popup.agent.transition.anyGuiInteraction", "Any GUI interaction")}
                  </MenuItem>
                  {allGuis.map((g) => (
                    <MenuItem key={g.gui_id} value={g.gui_id}>
                      {g.gui_id}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </>
          )}

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <InspectorSectionHeader>
              {t("popup.agent.transition.conditions", "Conditions")}
            </InspectorSectionHeader>
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
              <Box
                sx={{
                  border: "1px solid var(--besser-gray, #ccc)",
                  borderRadius: "4px",
                  resize: "vertical",
                  overflow: "auto",
                  "& .cm-editor": { fontSize: "13px", minHeight: 120 },
                }}
              >
                <CodeMirror
                  theme={codeTheme}
                  value={c}
                  extensions={[python()]}
                  onChange={(v) => setCondition(idx, v)}
                  basicSetup={{ lineNumbers: true, tabSize: 4, indentOnInput: true }}
                />
              </Box>
              <Stack direction="row" justifyContent="flex-end">
                <Button
                  size="small"
                  color="error"
                  onClick={() => removeCondition(idx)}
                  aria-label={t("common.remove", "Remove")}
                  startIcon={<DeleteIcon width={14} height={14} />}
                  sx={{ textTransform: "none" }}
                >
                  {t("common.remove", "Remove")}
                </Button>
              </Stack>
            </Stack>
          ))}
          <Button
            size="small"
            variant="outlined"
            onClick={addCondition}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {t("popup.agent.transition.addCondition", "Add condition")}
          </Button>
        </>
      )}

      <DividerLine width="100%" />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <InspectorSectionHeader>
          {t("packages.AgentDiagram.parameters", "parameters")}
        </InspectorSectionHeader>
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
