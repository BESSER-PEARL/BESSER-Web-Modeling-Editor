import { describe, it, expect } from "vitest"
import { formatDisplayName } from "@/utils/classifierMemberDisplay"

// A method was rendered like an attribute ("+ tesr: str", no parentheses).
// Method rows always read as a signature (develop b8e3c405, ported from the
// removed Apollon editor).
const method = (row: Parameters<typeof formatDisplayName>[0]) =>
  formatDisplayName(row, "UML", null, true)

describe("formatDisplayName for method rows", () => {
  it("renders a bare name as a method signature", () => {
    expect(method({ name: "tesr", attributeType: "str", visibility: "public" })).toBe(
      "+ tesr(): str"
    )
  })

  it("keeps structured parameters and appends the return type once", () => {
    expect(
      method({
        name: "find",
        attributeType: "Book",
        visibility: "public",
        parameters: [{ id: "p", name: "title", parameterType: "str" }],
      })
    ).toBe("+ find(title: str): Book")
    expect(method({ name: "count()", attributeType: "int", visibility: "public" })).toBe(
      "+ count(): int"
    )
  })

  it("turns a legacy 'name: type' method row into a signature", () => {
    expect(method({ name: "tesr: int", attributeType: "int", visibility: "public" })).toBe(
      "+ tesr(): int"
    )
  })

  it("uses the visibility and omits an empty return type", () => {
    expect(method({ name: "reset", attributeType: "", visibility: "private" })).toBe("- reset()")
  })

  it("leaves a legacy full signature untouched", () => {
    expect(method({ name: "+ notify(sms: str): any", attributeType: "any" })).toBe(
      "+ notify(sms: str): any"
    )
  })

  it("does not change attribute rows", () => {
    expect(
      formatDisplayName({ name: "title", attributeType: "str", visibility: "public" })
    ).toBe("+ title: str")
  })
})
