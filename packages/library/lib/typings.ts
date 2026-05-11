import { DiagramEdgeType, IPoint } from "./edges/types"
import { DiagramNodeType } from "./nodes/types"
import { UMLDiagramType } from "./types/DiagramType"
import { Styles } from "./styles/theme"
import { DeepPartial } from "./utils"

export { UMLDiagramType, type DiagramNodeType, type DiagramEdgeType }
export { type Styles }

export type Unsubscriber = () => void

export type Subscribers = {
  [key: number]: Unsubscriber
}

export type UMLModelElementType = DiagramNodeType | DiagramEdgeType

export enum Locale {
  en = "en",
  de = "de",
}

export enum BesserMode {
  Modelling = "Modelling",
  Exporting = "Exporting",
  Assessment = "Assessment",
}

export type BesserNode = {
  id: string
  width: number
  height: number
  type: DiagramNodeType
  position: {
    x: number
    y: number
  }
  data: {
    [key: string]: unknown
  }
  parentId?: string
  measured: { width: number; height: number }
}

export type BesserEdge = {
  id: string
  source: string
  target: string
  type: DiagramEdgeType
  sourceHandle: string
  targetHandle: string
  data: {
    [key: string]: unknown
    points: IPoint[]
  }
}

export type InteractiveElements = {
  elements: Record<string, boolean>
  relationships: Record<string, boolean>
}

export type UMLModel = {
  version: `4.${number}.${number}`
  id: string
  title: string
  type: UMLDiagramType
  nodes: BesserNode[]
  edges: BesserEdge[]
  assessments: { [id: string]: Assessment }
  interactive?: InteractiveElements
}

export enum BesserView {
  Modelling = "Modelling",
  Exporting = "Exporting",
  Highlight = "Highlight",
}

/**
 * SVG export post-processing modes.
 * - "web": keep CSS variables unresolved so the host page's current theme
 *   drives colors (best for in-browser preview / copy-to-clipboard).
 * - "compat": resolve CSS variables + inline attributes for non-browser
 *   renderers (PowerPoint, Inkscape, resvg).
 * - "standalone": resolve CSS variables to their current computed values and
 *   inline an `<style>` block at the top of the `<svg>` so the file is
 *   self-contained when downloaded (also adds an XML prolog). Default for
 *   downloaded exports — see SA-FINAL-3 Tier 2 #8.
 */
export type SvgExportMode = "web" | "compat" | "standalone"

export type BesserOptions = {
  type?: UMLDiagramType
  mode?: BesserMode
  view?: BesserView
  availableViews?: BesserView[]
  readonly?: boolean
  enablePopups?: boolean
  model?: UMLModel
  theme?: DeepPartial<Styles>
  locale?: Locale
  copyPasteToClipboard?: boolean
  colorEnabled?: boolean
  scale?: number
  debug?: boolean
  collaborationEnabled?: boolean
  scrollLock?: boolean
}

export type FeedbackCorrectionStatus = {
  description?: string
  status: "CORRECT" | "INCORRECT" | "NOT_VALIDATED"
}

export type Assessment = {
  modelElementId: string
  elementType: string
  score: number
  feedback?: string
  dropInfo?: unknown
  label?: string
  labelColor?: string
  correctionStatus?: FeedbackCorrectionStatus
}

export type ExportOptions = {
  margin?:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number }
  keepOriginalSize?: boolean
  include?: string[]
  exclude?: string[]
  /**
   * Controls how SVG output is post-processed.
   * - "web": keep CSS variables for theme-adaptive rendering in browsers
   * - "compat": resolve CSS variables + inline attributes for PowerPoint/Inkscape
   * - "standalone": embed an inline `<style>` block with the current resolved
   *   palette and prepend an XML prolog so the SVG file is self-contained.
   */
  svgMode?: SvgExportMode
}

export type SVG = {
  svg: string
  clip: {
    x: number
    y: number
    width: number
    height: number
  }
}
