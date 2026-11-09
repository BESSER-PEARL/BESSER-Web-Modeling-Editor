import { log } from "../logger"

const SAFE_COLOR =
  /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%/-]+\)|var\(--[\w-]+(,\s*#[0-9a-f]{3,8})?\))$/i

/**
 * A model's colour, or undefined when it is not one. A model is a file anyone
 * with write access to a repository can edit, so a colour that reaches a
 * stylesheet is checked first.
 */
export function safeColor(color: unknown): string | undefined {
  if (color === undefined || color === null || color === "") return undefined
  if (typeof color === "string" && SAFE_COLOR.test(color.trim()))
    return color.trim()
  log.warn("Ignoring an invalid colour in the model")
  return undefined
}
