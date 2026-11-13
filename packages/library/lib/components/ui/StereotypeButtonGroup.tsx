import React, { useState } from "react"
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
  const { nodes, edges, setNodesAndEdges } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      setNodesAndEdges: state.setNodesAndEdges,
    }))
  )
  // Enumerations cannot take part in relationships (new connections to
  // them are blocked), so turning a connected class into one first asks
  // to remove its relationships.
  const [confirmEnumeration, setConfirmEnumeration] = useState(false)
  const connectedEdgeIds = edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => e.id)

  const applyStereotype = (
    nextStereotype: ClassType | undefined,
    removeEdgeIds: string[] = []
  ) => {
    const needsShrink = !!selectedStereotype && !nextStereotype
    const needExpand = !!nextStereotype && !selectedStereotype
    const nodeHeightDifference = needExpand ? 10 : needsShrink ? -10 : 0

    const nextNodes = nodes.map((node) => {
      if (node.id !== nodeId) return node
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
    })
    const nextEdges = removeEdgeIds.length
      ? edges.filter((e) => !removeEdgeIds.includes(e.id))
      : edges
    // One store update, so the switch (and any removal) is one undo step.
    setNodesAndEdges(nextNodes, nextEdges)
    setConfirmEnumeration(false)
  }

  const handleStereotypeChange = (stereotype: ClassType | undefined) => {
    const nextStereotype =
      selectedStereotype === stereotype ? undefined : stereotype
    if (
      nextStereotype === ClassType.Enumeration &&
      connectedEdgeIds.length > 0
    ) {
      setConfirmEnumeration(true)
      return
    }
    applyStereotype(nextStereotype)
  }

  return (
    <>
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
      {confirmEnumeration && connectedEdgeIds.length > 0 && (
        <div
          role="alert"
          data-testid="enumeration-relationships-warning"
          style={{
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid color-mix(in srgb, var(--bp-danger) 35%, transparent)",
            background: "var(--bp-danger-soft)",
            color: "var(--bp-fg)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {t(
            "popup.class.enumerationRelationshipsWarning",
            "An enumeration cannot have relationships; other classes use it as an attribute type. Converting removes {{count}} relationship(s).",
            { count: connectedEdgeIds.length }
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="bp-text-btn"
              style={{ color: "var(--bp-danger)" }}
              onClick={() =>
                applyStereotype(ClassType.Enumeration, connectedEdgeIds)
              }
            >
              {t(
                "popup.class.enumerationConvertConfirm",
                "Remove and convert"
              )}
            </button>
            <button
              type="button"
              className="bp-text-btn"
              onClick={() => setConfirmEnumeration(false)}
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
