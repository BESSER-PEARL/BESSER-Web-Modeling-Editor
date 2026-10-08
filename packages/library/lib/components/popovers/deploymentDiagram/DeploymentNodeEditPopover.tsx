import { useDiagramStore } from "@/store"
import { DeploymentNodeProps } from "@/types"
import { useShallow } from "zustand/shallow"
import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"
import { HeaderSwitchElement, TextField } from "@/components/ui"
import { LineageSourceLink } from "@/components/inspectors/shared"
import { useTranslation } from "@/i18n"

export const DeploymentNodeEditPopover: React.FC<PopoverProps> = ({
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

  const nodeData = node.data as DeploymentNodeProps

  const update = (patch: Partial<DeploymentNodeProps>) =>
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
      <TextField
        label={t("popup.stereotype", "Stereotype")}
        value={nodeData.stereotype ?? ""}
        onChange={(e) => update({ stereotype: e.target.value })}
        placeholder={t(
          "packages.DeploymentDiagram.DeploymentNodeStereotypePlaceholder",
          "e.g. node, device, executionEnvironment"
        )}
        size="small"
        fullWidth
        sx={{ mt: 1.5 }}
      />
      <LineageSourceLink elementId={elementId} />
    </DefaultNodeEditPopover>
  )
}
