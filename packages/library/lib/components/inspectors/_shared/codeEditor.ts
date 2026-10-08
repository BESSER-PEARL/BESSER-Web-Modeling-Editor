import { useEffect, useState } from "react"
import { StreamLanguage, type StreamParser } from "@codemirror/language"

const readTheme = (): "light" | "dark" =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light"

/**
 * CodeMirror `theme` prop that follows the app theme (`<html data-theme>`).
 * Usage: `<CodeMirror theme={useCodeMirrorTheme()} … />`.
 */
export const useCodeMirrorTheme = (): "light" | "dark" => {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] })
    setTheme(readTheme())
    return () => observer.disconnect()
  }, [])
  return theme
}

// Keywords of BESSERActionLanguage.g4.
const BAL_KEYWORDS = new Set([
  "def", "do", "else", "for", "if", "in", "instanceof", "new", "return",
  "while", "this",
])
const BAL_ATOMS = new Set(["true", "false", "null", "nothing"])
const BAL_TYPES = new Set(["any", "bool", "float", "int", "str"])

const balParser: StreamParser<null> = {
  name: "bal",
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match("//")) {
      stream.skipToEnd()
      return "comment"
    }
    const quote = stream.peek()
    if (quote === '"' || quote === "'") {
      stream.next()
      let escaped = false
      let ch: string | void
      while ((ch = stream.next()) !== undefined) {
        if (ch === quote && !escaped) break
        escaped = !escaped && ch === "\\"
      }
      return "string"
    }
    if (stream.match(/^\d+(\.\d+)?/)) return "number"
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const word = stream.current()
      if (BAL_KEYWORDS.has(word)) return "keyword"
      if (BAL_ATOMS.has(word)) return "atom"
      if (BAL_TYPES.has(word)) return "typeName"
      return "variableName"
    }
    stream.next()
    return null
  },
  languageData: { commentTokens: { line: "//" } },
}

/** Syntax highlighting for the BESSER Action Language (BAL). */
export const balLanguage = StreamLanguage.define(balParser)
