import { Box, IconButton, Stack } from "@mui/material"
import React from "react"
import { Typography } from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { useTranslation } from "@/i18n"

/**
 * Presentational collapsible "action card" for the AgentState body /
 * fallback editors. Factored out of `AgentStateEditPanel.tsx` so the
 * panel stays focused on data wiring rather than growing past ~1000
 * lines inlining develop's full JSX tree.
 *
 * Develop source: `agent-state-diagram/agent-state/agent-state-update.tsx`
 * `renderPredefinedBody` ActionCard render (L736-806) + the styled
 * components `ActionCard` / `ActionCardHeader` / `DragHandle` /
 * `ActionTypeBadge` / `ActionSummary` / `IconBtn` / `ActionBody`
 * (L127-201).
 *
 * One card renders: a drag handle (native HTML5 DnD via the `draggable`
 * + `onDrag*` props threaded from the parent), an uppercase type badge
 * (red when `warning`), a one-line summary (computed by the parent),
 * an expand/collapse toggle, and a delete button. When `expanded`, its
 * `children` render the type-specific field editor.
 */
export interface AgentActionCardProps {
  /** Uppercase type badge label (e.g. "LLM", "Markdown"). */
  label: string
  /** One-line collapsed summary (parent-computed `getActionSummary`). */
  summary: string
  /** Render the badge in the warning color (missing LLM / platform). */
  warning?: boolean
  expanded: boolean
  dragging?: boolean
  dragOver?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
  onToggleExpand: () => void
  onDelete: () => void
  children?: React.ReactNode
}

const WARNING_COLOR = "#e04040"

export const AgentActionCard: React.FC<AgentActionCardProps> = ({
  label,
  summary,
  warning,
  expanded,
  dragging,
  dragOver,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleExpand,
  onDelete,
  children,
}) => {
  const { t } = useTranslation()
  // smart-gen a46002d5: drag is armed only while the mouse is pressed on
  // the handle, so clicking into a text field never starts a drag.
  const [dragArmed, setDragArmed] = React.useState(false)
  return (
    <Box
      draggable={!!draggable && dragArmed}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={(e) => {
        setDragArmed(false)
        onDragEnd?.(e)
      }}
      sx={{
        border: "1px solid",
        borderColor: dragOver
          ? "primary.main"
          : "var(--besser-gray, rgba(0,0,0,0.2))",
        borderRadius: "4px",
        mb: 0.75,
        opacity: dragging ? 0.4 : 1,
        backgroundColor: dragOver ? "action.hover" : "transparent",
        transition: "border-color 0.15s",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ px: 0.75, py: 0.5 }}
      >
        <Box
          component="span"
          title={t("packages.AgentDiagram.draggToReorder", "Drag to reorder")}
          onMouseDown={() => setDragArmed(true)}
          onMouseUp={() => setDragArmed(false)}
          sx={{
            cursor: "grab",
            opacity: 0.4,
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
            userSelect: "none",
            "&:hover": { opacity: 0.9 },
            "&:active": { cursor: "grabbing" },
          }}
        >
          ⠿
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            px: 0.6,
            py: 0.25,
            borderRadius: "3px",
            flexShrink: 0,
            backgroundColor: "var(--besser-gray, rgba(0,0,0,0.08))",
            color: warning ? WARNING_COLOR : "inherit",
          }}
        >
          {label}
        </Box>
        <Typography
          variant="caption"
          title={summary}
          sx={{
            flex: 1,
            opacity: 0.75,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </Typography>
        <IconButton
          size="small"
          title={
            expanded
              ? t("packages.AgentDiagram.collapse", "Collapse")
              : t("packages.AgentDiagram.expand", "Expand")
          }
          onClick={onToggleExpand}
          aria-label={
            expanded
              ? t("packages.AgentDiagram.collapse", "Collapse")
              : t("packages.AgentDiagram.expand", "Expand")
          }
          sx={{ flexShrink: 0, fontSize: 13, opacity: 0.55, "&:hover": { opacity: 1 } }}
        >
          {expanded ? "▲" : "✎"}
        </IconButton>
        <IconButton
          size="small"
          title={t("packages.AgentDiagram.deleteAction", "Delete action")}
          onClick={onDelete}
          aria-label={t("packages.AgentDiagram.deleteAction", "Delete action")}
          sx={{ flexShrink: 0, opacity: 0.55, "&:hover": { opacity: 1 } }}
        >
          <DeleteIcon width={14} height={14} />
        </IconButton>
      </Stack>
      {expanded && (
        <Box
          sx={{
            px: 1,
            pb: 1,
            borderTop: "1px solid var(--besser-gray, rgba(0,0,0,0.12))",
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  )
}
