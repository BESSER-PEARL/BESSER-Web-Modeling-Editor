import React from "react"
import { ClassType } from "@/types"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store"
import { PrimaryButton } from "./PrimaryButton"
import { useTranslation } from "@/i18n"

interface StereotypeButtonGroupProps {
  nodeId: string
  selectedStereotype?: ClassType
}

// `Interface` is temporarily hidden from the dropdown
// while v4 wiring catches up. The enum value is kept (so existing
// diagrams round-trip), but users can't pick it from the inspector.
const stereotypes: ClassType[] = [
  ClassType.Abstract,
  ClassType.Enumeration,
]

// develop `uml-classifier-update.tsx` labels.
const STEREOTYPE_LABEL_KEYS: Record<ClassType, string> = {
  [ClassType.Abstract]: "packages.ClassDiagram.AbstractClass",
  [ClassType.Interface]: "packages.ClassDiagram.Interface",
  [ClassType.Enumeration]: "packages.ClassDiagram.Enumeration",
}

export const StereotypeButtonGroup: React.FC<StereotypeButtonGroupProps> = ({
  nodeId,
  selectedStereotype,
}) => {
  const { t } = useTranslation()
  const { setNodes } = useDiagramStore(
    useShallow((state) => ({ setNodes: state.setNodes }))
  )

  const handleStereotypeChange = (stereotype: ClassType | undefined) => {
    const nextStereotype =
      selectedStereotype === stereotype ? undefined : stereotype

    const needsShrink = !!selectedStereotype && !nextStereotype
    const needExpand = !!nextStereotype && !selectedStereotype
    const nodeHeightDifference = needExpand ? 10 : needsShrink ? -10 : 0

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              stereotype: nextStereotype,
            },
            height: node.height! + nodeHeightDifference,
            measured: {
              ...node.measured,
              height: node.height! + nodeHeightDifference,
            },
          }
        }
        return node
      })
    )
  }

  return (
    <div
      className="bp-segmented"
      role="group"
      aria-label={t("popup.class.stereotype", "Stereotype")}
    >
      {stereotypes.map((stereotype) => (
        <PrimaryButton
          key={stereotype}
          isSelected={selectedStereotype === stereotype}
          onClick={() => handleStereotypeChange(stereotype)}
        >
          {t(STEREOTYPE_LABEL_KEYS[stereotype], stereotype)}
        </PrimaryButton>
      ))}
    </div>
  )
}
