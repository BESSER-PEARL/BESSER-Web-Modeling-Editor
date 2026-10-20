/** Props shared by the agentic canvas glyphs. */
export interface AgenticGlyphProps {
  /** Top-left x in the parent SVG's coordinate space. */
  x: number
  /** Top-left y in the parent SVG's coordinate space. */
  y: number
  /** Rendered width in px; each glyph has its own default. */
  size?: number
  /** Stroke / fill colour; defaults to the theme foreground. */
  color?: string
}

export const AGENTIC_GLYPH_COLOR = "var(--besser-primary-contrast)"
