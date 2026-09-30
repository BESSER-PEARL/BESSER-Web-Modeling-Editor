import React from "react"
import { Stack, TextField as MuiTextField } from "@mui/material"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { useTranslation } from "@/i18n"

/**
 * Numeric width / height inputs for a node. Port of the v3
 * `uml-state-merge-node-update.tsx` "Width / Height" `SizeInput` pair: the
 * value is written straight to the React-Flow node's `width` / `height`
 * (v3 `element.bounds`). Non-numeric or non-positive input is ignored, like
 * v3's `parseInt` + `isNaN` guard.
 */
export const NodeSizeFields: React.FC<{
  elementId: string
  min?: number
  max?: number
}> = ({ elementId, min = 50, max = 1000 }) => {
  const { t } = useTranslation()
  const { node, setNodes } = useDiagramStore(
    useShallow((state) => ({
      node: state.nodes.find((n) => n.id === elementId),
      setNodes: state.setNodes,
    }))
  )
  if (!node) return null

  const width = node.width ?? node.measured?.width
  const height = node.height ?? node.measured?.height

  const onChange =
    (dimension: "width" | "height") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10)
      if (isNaN(value) || value <= 0) return
      setNodes((all) =>
        all.map((n) => (n.id === elementId ? { ...n, [dimension]: value } : n))
      )
    }

  return (
    <Stack direction="row" spacing={1}>
      <MuiTextField
        size="small"
        type="number"
        label={t("common.width", "Width")}
        value={width ?? ""}
        onChange={onChange("width")}
        inputProps={{ min, max, "aria-label": t("common.width", "Width") }}
        fullWidth
      />
      <MuiTextField
        size="small"
        type="number"
        label={t("common.height", "Height")}
        value={height ?? ""}
        onChange={onChange("height")}
        inputProps={{ min, max, "aria-label": t("common.height", "Height") }}
        fullWidth
      />
    </Stack>
  )
}
