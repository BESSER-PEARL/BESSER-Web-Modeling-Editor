import { Box } from "@mui/material"
import { ComponentNodeProps } from "@/types"
import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"
import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { HeaderSwitchElement } from "@/components"
import {
  ElementPickerField,
  LineageSourceLink,
  PresetField,
} from "@/components/inspectors/shared"
import { COMPONENT_STEREOTYPE_PRESETS } from "@/utils/agenticTokens"
import { DEFAULT_COMPONENT_STEREOTYPE } from "@/nodes/componentDiagram/stereotypeDefaults"
import { useTranslation } from "@/i18n"

/** Class-like targets a component can realize (v3 element type tokens). */
const REALIZES_TYPE_TOKENS = [
  "Class",
  "AbstractClass",
  "Interface",
  "Enumeration",
]

export const ComponentEditPopover: React.FC<PopoverProps> = ({
  elementId,
}: PopoverProps) => {
  const { t } = useTranslation()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const node = nodes.find((node) => node.id === elementId)
  if (!node) {
    return null
  }

  const nodeData = node.data as ComponentNodeProps

  const update = (patch: Partial<ComponentNodeProps>) =>
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === elementId
          ? { ...node, data: { ...node.data, ...patch } }
          : node
      )
    )

  const HeaderSwitcher = (
    <HeaderSwitchElement
      onClick={() =>
        update({ isComponentHeaderShown: !nodeData.isComponentHeaderShown })
      }
      isComponentHeaderShown={nodeData.isComponentHeaderShown}
    />
  )
  return (
    <DefaultNodeEditPopover
      elementId={elementId}
      sideElements={[HeaderSwitcher]}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1.5 }}>
        <PresetField
          label={t("popup.stereotype", "Stereotype")}
          value={nodeData.stereotype ?? DEFAULT_COMPONENT_STEREOTYPE}
          onChange={(stereotype) => update({ stereotype })}
          presets={COMPONENT_STEREOTYPE_PRESETS}
          placeholder={t(
            "packages.ComponentDiagram.ComponentStereotypePlaceholder",
            "e.g. solution, skill, external"
          )}
        />
        <ElementPickerField
          label={t("packages.ComponentDiagram.Realizes", "Realizes")}
          selected={nodeData.realizes ?? []}
          typeTokens={REALIZES_TYPE_TOKENS}
          onChange={(realizes) => update({ realizes })}
        />
      </Box>
      <LineageSourceLink elementId={elementId} />
    </DefaultNodeEditPopover>
  )
}
