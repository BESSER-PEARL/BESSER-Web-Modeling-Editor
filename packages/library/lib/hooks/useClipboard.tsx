import { useCallback } from "react"
import { Node, Edge } from "@xyflow/react"
import { log } from "../logger"

interface ClipboardData {
  nodes: Node[]
  edges: Edge[]
  timestamp: number
}

export const useClipboard = () => {
  const copyToClipboard = useCallback(async (data: ClipboardData) => {
    try {
      const jsonString = JSON.stringify(data)

      if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API if available
        await navigator.clipboard.writeText(jsonString)
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea")
        textArea.value = jsonString
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand("copy")
        textArea.remove()
      }

      return true
    } catch (error) {
      log.error("Failed to copy to clipboard:", error as Error)
      return false
    }
  }, [])

  const readFromClipboard =
    useCallback(async (): Promise<ClipboardData | null> => {
      try {
        let text: string

        if (navigator.clipboard && window.isSecureContext) {
          text = await navigator.clipboard.readText()
        } else {
          // Fallback - this won't work in most cases due to security restrictions
          return null
        }

        const data = JSON.parse(text) as ClipboardData

        // Validate the clipboard data structure
        if (
          data &&
          Array.isArray(data.nodes) &&
          Array.isArray(data.edges) &&
          typeof data.timestamp === "number"
        ) {
          return data
        }

        return null
      } catch (error) {
        log.error("Failed to read from clipboard:", error as Error)
        return null
      }
    }, [])

  return {
    copyToClipboard,
    readFromClipboard,
  }
}
