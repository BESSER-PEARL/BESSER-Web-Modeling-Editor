import { ComponentSubsystemNodeProps } from "@/types"
import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"
import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"
import { HeaderSwitchElement, TextField } from "@/components/ui"
import { LineageSourceLink } from "@/components/inspectors/shared"
import { DEFAULT_SUBSYSTEM_STEREOTYPE } from "@/nodes/componentDiagram/stereotypeDefaults"
import { useTranslation } from "@/i18n"

export const ComponentSubsystemEditPopover: React.FC<PopoverProps> = ({
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

  const nodeData = node.data as ComponentSubsystemNodeProps

  const update = (patch: Partial<ComponentSubsystemNodeProps>) =>
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
        update({
          isComponentSubsystemHeaderShown:
            !nodeData.isComponentSubsystemHeaderShown,
        })
      }
      isComponentHeaderShown={nodeData.isComponentSubsystemHeaderShown}
    />
  )

  return (
    <DefaultNodeEditPopover
      elementId={elementId}
      sideElements={[HeaderSwitcher]}
    >
      <TextField
        label={t("popup.stereotype", "Stereotype")}
        value={nodeData.stereotype ?? DEFAULT_SUBSYSTEM_STEREOTYPE}
        onChange={(e) => update({ stereotype: e.target.value })}
        placeholder={t(
          "packages.ComponentDiagram.SubsystemStereotypePlaceholder",
          "e.g. subsystem, solution"
        )}
        size="small"
        fullWidth
        sx={{ mt: 1.5 }}
      />
      <LineageSourceLink elementId={elementId} />
    </DefaultNodeEditPopover>
  )
}
