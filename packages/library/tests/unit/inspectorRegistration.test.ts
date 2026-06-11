import { describe, expect, it } from "vitest"
import { getInspector } from "@/components/inspectors/registry"
// Side-effect imports — each barrel registers its panels against the
// central inspector registry exactly like the production bootstrap
// (`lib/components/inspectors/index.ts`).
import "@/components/inspectors/userDiagram"
import "@/components/inspectors/objectDiagram"
import {
  AgentDiagramEdgeEditPanel,
  AgentDiagramInitEdgeEditPanel,
} from "@/components/inspectors/agentDiagram"
import { StateMachineDiagramEdgeEditPanel } from "@/components/inspectors/stateMachineDiagram"
import { ObjectLinkEditPanel } from "@/components/inspectors/objectDiagram/ObjectLinkEditPanel"

// ---------------------------------------------------------------------------
// Edge inspector registration — hand-drawn edges on the BESSER
// behavioral diagrams must open the right edit panel. v3 parity:
// `UserModelLink` maps onto the same inspector as `ObjectLink`
// (`uml-relationships.ts`: UserModelLink → UMLObjectLink).
// ---------------------------------------------------------------------------
describe("edge inspector registration", () => {
  it("registers the ObjectLink-style panel for UserModelLink", () => {
    expect(getInspector("UserModelLink", "edit")).toBe(ObjectLinkEditPanel)
  })

  it("keeps ObjectLink on the same panel (shared inspector)", () => {
    expect(getInspector("ObjectLink", "edit")).toBe(ObjectLinkEditPanel)
  })

  it("registers the agent transition panels", () => {
    expect(getInspector("AgentStateTransition", "edit")).toBe(
      AgentDiagramEdgeEditPanel
    )
    expect(getInspector("AgentStateTransitionInit", "edit")).toBe(
      AgentDiagramInitEdgeEditPanel
    )
  })

  it("registers the state-machine transition panel", () => {
    expect(getInspector("StateTransition", "edit")).toBe(
      StateMachineDiagramEdgeEditPanel
    )
  })
})
