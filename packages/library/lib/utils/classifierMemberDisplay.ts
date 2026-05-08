/**
 * Display-name helpers for class/object/agent attribute and method rows.
 *
 * Extracted from
 * `packages/editor/src/main/packages/common/uml-classifier/uml-classifier-member.ts`
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
 * Format a classifier member for rendering in a class row.
 *
 * `mode === 'UML'` (default) — produces the standard UML form:
 *   `+ counter?: int = 0 {id}`
 *
 * `mode === 'ER'` — Chen-style: drops the visibility symbol and the
 *   `{id, external id}` suffix. Identifying attributes are marked with
 *   an underline at render time.
 */
export const formatDisplayName = (
  member: ClassifierMemberLike,
  mode: "UML" | "ER" = "UML"
): string => {
  const visSymbol = VISIBILITY_SYMBOLS[member.visibility ?? "public"] || "+"
  const derivedPrefix = member.isDerived ? "/" : ""
  const optionalMarker = member.isOptional ? "?" : ""
  const defaultSuffix =
    member.defaultValue !== undefined && member.defaultValue !== null && member.defaultValue !== ""
      ? ` = ${member.defaultValue}`
      : ""

  if (mode === "ER") {
    if (member.name && member.attributeType) {
      return `${derivedPrefix}${member.name}${optionalMarker}: ${member.attributeType}${defaultSuffix}`
    }
    return `${derivedPrefix}${member.name}${optionalMarker}${defaultSuffix}`
  }

  // UML mode (default)
  if (member.name && member.attributeType) {
    // Check if name already contains visibility symbol (legacy format)
    if (/^[+\-#~]\s/.test(member.name)) {
      return member.name
    }
    const idMarkers = [
      member.isId ? "id" : null,
      member.isExternalId ? "external id" : null,
    ].filter(Boolean)
    const idSuffix = idMarkers.length > 0 ? ` {${idMarkers.join(", ")}}` : ""
    return `${visSymbol} ${derivedPrefix}${member.name}${optionalMarker}: ${member.attributeType}${defaultSuffix}${idSuffix}`
  }
  // Fallback to name for backward compatibility or simple display
  return member.name
}
