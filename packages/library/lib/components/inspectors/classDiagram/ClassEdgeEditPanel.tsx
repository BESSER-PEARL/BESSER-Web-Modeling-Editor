import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
  Tooltip,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { useSettingsStore } from "@/store/settingsStore"
import { DividerLine, EdgeStyleEditor, Typography } from "@/components/ui"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { PopoverProps } from "@/components/popovers/types"
import { SwapHorizIcon } from "@/components/Icon"
import { erCardinalityToUML } from "@/utils/multiplicity"
import { InspectorSectionHeader } from "../_shared"

/**
 * ClassEdgeEditPanel — single inspector body bound to all nine
 * v4 ClassDiagram edge types.
 *
 * Source-of-truth port: `packages/editor/.../uml-class-association-update.tsx`.
 *
 * Fields:
 *
 *   - `name` text field (hidden for `ClassInheritance` / `ClassRealization`,
 *     mirroring v3 which only showed `name` for non-inheritance edges).
 *   - flip action — swaps source/target/handle pairs in the store.
 *   - association-type Select with the v3 7-entry dropdown (Bi /
 *     Uni / Aggregation / Composition / Inheritance / Realization /
 *     Dependency). v3's source comments out four of these; the new
 *     library exposes all seven plus the OCL link +
 *     LinkRel for completeness when authoring those types.
 *   - per-end multiplicity textfield with v3 placeholder `'1..1'`,
 *     swapping to `'(1,1) or 1..1'` when `classNotation === 'ER'`.
 *   - per-end role textfield.
 *   - color editor (`strokeColor`, `textColor`) via `EdgeStyleEditor`,
 *     mirroring the v3 `<StylePane lineColor textColor>`.
 *
 * Registered for:
 *   ClassInheritance, ClassRealization, ClassComposition,
 *   ClassAggregation, ClassUnidirectional, ClassBidirectional,
 *   ClassDependency, ClassOCLLink, ClassLinkRel.
 */

// `ClassOCLLink` and `ClassLinkRel` are no longer manual
// picks — they're auto-detected by `useConnect` based on the endpoint
// node types. The user can't change a regular association into one of
// them, and a constraint-attached link can't accidentally be turned
// into something else. The current edge keeps its type; the dropdown
// just doesn't expose those two options.
// v3 BESSER parity: the editor only exposes the four edge kinds that
// have a BUML metamodel equivalent — bi / uni association, composition,
// and inheritance. Aggregation, Realization, and Dependency are masked
// from the picker (legacy fixtures still render correctly via
// ``edgeUtils.ts``; users just can't author new ones).
const EDGE_TYPE_OPTIONS = [
  { value: "ClassBidirectional", label: "Association (Bidirectional)" },
  { value: "ClassUnidirectional", label: "Association (Unidirectional)" },
  { value: "ClassComposition", label: "Composition" },
  { value: "ClassInheritance", label: "Inheritance" },
] as const

const NON_DIRECTIONAL_TYPES = new Set([
  "ClassInheritance",
  "ClassRealization",
])

export const ClassEdgeEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, edges, setEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setEdges: state.setEdges,
    }))
  )
  const classNotation = useSettingsStore((s) => s.classNotation)

  const edge = edges.find((e) => e.id === elementId)
  if (!edge) return null

  const data = (edge.data ?? {}) as CustomEdgeProps & {
    name?: string
    sourceMultiplicity?: string | null
    targetMultiplicity?: string | null
    sourceRole?: string | null
    targetRole?: string | null
  }

  const isInheritance = NON_DIRECTIONAL_TYPES.has(edge.type as string)

  // Resolve the source/target node names so the inspector section
  // headers carry the same orientation cue v3 provided.
  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)
  const sourceName =
    (sourceNode?.data as { name?: string } | undefined)?.name || "Source"
  const targetName =
    (targetNode?.data as { name?: string } | undefined)?.name || "Target"

  // Mirror the v3 ER hint: storage is always UML, but ER users get a
  // hint that `(1,N)` syntax is also accepted on input.
  const multiplicityPlaceholder =
    classNotation === "ER" ? "(1,1) or 1..1" : "1..1"

  const updateData = (patch: Partial<CustomEdgeProps & { name?: string }>) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  const handleEdgeTypeChange = (newType: string) => {
    setEdges((all) =>
      all.map((e) =>
        e.id === elementId ? { ...e, type: newType } : e
      )
    )
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

  const handleStyleFieldUpdate = (
    key: "strokeColor" | "textColor",
    value: string
  ) => {
    updateData({ [key]: value })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Color editor + flip action — matches v3 layout */}
      <EdgeStyleEditor
        edgeData={data}
        handleDataFieldUpdate={handleStyleFieldUpdate}
        label="Association"
        sideElements={[
          <Tooltip key="flip" title="Flip source / target">
            <IconButton size="small" onClick={handleSwap}>
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>,
        ]}
      />

      <DividerLine width="100%" />

      {/* v3 hides the name field for inheritance / realization */}
      {!isInheritance && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          label="Association name"
          value={data.name ?? ""}
          onChange={(e) => updateData({ name: e.target.value })}
        />
      )}

      {/* Hide the type-picker for auto-detected types
          (ClassOCLLink, ClassLinkRel). For regular associations the
          user can still choose between the seven canonical kinds. */}
      {edge.type !== "ClassOCLLink" && edge.type !== "ClassLinkRel" && (
        <Select
          size="small"
          value={edge.type ?? "ClassBidirectional"}
          onChange={(e) => handleEdgeTypeChange(String(e.target.value))}
        >
          {EDGE_TYPE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      )}

      {!isInheritance && (
        <>
          <DividerLine width="100%" />
          {/* Shared section header; #6: caption col 80 → 70. */}
          <InspectorSectionHeader>Source — {sourceName}</InspectorSectionHeader>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              multiplicity
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              autoFocus
              placeholder={multiplicityPlaceholder}
              value={data.sourceMultiplicity ?? ""}
              onChange={(e) =>
                updateData({ sourceMultiplicity: e.target.value })
              }
              onBlur={(e) =>
                updateData({
                  sourceMultiplicity: erCardinalityToUML(e.target.value),
                })
              }
            />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              role
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={data.sourceRole ?? ""}
              onChange={(e) => updateData({ sourceRole: e.target.value })}
            />
          </Stack>

          <DividerLine width="100%" />
          <InspectorSectionHeader>Target — {targetName}</InspectorSectionHeader>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              multiplicity
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              placeholder={multiplicityPlaceholder}
              value={data.targetMultiplicity ?? ""}
              onChange={(e) =>
                updateData({ targetMultiplicity: e.target.value })
              }
              onBlur={(e) =>
                updateData({
                  targetMultiplicity: erCardinalityToUML(e.target.value),
                })
              }
            />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              role
            </Typography>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              value={data.targetRole ?? ""}
              onChange={(e) => updateData({ targetRole: e.target.value })}
            />
          </Stack>
        </>
      )}
    </Box>
  )
}
