import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { ClassEditPanel } from "@/components/inspectors/classDiagram/ClassEditPanel"
import { ClassNodeElement, ClassNodeProps } from "@/types"

// CodeMirror 6 needs DOM measurement APIs jsdom doesn't implement;
// substitute a plain textarea that forwards `value` / `onChange` so the
// def-line signature sync wiring can be exercised end-to-end.
vi.mock("@uiw/react-codemirror", async () => {
  const ReactModule = await import("react")
  return {
    default: (props: {
      value?: string
      onChange?: (value: string) => void
    }) =>
      ReactModule.createElement("textarea", {
        "data-testid": "codemirror",
        value: props.value ?? "",
        onChange: (e: { target: { value: string } }) =>
          props.onChange?.(e.target.value),
      }),
  }
})
vi.mock("@codemirror/lang-python", () => ({ python: () => [] }))

/**
 * Wiring tests for the class inspector authoring parity
 * restoration: Apollon shorthand parsing on the add/rename inputs,
 * structured method return-type / parameters persistence, the
 * optional↔id flag lock, the type-aware default-value widgets and the
 * def-line signature sync.
 */

const classNode = (
  data: Partial<ClassNodeProps> & { name?: string },
  id = "class-1"
): Node => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  width: 200,
  height: 110,
  data: {
    name: "Person",
    attributes: [],
    methods: [],
    ...data,
  },
})

const renderPanel = (nodes: Node[]) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <ClassEditPanel elementId="class-1" />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getData = (store: StoreApi<DiagramStore>): ClassNodeProps =>
  store.getState().nodes.find((n) => n.id === "class-1")!
    .data as ClassNodeProps

const getAttr = (store: StoreApi<DiagramStore>, idx = 0): ClassNodeElement =>
  getData(store).attributes[idx]

const getMethod = (store: StoreApi<DiagramStore>, idx = 0): ClassNodeElement =>
  getData(store).methods[idx]

describe("ClassEditPanel — attribute shorthand authoring", () => {
  it("parses '- price: float' typed into the add-attribute input", () => {
    const { store } = renderPanel([classNode({})])
    const input = screen.getByPlaceholderText(
      "+ Add attribute (Enter for auto-name)"
    )
    fireEvent.change(input, { target: { value: "- price: float" } })
    fireEvent.keyDown(input, { key: "Enter" })

    const attr = getAttr(store)
    expect(attr).toMatchObject({
      name: "price",
      visibility: "private",
      attributeType: "float",
    })
    // User-hit regression: must never collapse to 'pricefloat'.
    expect(attr.name).not.toContain("float")
  })

  it("keeps plain identifiers working unchanged on add", () => {
    const { store } = renderPanel([classNode({})])
    const input = screen.getByPlaceholderText(
      "+ Add attribute (Enter for auto-name)"
    )
    fireEvent.change(input, { target: { value: "speed" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(getAttr(store)).toMatchObject({
      name: "speed",
      visibility: "public",
      attributeType: "str",
    })
  })

  it("parses shorthand typed into an existing row's name field", () => {
    const { store } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "count",
            attributeType: "str",
            visibility: "public",
          },
        ],
      }),
    ])
    const nameField = screen.getByDisplayValue("count")
    fireEvent.change(nameField, { target: { value: "- total: int" } })

    expect(getAttr(store)).toMatchObject({
      id: "a1",
      name: "total",
      visibility: "private",
      attributeType: "int",
    })
  })

  it("renaming a row with a plain identifier never clobbers its type", () => {
    const { store } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "count",
            attributeType: "int",
            visibility: "private",
          },
        ],
      }),
    ])
    const nameField = screen.getByDisplayValue("count")
    fireEvent.change(nameField, { target: { value: "amount" } })

    expect(getAttr(store)).toMatchObject({
      id: "a1",
      name: "amount",
      visibility: "private",
      attributeType: "int",
    })
  })
})

describe("ClassEditPanel — method signature authoring", () => {
  it("parses a full signature typed into the add-method input", () => {
    const { store } = renderPanel([classNode({})])
    const input = screen.getByPlaceholderText("+ Add method (Enter)")
    fireEvent.change(input, {
      target: { value: "+ notify(channel: str, urgent: bool): bool" },
    })
    fireEvent.keyDown(input, { key: "Enter" })

    const method = getMethod(store)
    expect(method).toMatchObject({
      name: "notify",
      visibility: "public",
      returnType: "bool",
      attributeType: "bool",
    })
    expect(method.parameters).toHaveLength(2)
    expect(method.parameters![0]).toMatchObject({
      name: "channel",
      parameterType: "str",
    })
    expect(method.parameters![1]).toMatchObject({
      name: "urgent",
      parameterType: "bool",
    })
    expect(method.parameters![0].id).toBeTruthy()
  })

  it("parses signature shorthand typed into a method row name field", () => {
    const { store } = renderPanel([
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            parameters: [],
            implementationType: "none",
          },
        ],
      }),
    ])
    const nameField = screen.getByDisplayValue("run")
    fireEvent.change(nameField, { target: { value: "run(x: int): str" } })

    const method = getMethod(store)
    expect(method).toMatchObject({
      id: "m1",
      name: "run",
      returnType: "str",
      attributeType: "str",
    })
    expect(method.parameters).toHaveLength(1)
    expect(method.parameters![0]).toMatchObject({
      name: "x",
      parameterType: "int",
    })
  })

  it("commits a return type through the per-row dropdown", () => {
    const { store } = renderPanel([
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            parameters: [],
            implementationType: "none",
          },
        ],
      }),
    ])
    // The return-type Select displays the selected primitive's label.
    fireEvent.mouseDown(screen.getByText("any"))
    fireEvent.click(screen.getByRole("option", { name: "str (string)" }))

    expect(getMethod(store)).toMatchObject({
      returnType: "str",
      attributeType: "str",
    })
  })

  it("parses 'name: type' shorthand in the add-parameter input", () => {
    const { store } = renderPanel([
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            // Existing parameter keeps the settings section open.
            parameters: [{ id: "p0", name: "a", parameterType: "int" }],
            implementationType: "none",
          },
        ],
      }),
    ])
    const input = screen.getByPlaceholderText(
      "+ add parameter (name: type, Enter)"
    )
    fireEvent.change(input, { target: { value: "q: Integer" } })
    fireEvent.keyDown(input, { key: "Enter" })

    const method = getMethod(store)
    expect(method.parameters).toHaveLength(2)
    expect(method.parameters![1]).toMatchObject({
      name: "q",
      parameterType: "int",
    })
  })
})

describe("ClassEditPanel — def-line signature sync", () => {
  it("switching to Python Code seeds a def template and locks the name", () => {
    const { store } = renderPanel([
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            parameters: [{ id: "p0", name: "a" }],
            implementationType: "none",
          },
        ],
      }),
    ])
    fireEvent.mouseDown(screen.getByText("None (UML)"))
    fireEvent.click(screen.getByRole("option", { name: "Python Code" }))

    const method = getMethod(store)
    expect(method.implementationType).toBe("code")
    expect(method.code).toContain("def run(self):")
    // Signature is now sourced from the def line — name is read-only.
    expect(screen.getByDisplayValue("run")).toHaveAttribute("readonly")
  })

  it("editing the def line syncs name, params and return type", () => {
    const { store } = renderPanel([
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            parameters: [],
            implementationType: "code",
            code: "def run(self):\n    pass\n",
          },
        ],
      }),
    ])
    const editor = screen.getByTestId("codemirror")
    fireEvent.change(editor, {
      target: {
        value: "def transfer(self, amount: float) -> bool:\n    pass\n",
      },
    })

    const method = getMethod(store)
    expect(method).toMatchObject({
      name: "transfer",
      returnType: "bool",
      attributeType: "bool",
    })
    expect(method.parameters).toHaveLength(1)
    expect(method.parameters![0]).toMatchObject({
      name: "amount",
      parameterType: "float",
    })
  })
})

describe("ClassEditPanel — flag locks (optional ↔ id)", () => {
  it("disables 'optional' when the attribute is an identifier", () => {
    renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "ssn",
            attributeType: "str",
            visibility: "public",
            isId: true,
          },
        ],
      }),
    ])
    expect(screen.getByRole("checkbox", { name: "optional" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "id" })).toBeEnabled()
    expect(
      screen.getByRole("checkbox", { name: "external id" })
    ).toBeEnabled()
  })

  it("disables 'id' and 'external id' when the attribute is optional", () => {
    renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "nickname",
            attributeType: "str",
            visibility: "public",
            isOptional: true,
          },
        ],
      }),
    ])
    expect(screen.getByRole("checkbox", { name: "id" })).toBeDisabled()
    expect(
      screen.getByRole("checkbox", { name: "external id" })
    ).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "optional" })).toBeEnabled()
  })

  it("locks nothing when no conflicting flag is set", () => {
    renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "age",
            attributeType: "int",
            visibility: "public",
            isDerived: true,
          },
        ],
      }),
    ])
    expect(screen.getByRole("checkbox", { name: "id" })).toBeEnabled()
    expect(
      screen.getByRole("checkbox", { name: "external id" })
    ).toBeEnabled()
    expect(screen.getByRole("checkbox", { name: "optional" })).toBeEnabled()
  })
})

describe("ClassEditPanel — type-aware default-value widgets", () => {
  it("renders a true/false dropdown for bool attributes", () => {
    const { store } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "active",
            attributeType: "bool",
            visibility: "public",
            isDerived: true, // keeps the settings section open
          },
        ],
      }),
    ])
    fireEvent.mouseDown(screen.getByText("(none)"))
    fireEvent.click(screen.getByRole("option", { name: "true" }))

    expect(getAttr(store).defaultValue).toBe("true")
  })

  it("renders a native date input for date attributes", () => {
    const { container } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "birthday",
            attributeType: "date",
            visibility: "public",
            isDerived: true,
          },
        ],
      }),
    ])
    expect(container.querySelector('input[type="date"]')).not.toBeNull()
  })

  it("sanitizes the numeric input for int attributes", () => {
    const { store } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "age",
            attributeType: "int",
            visibility: "public",
            isDerived: true,
          },
        ],
      }),
    ])
    const input = screen.getByPlaceholderText("Enter integer...")
    fireEvent.change(input, { target: { value: "12a-" } })

    expect(getAttr(store).defaultValue).toBe("12-")
  })

  it("offers enumeration literals when the type is a sibling enum", () => {
    const { store } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "color",
            attributeType: "Color",
            visibility: "public",
            isDerived: true,
          },
        ],
      }),
      classNode(
        {
          name: "Color",
          stereotype: "Enumeration",
          attributes: [
            { id: "l1", name: "RED" },
            { id: "l2", name: "GREEN" },
          ],
          methods: [],
        },
        "enum-1"
      ),
    ])
    fireEvent.mouseDown(screen.getByText("(none)"))
    fireEvent.click(screen.getByRole("option", { name: "GREEN" }))

    expect(getAttr(store).defaultValue).toBe("GREEN")
  })

  it("clears the default value when the attribute type changes", () => {
    const { store } = renderPanel([
      classNode({
        attributes: [
          {
            id: "a1",
            name: "age",
            attributeType: "int",
            visibility: "public",
            defaultValue: "42",
          },
        ],
      }),
    ])
    // Type Select displays the primitive label for the current value.
    fireEvent.mouseDown(screen.getByText("int (integer)"))
    fireEvent.click(screen.getByRole("option", { name: "str (string)" }))

    const attr = getAttr(store)
    expect(attr.attributeType).toBe("str")
    expect(attr.defaultValue).toBeUndefined()
  })
})
