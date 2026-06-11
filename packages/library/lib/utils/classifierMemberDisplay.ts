/**
 * Display-name and authoring helpers for class/object/agent attribute and
 * method rows.
 *
 * Extracted from
 * `v3 source: common/uml-classifier/uml-classifier-member.ts`
 * (`parseLegacyNameFormat`, `displayName`/`displayNameER`) and
 * `uml-classifier-method-update.tsx` (def-line signature extraction).
 *
 * Pure functions, no React, no Redux. Used by the inline class-row
 * renderer, the class inspector authoring inputs, and JSON round-trip
 * migrators.
 */

import { v4 as uuidv4 } from "uuid"
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
  /**
   * Structured method parameters. When present (method rows authored via
   * the inspector store a bare `name` + `parameters[]` instead of the
   * legacy fused "name(p: type)" string), the display formatter rebuilds
   * the `(p: type, …)` segment so the canvas renders the full signature
   * exactly like develop's fused-name `displayName` did.
   */
  parameters?: { name: string; parameterType?: string }[]
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
  // Legacy method rows preserve their `(…)` signature in `name` and only
  // carry the return type via `attributeType`/`returnType`, so the regex
  // explicitly excludes that case.
  if (
    member.attributeType &&
    !bareName.includes("(") &&
    /:\s*[^:]+$/.test(bareName)
  ) {
    bareName = bareName.replace(/\s*:\s*[^:]+$/, "")
  }

  // Method rows authored through the v4 inspector store a bare `name`
  // plus structured `parameters[]` — rebuild the `(p: type, …)` segment
  // so the canvas renders the full signature, matching develop where the
  // fused name string ("notify(channel: str)") carried it implicitly.
  // Legacy fused names (already containing `(`) are left untouched.
  if (
    member.parameters &&
    member.parameters.length > 0 &&
    !bareName.includes("(")
  ) {
    const paramList = member.parameters
      .map((p) => (p.parameterType ? `${p.name}: ${p.parameterType}` : p.name))
      .join(", ")
    bareName = `${bareName}(${paramList})`
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

/* -------------------------------------------------------------------------- */
/* Authoring helpers (class inspector inputs)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Strip everything that isn't a Python-identifier character. Mirrors the
 * v3 rename sanitiser (`uml-classifier-update.tsx:475`). Applied to what
 * remains of a name AFTER shorthand parsing — never to the raw input,
 * which would destroy the `+ name: type` markers.
 */
export const sanitizeIdentifier = (raw: string): string =>
  raw.replace(/[^a-zA-Z0-9_]/g, "")

export interface ParsedAttributeInput {
  /** Sanitized bare identifier left after shorthand parsing. */
  name: string
  /** Only set when the input carried a `+ - # ~` visibility prefix. */
  visibility?: Visibility
  /** Only set when the input carried a `: <type>` suffix (normalized). */
  attributeType?: string
}

/**
 * Parse the Apollon attribute shorthand (`"+ price: float"`) typed into
 * the inspector's add-attribute input or a row name field. Mirrors v3
 * `UMLClassifierMember.parseNameFormat` (`uml-classifier-member.ts:158`),
 * but unlike the legacy parser it only reports `visibility` /
 * `attributeType` when they are explicitly present in the input — so
 * committing a plain identifier never clobbers the structured fields
 * already stored on the row.
 */
export const parseAttributeInput = (raw: string): ParsedAttributeInput => {
  const trimmed = raw.trim()
  let visibility: Visibility | undefined
  let rest = trimmed
  const visibilityMatch = trimmed.match(/^([+\-#~])\s*/)
  if (visibilityMatch) {
    visibility = SYMBOL_TO_VISIBILITY[visibilityMatch[1]]
    rest = trimmed.substring(visibilityMatch[0].length)
  }
  let name = rest
  let attributeType: string | undefined
  const typeMatch = rest.match(/^([^:]+):\s*(.+)$/)
  if (typeMatch) {
    name = typeMatch[1]
    attributeType = normalizeType(typeMatch[2].trim())
  }
  return {
    name: sanitizeIdentifier(name),
    ...(visibility && { visibility }),
    ...(attributeType !== undefined && { attributeType }),
  }
}

export interface ParsedMethodParameter {
  name: string
  parameterType?: string
}

export interface ParsedMethodInput {
  /** Sanitized bare identifier left after shorthand parsing. */
  name: string
  /** Only set when the input carried a `+ - # ~` visibility prefix. */
  visibility?: Visibility
  /**
   * Only set when the input carried a `(...)` list — `[]` means the user
   * typed explicit empty parens. Undefined ⇒ don't touch existing params.
   */
  parameters?: ParsedMethodParameter[]
  /** Only set when the input carried a `: <type>` return suffix. */
  returnType?: string
}

/**
 * Split a `(`-delimited parameter list (`"self, a: int, b"`) into
 * structured rows. `self` is dropped, mirroring the v3 def-line
 * extraction (`uml-classifier-method-update.tsx:268-276`).
 */
const parseParameterList = (raw: string): ParsedMethodParameter[] =>
  raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== "self")
    .map((p) => {
      const colonIdx = p.indexOf(":")
      if (colonIdx >= 0) {
        const ptype = p.substring(colonIdx + 1).trim()
        return {
          name: sanitizeIdentifier(p.substring(0, colonIdx)),
          ...(ptype && { parameterType: normalizeType(ptype) }),
        }
      }
      return { name: sanitizeIdentifier(p) }
    })
    .filter((p) => p.name.length > 0)

/**
 * Parse the Apollon method shorthand (`"+ name(p: type): ret"`) typed
 * into the inspector's add-method input or a method row name field.
 * Mirrors v3 `UMLClassifierMember.parseNameFormat` (split at the colon
 * AFTER the last `)` so parameter type colons aren't misinterpreted),
 * with the signature exploded into structured `parameters[]` /
 * `returnType` instead of being string-fused into the name.
 */
export const parseMethodInput = (raw: string): ParsedMethodInput => {
  const trimmed = raw.trim()
  let visibility: Visibility | undefined
  let rest = trimmed
  const visibilityMatch = trimmed.match(/^([+\-#~])\s*/)
  if (visibilityMatch) {
    visibility = SYMBOL_TO_VISIBILITY[visibilityMatch[1]]
    rest = trimmed.substring(visibilityMatch[0].length)
  }

  if (rest.includes("(")) {
    const openParen = rest.indexOf("(")
    const lastParen = rest.lastIndexOf(")")
    if (lastParen > openParen) {
      const afterParen = rest.substring(lastParen + 1).trim()
      const returnType = afterParen.startsWith(":")
        ? normalizeType(afterParen.substring(1).trim())
        : undefined
      return {
        name: sanitizeIdentifier(rest.substring(0, openParen)),
        ...(visibility && { visibility }),
        parameters: parseParameterList(
          rest.substring(openParen + 1, lastParen)
        ),
        ...(returnType !== undefined && { returnType }),
      }
    }
    // Has '(' but no ')' — malformed / mid-typing, treat as a bare name.
    return {
      name: sanitizeIdentifier(rest),
      ...(visibility && { visibility }),
    }
  }

  // No parens: attribute-style "name: type" maps the type onto the
  // return type (v3 parsed it into `attributeType`, which is the method
  // return type in the legacy shape).
  const typeMatch = rest.match(/^([^:]+):\s*(.+)$/)
  if (typeMatch) {
    return {
      name: sanitizeIdentifier(typeMatch[1]),
      ...(visibility && { visibility }),
      returnType: normalizeType(typeMatch[2].trim()),
    }
  }
  return {
    name: sanitizeIdentifier(rest),
    ...(visibility && { visibility }),
  }
}

export interface ExtractedMethodSignature {
  name: string
  parameters: ParsedMethodParameter[]
  returnType?: string
}

/**
 * Extract the method signature from the first python/BAL
 * `def name(params) -> ret:` (or BAL `... -> ret {`) line of a
 * code-implemented method body. Regexes ported verbatim from v3
 * `uml-classifier-method-update.tsx:handleCodeChange` (260-276).
 * Returns undefined when no `def <name>(...)` line is present.
 */
export const extractMethodSignatureFromCode = (
  code: string
): ExtractedMethodSignature | undefined => {
  const methodMatch = code.match(/def\s+(\w+)\s*\(([^)]*)\)/)
  if (!methodMatch || !methodMatch[1]) return undefined
  const returnTypeMatch = code.match(
    /def\s+\w+\s*\([^)]*\)\s*->\s*([^:{]+)\s*[:{]/
  )
  return {
    name: methodMatch[1],
    parameters: parseParameterList(methodMatch[2] ?? ""),
    ...(returnTypeMatch && {
      returnType: normalizeType(returnTypeMatch[1].trim()),
    }),
  }
}

/** Structural shape of `ClassifierMethodParameter` (avoids a `@/types` import). */
export interface MethodParameterLike {
  id: string
  name: string
  parameterType?: string
  defaultValue?: unknown
}

/**
 * Reconcile a parsed parameter list with the structured rows already on
 * a method, preserving existing parameter ids (matched by name first,
 * then by position) so Yjs sync and round-trips stay stable while the
 * user retypes a signature.
 */
export const mergeParameterIds = (
  existing: MethodParameterLike[],
  parsed: ParsedMethodParameter[]
): MethodParameterLike[] => {
  const used = new Set<string>()
  // Pass 1: reserve ids for exact name matches first, so an inserted /
  // renamed parameter at an earlier position can't steal them.
  const nameMatches = parsed.map((p) => {
    const match = existing.find((e) => e.name === p.name && !used.has(e.id))
    if (match) used.add(match.id)
    return match
  })
  // Pass 2: positional fallback for the rest, fresh ids for new params.
  return parsed.map((p, index) => {
    let match = nameMatches[index]
    if (!match) {
      const positional = existing[index]
      if (positional && !used.has(positional.id)) {
        match = positional
        used.add(positional.id)
      }
    }
    return {
      id: match?.id ?? uuidv4(),
      name: p.name,
      ...(p.parameterType !== undefined && {
        parameterType: p.parameterType,
      }),
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Default-value widget selection                                              */
/* -------------------------------------------------------------------------- */

export type DefaultValueWidget =
  | "enum"
  | "boolean"
  | "numeric"
  | "date"
  | "datetime-local"
  | "time"
  | "text"

/**
 * Pick the default-value input widget for an attribute row. Mirrors v3
 * `StylePane.renderDefaultValueInput` (`style-pane.tsx:145`):
 * enumeration literals win over everything, then int/float (numeric),
 * bool (true/false dropdown), date / datetime / time (native inputs),
 * plain text otherwise.
 */
export const selectDefaultValueWidget = (
  attributeType: string | undefined,
  enumerationLiterals?: string[]
): DefaultValueWidget => {
  if (enumerationLiterals && enumerationLiterals.length > 0) return "enum"
  switch (attributeType) {
    case "int":
    case "float":
      return "numeric"
    case "bool":
      return "boolean"
    case "date":
      return "date"
    case "datetime":
      return "datetime-local"
    case "time":
      return "time"
    default:
      return "text"
  }
}

/**
 * v3 StylePane numeric default sanitiser — digits, decimal point and
 * minus sign only (`style-pane.tsx:183`).
 */
export const sanitizeNumericDefault = (value: string): string =>
  value.replace(/[^0-9.-]/g, "")
