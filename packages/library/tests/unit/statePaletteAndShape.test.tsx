import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import {
  StateCodeBlockSVG,
  StateSVG,
} from "@/components/svgs/nodes/stateMachineDiagram/StateMachineSVGs"

const palette = dropElementConfigs[UMLDiagramType.StateMachineDiagram]

describe("state machine palette", () => {
  it("groups ready-made states, start/end markers and code", () => {
    expect(palette.filter((e) => e.sectionLabel).map((e) => e.sectionLabel)).toEqual([
      "States",
      "Start and end",
      "Code",
    ])
  })

  it("pairs the state rows with the code block functions they name", () => {
    const rows = palette.flatMap((e) => {
      const data = e.defaultData as { bodies?: { name: string }[]; fallbackBodies?: { name: string }[] }
      return [...(data.bodies ?? []), ...(data.fallbackBodies ?? [])]
    })
    const functions = palette
      .filter((e) => (e.type as string) === "StateCodeBlock")
      .map((e) => /def (\w+)\(/.exec((e.defaultData as { code: string }).code)?.[1])
    expect(rows.every((row) => functions.includes(row.name))).toBe(true)
    expect(functions).toContain("is_ready")
  })
})

describe("state drawing", () => {
  it("labels body rows `entry /` and fallback rows `fallback /`", () => {
    const { container } = render(
      <StateSVG
        id="preview"
        width={160}
        height={100}
        data={{
          name: "Checkout",
          bodies: [{ id: "b", name: "on_enter" }],
          fallbackBodies: [{ id: "f", name: "on_error" }],
        }}
      />
    )
    const rows = Array.from(container.querySelectorAll("foreignObject div")).map(
      (row) => row.textContent
    )
    expect(rows).toEqual(["entry /on_enter", "fallback /on_error"])
  })

  it("previews a code block with its own code", () => {
    const { container } = render(
      <StateCodeBlockSVG
        id="preview"
        width={240}
        height={100}
        data={{ code: "def is_ready(session):\n    return True", language: "python" }}
      />
    )
    expect(container.textContent).toContain("def is_ready(session):")
  })
})
