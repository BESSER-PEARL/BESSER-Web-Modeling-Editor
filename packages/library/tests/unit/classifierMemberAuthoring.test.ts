import { describe, it, expect } from "vitest"
import {
  extractMethodSignatureFromCode,
  formatDisplayName,
  mergeParameterIds,
  parseAttributeInput,
  parseMethodInput,
  sanitizeIdentifier,
  sanitizeNumericDefault,
  selectDefaultValueWidget,
} from "@/utils/classifierMemberDisplay"

/**
 * Authoring helpers behind the class inspector — Apollon shorthand
 * parsing (develop `UMLClassifierMember.parseNameFormat`), def-line
 * signature extraction (develop `uml-classifier-method-update.tsx`
 * `handleCodeChange`), and the type-aware default-value widget selection
 * (develop `StylePane.renderDefaultValueInput`).
 */

describe("parseAttributeInput", () => {
  it("parses '+ name: type' shorthand into structured fields", () => {
    expect(parseAttributeInput("+ price: float")).toEqual({
      name: "price",
      visibility: "public",
      attributeType: "float",
    })
  })

  it("maps every visibility prefix symbol", () => {
    expect(parseAttributeInput("- secret: str").visibility).toBe("private")
    expect(parseAttributeInput("# guarded: int").visibility).toBe("protected")
    expect(parseAttributeInput("~ pkg: bool").visibility).toBe("package")
  })

  it("accepts the prefix without a following space", () => {
    expect(parseAttributeInput("+price: float")).toEqual({
      name: "price",
      visibility: "public",
      attributeType: "float",
    })
  })

  it("keeps plain identifiers unchanged with no structured fields", () => {
    expect(parseAttributeInput("speed")).toEqual({ name: "speed" })
  })

  it("does NOT mash shorthand into the name (user-hit regression)", () => {
    // Previously '+ price: float' was sanitized wholesale to 'pricefloat'.
    const parsed = parseAttributeInput("+ price: float")
    expect(parsed.name).toBe("price")
    expect(parsed.name).not.toContain("float")
  })

  it("normalizes type aliases like the v3 parser", () => {
    expect(parseAttributeInput("count: Integer").attributeType).toBe("int")
    expect(parseAttributeInput("label: String").attributeType).toBe("str")
  })

  it("sanitizes only what remains of the name after parsing", () => {
    expect(parseAttributeInput("+ pri ce!: float")).toEqual({
      name: "price",
      visibility: "public",
      attributeType: "float",
    })
  })

  it("treats a trailing colon (mid-typing) as a bare name", () => {
    expect(parseAttributeInput("price:")).toEqual({ name: "price" })
  })
})

describe("parseMethodInput", () => {
  it("parses a full signature into structured fields", () => {
    expect(parseMethodInput("+ notify(channel: str, urgent: bool): bool")).toEqual({
      name: "notify",
      visibility: "public",
      parameters: [
        { name: "channel", parameterType: "str" },
        { name: "urgent", parameterType: "bool" },
      ],
      returnType: "bool",
    })
  })

  it("reports explicit empty parens as an empty parameter list", () => {
    expect(parseMethodInput("reset()")).toEqual({
      name: "reset",
      parameters: [],
    })
  })

  it("does not report parameters for a plain identifier", () => {
    // No parens typed ⇒ existing structured params must not be clobbered.
    expect(parseMethodInput("run")).toEqual({ name: "run" })
  })

  it("maps the attribute-style colon form onto the return type", () => {
    expect(parseMethodInput("- calc: float")).toEqual({
      name: "calc",
      visibility: "private",
      returnType: "float",
    })
  })

  it("filters out 'self' and untyped parameter names stay bare", () => {
    expect(parseMethodInput("foo(self, a: int, b)")).toEqual({
      name: "foo",
      parameters: [{ name: "a", parameterType: "int" }, { name: "b" }],
    })
  })

  it("normalizes parameter and return type aliases", () => {
    expect(parseMethodInput("foo(a: Integer): String")).toEqual({
      name: "foo",
      parameters: [{ name: "a", parameterType: "int" }],
      returnType: "str",
    })
  })

  it("treats '(' without ')' (mid-typing) as a bare name", () => {
    expect(parseMethodInput("foo(")).toEqual({ name: "foo" })
  })

  it("splits the return type at the colon AFTER the last paren", () => {
    // Parameter type colons must not be misinterpreted as the return split.
    expect(parseMethodInput("foo(p: str)")).toEqual({
      name: "foo",
      parameters: [{ name: "p", parameterType: "str" }],
    })
  })
})

describe("extractMethodSignatureFromCode", () => {
  it("extracts name, params and return type from a python def line", () => {
    expect(
      extractMethodSignatureFromCode(
        "def transfer(self, amount: float) -> bool:\n    pass\n"
      )
    ).toEqual({
      name: "transfer",
      parameters: [{ name: "amount", parameterType: "float" }],
      returnType: "bool",
    })
  })

  it("omits the return type when the def line has no arrow", () => {
    expect(
      extractMethodSignatureFromCode("def run(self):\n    pass\n")
    ).toEqual({ name: "run", parameters: [] })
  })

  it("supports the BAL brace form (def name() -> ret {)", () => {
    expect(
      extractMethodSignatureFromCode(
        "def greet() -> nothing {\n    // body\n}\n"
      )
    ).toEqual({ name: "greet", parameters: [], returnType: "nothing" })
  })

  it("returns undefined when no def line is present", () => {
    expect(extractMethodSignatureFromCode("x = 1\n")).toBeUndefined()
    expect(extractMethodSignatureFromCode("")).toBeUndefined()
  })
})

describe("mergeParameterIds", () => {
  it("preserves ids of parameters matched by name", () => {
    const existing = [
      { id: "p1", name: "a", parameterType: "int" },
      { id: "p2", name: "b", parameterType: "str" },
    ]
    const merged = mergeParameterIds(existing, [
      { name: "b", parameterType: "bool" },
      { name: "a", parameterType: "int" },
    ])
    expect(merged).toEqual([
      { id: "p2", name: "b", parameterType: "bool" },
      { id: "p1", name: "a", parameterType: "int" },
    ])
  })

  it("falls back to positional matching for renamed parameters", () => {
    const existing = [{ id: "p1", name: "a", parameterType: "int" }]
    const merged = mergeParameterIds(existing, [
      { name: "renamed", parameterType: "int" },
    ])
    expect(merged[0].id).toBe("p1")
    expect(merged[0].name).toBe("renamed")
  })

  it("never assigns the same id twice and mints ids for new params", () => {
    const existing = [
      { id: "p1", name: "a" },
      { id: "p2", name: "b" },
    ]
    const merged = mergeParameterIds(existing, [
      { name: "x" },
      { name: "a" },
      { name: "c" },
    ])
    const ids = merged.map((p) => p.id)
    expect(new Set(ids).size).toBe(3)
    // 'a' keeps its original id even though 'x' took the positional slot 0.
    expect(merged[1].id).toBe("p1")
  })
})

describe("formatDisplayName — structured method signature display", () => {
  it("rebuilds the (params): returnType segment from structured fields", () => {
    // Develop fused "notify(channel: str, urgent: bool)" into the name;
    // v4 stores a bare name + parameters[] and must render identically.
    expect(
      formatDisplayName({
        name: "notify",
        attributeType: "bool",
        visibility: "public",
        parameters: [
          { name: "channel", parameterType: "str" },
          { name: "urgent", parameterType: "bool" },
        ],
      })
    ).toBe("+ notify(channel: str, urgent: bool): bool")
  })

  it("renders untyped parameters bare", () => {
    expect(
      formatDisplayName({
        name: "foo",
        attributeType: "any",
        visibility: "private",
        parameters: [{ name: "b" }],
      })
    ).toBe("- foo(b): any")
  })

  it("leaves legacy fused signatures in `name` untouched", () => {
    expect(
      formatDisplayName({
        name: "doSomething()",
        attributeType: "str",
        visibility: "public",
      })
    ).toBe("+ doSomething(): str")
  })

  it("appends no parens for an empty parameter list", () => {
    expect(
      formatDisplayName({
        name: "method1",
        attributeType: "any",
        visibility: "public",
        parameters: [],
      })
    ).toBe("+ method1: any")
  })

  it("keeps the signature in ER mode (no visibility symbol)", () => {
    expect(
      formatDisplayName(
        {
          name: "notify",
          attributeType: "bool",
          visibility: "public",
          parameters: [{ name: "channel", parameterType: "str" }],
        },
        "ER"
      )
    ).toBe("notify(channel: str): bool")
  })
})

describe("selectDefaultValueWidget", () => {
  it("prefers the enum-literal dropdown when literals are available", () => {
    expect(selectDefaultValueWidget("Color", ["RED", "GREEN"])).toBe("enum")
    // Even over a primitive type (matches develop's renderDefaultValueInput
    // ordering: the enum check runs before the type switch).
    expect(selectDefaultValueWidget("bool", ["YES", "NO"])).toBe("enum")
  })

  it("maps primitive types onto their widgets", () => {
    expect(selectDefaultValueWidget("int")).toBe("numeric")
    expect(selectDefaultValueWidget("float")).toBe("numeric")
    expect(selectDefaultValueWidget("bool")).toBe("boolean")
    expect(selectDefaultValueWidget("date")).toBe("date")
    expect(selectDefaultValueWidget("datetime")).toBe("datetime-local")
    expect(selectDefaultValueWidget("time")).toBe("time")
  })

  it("falls back to plain text for str / custom / missing types", () => {
    expect(selectDefaultValueWidget("str")).toBe("text")
    expect(selectDefaultValueWidget("MyClass")).toBe("text")
    expect(selectDefaultValueWidget(undefined)).toBe("text")
    expect(selectDefaultValueWidget("Color", [])).toBe("text")
  })
})

describe("sanitizeNumericDefault", () => {
  it("keeps digits, decimal point and minus sign only", () => {
    expect(sanitizeNumericDefault("12a.5-x")).toBe("12.5-")
    expect(sanitizeNumericDefault("abc")).toBe("")
    expect(sanitizeNumericDefault("-3.14")).toBe("-3.14")
  })
})

describe("sanitizeIdentifier", () => {
  it("strips everything outside [a-zA-Z0-9_]", () => {
    expect(sanitizeIdentifier("my attr-1!")).toBe("myattr1")
    expect(sanitizeIdentifier("ok_name")).toBe("ok_name")
  })
})
