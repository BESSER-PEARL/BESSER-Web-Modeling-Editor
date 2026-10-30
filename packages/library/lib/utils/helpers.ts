import { DiagramEdgeType, UMLModel } from "@/typings"

export type AssessmentViewData = {
  elementId: string
  elementType: string
  name: string
  feedback: string
  score: number
}

// Returns the name and type of an element (node, edge, attribute, method, actionRow) by its ID
// It is needed for Artemis to display name and type of an element in the assessment view
// Artemis does not keep assessment data in model, so model.assessments cannot be used here
// Returns undefined if the element is not found
export const getAssessmentNameForArtemis = (
  elementId: string,
  model: UMLModel
): { name: string; type: string } | undefined => {
  // Search in nodes
  const foundNode = model.nodes.find((node) => node.id === elementId)
  if (foundNode) {
    return {
      name:
        (foundNode.data?.name as string) || foundNode.type || "Unnamed Node",
      type: foundNode.type,
    }
  }

  // Search in edges
  const foundEdge = model.edges.find((edge) => edge.id === elementId)
  if (foundEdge) {
    const sourceNode = model.nodes.find((node) => node.id === foundEdge.source)
    const targetNode = model.nodes.find((node) => node.id === foundEdge.target)
    const name = `${sourceNode?.data?.name || sourceNode?.type || ""} ${getEdgeTypeSymbol(foundEdge.type)} ${targetNode?.data?.name || targetNode?.type || ""}`

    return {
      name,
      type: foundEdge.type,
    }
  }

  // Search in node sub-elements (attributes, methods, actionRows)
  for (const node of model.nodes) {
    if (node.data) {
      // Check attributes
      if ("attributes" in node.data && Array.isArray(node.data.attributes)) {
        const foundAttribute = node.data.attributes.find(
          (attr) => attr.id === elementId
        )
        if (foundAttribute) {
          return {
            name: `${node.data.name}::${foundAttribute.name}`,
            type: "attribute",
          }
        }
      }

      // Check methods
      if ("methods" in node.data && Array.isArray(node.data.methods)) {
        const foundMethod = node.data.methods.find(
          (method) => method.id === elementId
        )
        if (foundMethod) {
          return {
            name: `${node.data.name}::${foundMethod.name}()`,
            type: "method",
          }
        }
      }

      // Check action rows
      if ("actionRows" in node.data && Array.isArray(node.data.actionRows)) {
        const foundActionRow = node.data.actionRows.find(
          (actionRow) => actionRow.id === elementId
        )
        if (foundActionRow) {
          return {
            name: `${node.data.name}::${foundActionRow.name}`,
            type: "actionRow",
          }
        }
      }
    }
  }

  // If not found, return undefined
  return undefined
}

export const getEdgeAssessmentDataById = (
  edgeId: string,
  model: UMLModel
): AssessmentViewData | undefined => {
  const foundEdge = model.edges.find((edge) => edge.id === edgeId)
  const edgeAssessment = model.assessments[edgeId]
  if (!foundEdge || !edgeAssessment) {
    return undefined
  }

  const sourceNode = model.nodes.find((node) => node.id === foundEdge.source)
  const targetNode = model.nodes.find((node) => node.id === foundEdge.target)
  const name = `${sourceNode?.data?.name || sourceNode?.type || ""} ${getEdgeTypeSymbol(foundEdge.type)} ${targetNode?.data?.name || targetNode?.type || ""}`

  return {
    elementId: edgeId,
    elementType: foundEdge.type,
    name,
    feedback: edgeAssessment.feedback ?? "",
    score: edgeAssessment.score,
  }
}

export const getNodeAssessmentDataByNodeElementId = (
  nodeElementId: string,
  model: UMLModel
): AssessmentViewData | undefined => {
  const nodeAssessment = model.assessments[nodeElementId]

  // No Assessment found
  if (!nodeAssessment) {
    return undefined
  }

  // Search the children of nodes to find the node with the given elementId
  const foundNode = model.nodes.find((node) => node.id === nodeElementId)

  if (foundNode) {
    return {
      elementId: nodeElementId,
      elementType: nodeAssessment.elementType,
      name: foundNode.data?.name as string,
      feedback: nodeAssessment.feedback ?? "",
      score: nodeAssessment.score,
    }
  }

  // Check all gradable sub-elements in nodes here (e.g. attributes, methods, actionRow) for the given elementId
  for (const node of model.nodes) {
    if (node.data) {
      // Check attributes
      if ("attributes" in node.data && Array.isArray(node.data.attributes)) {
        const foundAttribute = node.data.attributes.find(
          (attr) => attr.id === nodeElementId
        )
        if (foundAttribute) {
          return {
            elementId: nodeElementId,
            elementType: nodeAssessment.elementType,
            name: `${node.data.name}::${foundAttribute.name}`,
            feedback: nodeAssessment.feedback ?? "",
            score: nodeAssessment.score,
          }
        }
      }

      // Check methods
      if ("methods" in node.data && Array.isArray(node.data.methods)) {
        const foundMethod = node.data.methods.find(
          (method) => method.id === nodeElementId
        )
        if (foundMethod) {
          return {
            elementId: nodeElementId,
            elementType: nodeAssessment.elementType,
            name: `${node.data.name}::${foundMethod.name}()`,
            feedback: nodeAssessment.feedback ?? "",
            score: nodeAssessment.score,
          }
        }
      }

      // Check action rows
      if ("actionRows" in node.data && Array.isArray(node.data.actionRows)) {
        const foundActionRow = node.data.actionRows.find(
          (actionRow) => actionRow.id === nodeElementId
        )
        if (foundActionRow) {
          return {
            elementId: nodeElementId,
            elementType: nodeAssessment.elementType,
            name: `${node.data.name}::${foundActionRow.name}`,
            feedback: nodeAssessment.feedback ?? "",
            score: nodeAssessment.score,
          }
        }
      }
    }
  }

  // No node or sub-element with the given elementId found
  return undefined
}

const getEdgeTypeSymbol = (edgeType: DiagramEdgeType) => {
  const loweredType = edgeType.toLowerCase()

  if (loweredType.includes("bidirectional")) return "<->"
  if (loweredType.includes("unidirectional")) return "-->"
  if (loweredType.includes("aggregation")) return "--◇"
  if (loweredType.includes("inheritance")) return "--▶"
  if (loweredType.includes("dependency")) return "⋯⋯>"
  if (loweredType.includes("composition")) return "--◆"
  if (loweredType.includes("controlflow")) return "-->"
  if (loweredType.includes("include")) return "-->"
  if (loweredType.includes("extend")) return "-->"
  if (loweredType.includes("aggregation")) return "--◇"
  if (loweredType.includes("association")) return "—-"
  if (loweredType.includes("implementation")) return "⇨"
  if (loweredType.includes("generalization")) return "⇨"
  if (loweredType.includes("realization")) return "⋯⋯▶"
  if (loweredType.includes("link")) return "<—>"

  return "—-"
}
