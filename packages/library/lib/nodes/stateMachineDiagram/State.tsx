import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { useEffect } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { StateNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"
import {
  STATE_ROW_HEIGHT as ROW_HEIGHT,
  StateShape,
} from "@/components/svgs/nodes/stateMachineDiagram/StateShape"

/**
 * `State` parent node. Body rows and fallback body rows render inline
 * inside the State (`data.bodies[]` / `data.fallbackBodies[]`); the
 * drawing is `StateShape`, shared with the palette preview.
 */

export function State({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateNodeProps>>) {
  const [wrapperEl, wrapperRef] = usePopoverAnchor<HTMLDivElement>()
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()
  const setNodes = useDiagramStore((s) => s.setNodes)

  const mainBodies = data.bodies ?? []
  const fallbackBodies = data.fallbackBodies ?? []
  // v3 parity (`uml-state-component.tsx`): a set stereotype grows the
  // header 40 → 50 px to fit the «stereotype» line above the name.
  const headerHeight = data.stereotype
    ? LAYOUT.DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE
    : LAYOUT.DEFAULT_HEADER_HEIGHT
  // Develop parity: `UMLState.render()` sets `bounds.height` to exactly
  // `headerHeight + Σ(row heights)` — there is no extra padding beyond
  // the rows themselves.
  const requiredHeight =
    headerHeight + (mainBodies.length + fallbackBodies.length) * ROW_HEIGHT

  // Develop parity (`uml-state.ts` `static features.resizable = 'WIDTH'`):
  // height is never user-controlled — it's always exactly the computed
  // content height. Snap unconditionally (grow *and* shrink), mirroring
  // Class.tsx's `minHeight` snap-effect, so adding/removing a body row
  // settles the height immediately instead of leaving dead space (the
  // prior grow-only effect never shrank an over-tall node).
  useEffect(() => {
    if (height && height !== requiredHeight) {
      setNodes((all) =>
        all.map((n) =>
          n.id === id
            ? {
                ...n,
                height: requiredHeight,
                measured: {
                  width: n.measured?.width ?? width ?? 0,
                  height: requiredHeight,
                },
                style: { ...(n.style ?? {}), height: requiredHeight },
              }
            : n
        )
      )
    }
  }, [requiredHeight, height, id, setNodes, width])

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      className="horizontally-not-resizable"
    >
      <NodeToolbar elementId={id} />
      {/* Develop parity (`uml-state.ts` `resizable: 'WIDTH'`): only the
          left/right handles are live — height is locked to the computed
          content height via minHeight===maxHeight, mirroring
          `StateForkNodeHorizontal.tsx` and `Class.tsx`. */}
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={120}
        minHeight={requiredHeight}
        maxHeight={requiredHeight}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
          style={{ filter: "drop-shadow(0 1px 2px rgba(16, 24, 40, 0.08))" }}
        >
          <StateShape
            width={width}
            height={height}
            headerHeight={headerHeight}
            name={data.name}
            stereotype={data.stereotype ?? undefined}
            italic={data.italic}
            underline={data.underline}
            bodies={mainBodies}
            fallbackBodies={fallbackBodies}
            fillColor={fillColor}
            strokeColor={strokeColor}
            textColor={textColor}
            clipId={`state-clip-${id}`}
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperEl}
        elementId={id}
        type={"State" as const}
      />
    </DefaultNodeWrapper>
  )
}
