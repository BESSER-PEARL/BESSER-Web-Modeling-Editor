/**
 * Measures the width of a given text string using the Canvas API.
 * @param text - The text to measure.
 * @param font - The font style to use for measurement.
 * @returns The width of the text in pixels.
 */
export const measureTextWidth = (() => {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  // Define the default font to match root.css
  const defaultFont =
    "400 16px Inter, system-ui, Avenir, Helvetica, Arial, sans-serif"

  return (text: string, font: string = defaultFont): number => {
    if (!context) return text.length * 8 // Fallback if context is unavailable
    context.font = font
    const metrics = context.measureText(text)
    return metrics.width
  }
})()
