import { Box, Button, Stack } from "@mui/material"
import React from "react"
import { Typography } from "@/components/ui"
import { useTranslation } from "@/i18n"
import {
  ACTION_DESCRIPTION_KEYS,
  ActionSection,
  actionTypeLabel,
  PLACEHOLDER_ACTIONS,
  PLACEHOLDER_WARNING_KEYS,
  SECTION_ACTION_TYPES,
  SIMPLE_LEFT_COLUMN,
  SIMPLE_RIGHT_COLUMN,
  WS_REPLY_TYPES,
} from "./agentStateConstants"
import { Warning } from "./AgentActionEditor"

/**
 * "New action" picker below an AgentState body: section tabs (Simple / AI /
 * Data), the action-type options (two columns for simple replies, with the
 * placeholder-only kinds dimmed on the right), the selected type's
 * description, and the "Add <type>" button.
 *
 * Port of smart-gen `agent-state-new-action-picker.tsx`.
 */
export interface AgentNewActionPickerProps {
  section: ActionSection
  setSection: (section: ActionSection) => void
  selectedActionType: string
  setSelectedActionType: (replyType: string) => void
  hasWebSocketPlatform: boolean
  hasCompatibleChatLlm: boolean
  onAdd: () => void
}

const WARN = "#e04040"

const OptionButton: React.FC<{
  active: boolean
  warn?: boolean
  dimmed?: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, warn, dimmed, onClick, children }) => (
  <Button
    size="small"
    variant={active ? "contained" : "outlined"}
    onClick={onClick}
    sx={{
      justifyContent: "flex-start",
      textTransform: "none",
      fontSize: 11,
      py: 0.25,
      px: 0.75,
      minWidth: 0,
      opacity: dimmed && !active ? 0.65 : 1,
      ...(warn && !active ? { color: WARN, borderColor: `${WARN}88` } : {}),
    }}
  >
    {children}
  </Button>
)

export const AgentNewActionPicker: React.FC<AgentNewActionPickerProps> = ({
  section,
  setSection,
  selectedActionType,
  setSelectedActionType,
  hasWebSocketPlatform,
  hasCompatibleChatLlm,
  onAdd,
}) => {
  const { t } = useTranslation()
  const sectionTypes = SECTION_ACTION_TYPES[section]
  const tabs: { value: ActionSection; key: string; fallback: string }[] = [
    { value: "simple", key: "packages.AgentDiagram.simpleReplies", fallback: "Simple Replies" },
    { value: "ai", key: "packages.AgentDiagram.aiReplies", fallback: "AI Replies" },
    { value: "data", key: "packages.AgentDiagram.dataQuery", fallback: "Data Query" },
  ]
  const isWarn = (type: string) =>
    (WS_REPLY_TYPES.has(type) && !hasWebSocketPlatform) ||
    (type === "llm_chat" && !hasCompatibleChatLlm)

  const renderColumn = (types: string[], dimmed = false) => (
    <Stack direction="column" spacing={0.4}>
      {types.map((type) => (
        <OptionButton
          key={type}
          active={selectedActionType === type}
          warn={!dimmed && isWarn(type)}
          dimmed={dimmed}
          onClick={() => setSelectedActionType(type)}
        >
          {actionTypeLabel(t, type)}
        </OptionButton>
      ))}
    </Stack>
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
      <Typography
        variant="caption"
        sx={{ opacity: 0.55, textTransform: "uppercase" }}
      >
        {t("packages.AgentDiagram.newActionLabel", "New action")}
      </Typography>
      <Stack direction="row" spacing={0.5}>
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            size="small"
            variant={section === tab.value ? "contained" : "outlined"}
            onClick={() => setSection(tab.value)}
            sx={{ flex: 1, minWidth: 0, fontSize: 11, px: 0.5, textTransform: "none" }}
          >
            {t(tab.key, tab.fallback)}
          </Button>
        ))}
      </Stack>
      {section === "simple" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
          {renderColumn(SIMPLE_LEFT_COLUMN)}
          {renderColumn(SIMPLE_RIGHT_COLUMN, true)}
        </Box>
      ) : (
        renderColumn(sectionTypes)
      )}
      {ACTION_DESCRIPTION_KEYS[selectedActionType] && (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {t(ACTION_DESCRIPTION_KEYS[selectedActionType])}
        </Typography>
      )}
      {PLACEHOLDER_ACTIONS.has(selectedActionType) &&
        PLACEHOLDER_WARNING_KEYS[selectedActionType] && (
          <Warning>⚠ {t(PLACEHOLDER_WARNING_KEYS[selectedActionType])}</Warning>
        )}
      <Button
        size="small"
        variant="contained"
        onClick={onAdd}
        sx={{ mt: 0.5, textTransform: "none" }}
      >
        {`${t("packages.AgentDiagram.addAction", "Add")} ${actionTypeLabel(t, selectedActionType)}`}
      </Button>
    </Box>
  )
}
