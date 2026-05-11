/**
 * Display-name helpers for class/object/agent attribute and method rows.
 *
 * Extracted from
 * `v3 source: common/uml-classifier/uml-classifier-member.ts`
 * (`parseLegacyNameFormat`, `displayName`/`displayNameER`).
 *
 * Pure functions, no React, no Redux. Used by the inline class-row
 * renderer and by JSON round-trip migrators.
 */

import {
  SYMBOL_TO_VISIBILITY,
  VISIBILITY_SYMBOLS,
  Visibility,
  normalizeType,
} from "./typeNormalization"

/**
 * Subset of an `IUMLClassifierMember` needed for display formatting.
 * Marked partial because legacy data may omit fields.
 */
export interface ClassifierMemberLike {
  name: string
  attributeType?: string
  visibility?: Visibility
  isOptional?: boolean
  isDerived?: boolean
  isId?: boolean
  isExternalId?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any
}

/**
 * Parse legacy-format names like "+ counter: int" or "- doSomething(): str"
 * into the canonical { visibility, name, attributeType } triple.
 *
 * Method signatures contain '(' — split at the colon AFTER the last ')'
 * so parameter type colons (e.g. "param: str") are not misinterpreted.
 */
export const parseLegacyNameFormat = (
  name: string
): { visibility: Visibility; name: string; attributeType: string } => {
  const trimmed = name.trim()
  let visibility: Visibility = "public"
  let parsedName = ""
  let attributeType = "str"

  // Check for visibility symbol at the start
  let afterVisibility = trimmed
  const visibilityMatch = trimmed.match(/^([+\-#~])\s*/)
  if (visibilityMatch) {
    visibility = SYMBOL_TO_VISIBILITY[visibilityMatch[1]] || "public"
    afterVisibility = trimmed.substring(visibilityMatch[0].length)
  }

  if (afterVisibility.includes("(")) {
    const lastParen = afterVisibility.lastIndexOf(")")
    if (lastParen >= 0) {
      const signaturePart = afterVisibility.substring(0, lastParen + 1)
      const afterParen = afterVisibility.substring(lastParen + 1).trim()
      if (afterParen.startsWith(":")) {
        parsedName = signaturePart.trim()
        attributeType = normalizeType(afterParen.substring(1).trim())
      } else {
        parsedName = afterVisibility.trim()
        attributeType = ""
      }
    } else {
      // Has '(' but no ')' — malformed, store as-is
      parsedName = afterVisibility.trim()
      attributeType = ""
    }
  } else {
    // Attribute format: split at first colon
    const typeMatch = afterVisibility.match(/^([^:]+):\s*(.+)$/)
    if (typeMatch) {
      parsedName = typeMatch[1].trim()
      attributeType = normalizeType(typeMatch[2].trim())
    } else {
      parsedName = afterVisibility.trim()
    }
  }

  return { visibility, name: parsedName, attributeType }
}

/**
 * Format an Object-diagram attribute row for canvas rendering.
 *
 * Object instances don't carry visibility semantics, so we
 * render `name = value` (or just `name` when no value is present) with no
 * `+/-/#/~` symbol and no `{id}` markers. Mirrors v3
 * `UMLObjectAttribute.displayName` (`uml-object-attribute.ts:23-25`).
 */
export const formatObjectMember = (
  member: ClassifierMemberLike & { value?: unknown }
): string => {
  const hasValue =
    member.value !== undefined && member.value !== null && member.value !== ""
  return hasValue ? `${member.name} = ${member.value}` : member.name
}

/**
 * Format a classifier member for rendering in a class row.
 *
 * `mode === 'UML'` (default) — produces the standard UML form:
 *   `+ counter?: int = 0 {id}`
 *
 * `mode === 'ER'` — Chen-style: drops the visibility symbol and the
 *   `{id, external id}` suffix. Identifying attributes are marked with
 *   an underline at render time.
 *
 * When the parent class' `stereotype` is
 * `'Enumeration'`, attribute rows are enumeration *literals* — emit just
 * the bare name, no visibility prefix, no `: <Type>` suffix, no flag
 * markers. Mirrors v3 `uml-classifier-component.tsx` which branched on
 * the Enumeration stereotype to hide visibility / type columns.
 */
export const formatDisplayName = (
  member: ClassifierMemberLike,
  mode: "UML" | "ER" = "UML",
  stereotype?: string | null
): string => {
  const visSymbol = VISIBILITY_SYMBOLS[member.visibility ?? "public"] || "+"
  const derivedPrefix = member.isDerived ? "/" : ""
  const optionalMarker = member.isOptional ? "?" : ""
  const defaultSuffix =
    member.defaultValue !== undefined && member.defaultValue !== null && member.defaultValue !== ""
      ? ` = ${member.defaultValue}`
      : ""

  // Defensively strip a leading visibility symbol
  // and a trailing `: <type>` from the *raw* name when the structured
  // `attributeType` is also present. Legacy palette defaults shipped a
  // pre-formatted "+ attribute: Type" string in `name`; without this
  // strip the row would render as "+ + attribute: Type: str" once the
  // user toggled an id/optional/derived flag (which forces structured
  // formatting). This matches v3 `displayName` semantics — the name
  // stored is just the bare identifier; visibility / type live in the
  // structured fields.
  let bareName = member.name ?? ""
  if (/^[+\-#~]\s/.test(bareName)) {
    bareName = bareName.replace(/^[+\-#~]\s+/, "")
  }
  // Strip a legacy `: <Type>` suffix on attribute rows (no parentheses).
  // Method rows preserve their `(…)` signature in `name` and only carry
  // the return type via `attributeType`/`returnType`, so the regex
  // explicitly excludes that case.
  if (
    member.attributeType &&
    !bareName.includes("(") &&
    /:\s*[^:]+$/.test(bareName)
  ) {
    bareName = bareName.replace(/\s*:\s*[^:]+$/, "")
  }

  // Enumeration literals are bare names — no
  // visibility, no `: Type`, no flag markers, no default value. Return
  // early before any UML/ER decoration logic runs.
  if (stereotype === "Enumeration") {
    return bareName
  }

  if (mode === "ER") {
    if (bareName && member.attributeType) {
      return `${derivedPrefix}${bareName}${optionalMarker}: ${member.attributeType}${defaultSuffix}`
    }
    return `${derivedPrefix}${bareName}${optionalMarker}${defaultSuffix}`
  }

  // UML mode (default).
  // Id / externalId / derived / optional markers
  // are appended unconditionally when their flags are set. Previously
  // a legacy-format `name` ("+ x: Type") fell through a fast-path that
  // skipped the markers entirely — see history. The fast-path is gone:
  // we always strip the legacy prefix/suffix above and rebuild the
  // canonical UML display string here. This matches v3
  // `UMLClassifierMember.displayName` (`uml-classifier-member.ts:111`).
  if (bareName && member.attributeType) {
    const idMarkers = [
      member.isId ? "id" : null,
      member.isExternalId ? "external id" : null,
    ].filter(Boolean)
    const idSuffix = idMarkers.length > 0 ? ` {${idMarkers.join(", ")}}` : ""
    return `${visSymbol} ${derivedPrefix}${bareName}${optionalMarker}: ${member.attributeType}${defaultSuffix}${idSuffix}`
  }
  // Fallback to name for backward compatibility or simple display
  return bareName
}
