import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { ReactFlowProvider } from "@xyflow/react"
import { EdgeMiddleLabels } from "@/edges/labelTypes/EdgeMiddleLabels"

/**
 * The «stereotype» line of component / deployment edges is drawn by the
 * shared `EdgeMiddleLabels` (one line above the name, wherever the name's
 * obstacle-aware placement puts it) instead of a per-edge copy of that
 * placement.
 */

afterEach(cleanup)

const draw = (props: Partial<React.ComponentProps<typeof EdgeMiddleLabels>>) =>
  render(
    <ReactFlowProvider>
      <svg>
        <EdgeMiddleLabels
          pathMiddlePosition={{ x: 280, y: 40 }}
          isMiddlePathHorizontal
          textColor="#000"
          points={[
            { x: 160, y: 40 },
            { x: 400, y: 40 },
          ]}
          {...props}
        />
      </svg>
    </ReactFlowProvider>
  ).container

const stereotypeOf = (c: HTMLElement) => c.querySelector<SVGTextElement>('[data-testid="edge-stereotype-label"]')
const nameOf = (c: HTMLElement) => c.querySelector<SVGTextElement>('[data-testid="edge-middle-label"]')

describe("EdgeMiddleLabels stereotype", () => {
  it("draws «stereotype» one line above the name", () => {
    const c = draw({ label: "kv-store-conn", showRelationshipLabels: true, stereotype: "HTTPS" })
    const s = stereotypeOf(c)!
    const n = nameOf(c)!
    expect(s.textContent).toBe("«HTTPS»")
    expect(s.getAttribute("x")).toBe(n.getAttribute("x"))
    expect(s.getAttribute("text-anchor")).toBe(n.getAttribute("text-anchor"))
    expect(Number(n.getAttribute("y")) - Number(s.getAttribute("y"))).toBe(14)
    expect(s.getAttribute("pointer-events")).toBe("none")
  })

  it("draws «stereotype» above the midpoint when there is no name", () => {
    const c = draw({ stereotype: "delegates" })
    const s = stereotypeOf(c)!
    expect(nameOf(c)).toBeNull()
    expect(s.textContent).toBe("«delegates»")
    expect(s.getAttribute("x")).toBe("280")
    expect(s.getAttribute("y")).toBe("40")
    expect(s.getAttribute("text-anchor")).toBe("middle")
  })

  it("draws nothing without a name or a stereotype", () => {
    const c = draw({ label: "hidden", showRelationshipLabels: false })
    expect(c.querySelector("text")).toBeNull()
  })
})
