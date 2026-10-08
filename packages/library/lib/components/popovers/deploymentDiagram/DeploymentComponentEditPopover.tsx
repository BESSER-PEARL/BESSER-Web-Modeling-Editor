import { Box } from "@mui/material"
import { useDiagramStore } from "@/store"
import { DeploymentComponentProps } from "@/types"
import { useShallow } from "zustand/shallow"
import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"
import { HeaderSwitchElement } from "@/components"
import { LineageSourceLink, PresetField } from "@/components/inspectors/shared"
import { COMPONENT_STEREOTYPE_PRESETS } from "@/utils/agenticTokens"
import { DEFAULT_COMPONENT_STEREOTYPE } from "@/nodes/componentDiagram/stereotypeDefaults"
import { useTranslation } from "@/i18n"

export const DeploymentComponentEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({ setNodes: state.setNodes, nodes: state.nodes }))
  )

  const node = nodes.find((node) => node.id === elementId)
  if (!node) {
    return null
  }

  const nodeData = node.data as DeploymentComponentProps

  const update = (patch: Partial<DeploymentComponentProps>) =>
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
      <Box sx={{ mt: 1.5 }}>
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
      </Box>
      <LineageSourceLink elementId={elementId} />
    </DefaultNodeEditPopover>
  )
}
