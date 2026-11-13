import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useResizableWidth } from "@/hooks/useResizableWidth"
import { useResizable } from "@/components/propertiesPanel/useResizable"
import {
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  usePropertiesPanelStore,
} from "@/store/propertiesPanelStore"
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/components/Sidebar"

/**
 * Drag-resize behavior of the generalized `useResizableWidth`
 * hook (develop parity: `sidebar-component.tsx` handleResizeMouseDown
 * for the left-anchored palette; the right-anchored properties panel
 * delegates to the same hook via `propertiesPanel/useResizable.ts`).
 */

const mouseDown = (clientX: number) =>
  ({
    preventDefault: () => {},
    clientX,
  }) as unknown as React.MouseEvent<HTMLDivElement>

const mouseMove = (clientX: number) =>
  window.dispatchEvent(new MouseEvent("mousemove", { clientX }))

const mouseUp = () => window.dispatchEvent(new MouseEvent("mouseup"))

beforeEach(() => {
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
})

describe("useResizableWidth", () => {
  it("clamps the initial width into [min, max]", () => {
    const { result } = renderHook(() =>
      useResizableWidth({ min: 128, max: 1000, initial: 50, anchor: "left" })
    )
    expect(result.current.width).toBe(128)
  })

  describe("anchor: 'left' (palette sidebar — +dx grows)", () => {
    it("grows when dragging right and shrinks when dragging left", () => {
      const { result } = renderHook(() =>
        useResizableWidth({ min: 128, max: 1000, initial: 180, anchor: "left" })
      )

      act(() => result.current.onResizeStart(mouseDown(100)))
      act(() => mouseMove(150))
      expect(result.current.width).toBe(230)

      act(() => mouseMove(60))
      expect(result.current.width).toBe(140)
      act(() => mouseUp())
    })

    it("clamps at the 1000px max bound", () => {
      const { result } = renderHook(() =>
        useResizableWidth({ min: 128, max: 1000, initial: 180, anchor: "left" })
      )
      act(() => result.current.onResizeStart(mouseDown(0)))
      act(() => mouseMove(5000))
      expect(result.current.width).toBe(1000)
      act(() => mouseUp())
    })

    it("clamps at the 128px min bound", () => {
      const { result } = renderHook(() =>
        useResizableWidth({ min: 128, max: 1000, initial: 180, anchor: "left" })
      )
      act(() => result.current.onResizeStart(mouseDown(500)))
      act(() => mouseMove(-5000))
      expect(result.current.width).toBe(128)
      act(() => mouseUp())
    })
  })

  describe("anchor: 'right' (properties panel — −dx grows)", () => {
    it("grows when dragging left", () => {
      const { result } = renderHook(() =>
        useResizableWidth({ min: 250, max: 600, initial: 320, anchor: "right" })
      )
      act(() => result.current.onResizeStart(mouseDown(500)))
      act(() => mouseMove(400))
      expect(result.current.width).toBe(420)
      act(() => mouseUp())
    })

    it("clamps to [min, max] in both directions", () => {
      const { result } = renderHook(() =>
        useResizableWidth({ min: 250, max: 600, initial: 320, anchor: "right" })
      )
      act(() => result.current.onResizeStart(mouseDown(500)))
      act(() => mouseMove(-5000))
      expect(result.current.width).toBe(600)
      act(() => mouseMove(5000))
      expect(result.current.width).toBe(250)
      act(() => mouseUp())
    })
  })

  it("sets body cursor/userSelect during the drag and restores them on mouseup", () => {
    const { result } = renderHook(() =>
      useResizableWidth({ min: 128, max: 1000, initial: 180, anchor: "left" })
    )
    act(() => result.current.onResizeStart(mouseDown(100)))
    expect(document.body.style.cursor).toBe("col-resize")
    expect(document.body.style.userSelect).toBe("none")

    act(() => mouseUp())
    expect(document.body.style.cursor).toBe("")
    expect(document.body.style.userSelect).toBe("")
  })

  it("stops tracking mousemove after mouseup", () => {
    const { result } = renderHook(() =>
      useResizableWidth({ min: 128, max: 1000, initial: 180, anchor: "left" })
    )
    act(() => result.current.onResizeStart(mouseDown(100)))
    act(() => mouseMove(200))
    expect(result.current.width).toBe(280)
    act(() => mouseUp())
    act(() => mouseMove(900))
    expect(result.current.width).toBe(280)
  })

  it("fires onChange with the clamped width on drag moves only", () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useResizableWidth({
        min: 128,
        max: 1000,
        initial: 180,
        anchor: "left",
        onChange,
      })
    )
    // Programmatic setWidth must NOT echo into onChange (store-sync
    // contract used by the properties-panel delegate).
    act(() => result.current.setWidth(300))
    expect(onChange).not.toHaveBeenCalled()

    act(() => result.current.onResizeStart(mouseDown(0)))
    act(() => mouseMove(50))
    expect(onChange).toHaveBeenLastCalledWith(350)
    act(() => mouseMove(5000))
    expect(onChange).toHaveBeenLastCalledWith(1000)
    act(() => mouseUp())
  })

  it("fires onResizeEnd once with the final width (snap-back hook point)", () => {
    const onResizeEnd = vi.fn()
    const { result } = renderHook(() =>
      useResizableWidth({
        min: 128,
        max: 1000,
        initial: 180,
        anchor: "left",
        onResizeEnd,
      })
    )
    act(() => result.current.onResizeStart(mouseDown(0)))
    act(() => mouseMove(120))
    act(() => mouseUp())
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    expect(onResizeEnd).toHaveBeenCalledWith(300)
  })

  it("clamps programmatic setWidth", () => {
    const { result } = renderHook(() =>
      useResizableWidth({ min: 128, max: 1000, initial: 180, anchor: "left" })
    )
    act(() => result.current.setWidth(64))
    expect(result.current.width).toBe(128)
    act(() => result.current.setWidth(4000))
    expect(result.current.width).toBe(1000)
  })
})

describe("sidebar resize constants (develop parity)", () => {
  it("matches develop's 128–1000 bounds with the migration's 180 default", () => {
    expect(SIDEBAR_MIN_WIDTH).toBe(128)
    expect(SIDEBAR_MAX_WIDTH).toBe(1000)
    expect(SIDEBAR_DEFAULT_WIDTH).toBe(180)
  })
})

describe("useResizable (properties-panel delegate)", () => {
  beforeEach(() => {
    usePropertiesPanelStore.setState({ panelWidth: PANEL_DEFAULT_WIDTH })
  })

  it("still clamps to the panel's 250–600 bounds after the refactor", () => {
    const { result } = renderHook(() => useResizable())
    expect(result.current.width).toBe(PANEL_DEFAULT_WIDTH)

    // Right-anchored: dragging far LEFT pins at the max bound.
    act(() => result.current.onResizeStart(mouseDown(500)))
    act(() => mouseMove(-5000))
    expect(result.current.width).toBe(PANEL_MAX_WIDTH)
    act(() => mouseMove(5000))
    expect(result.current.width).toBe(PANEL_MIN_WIDTH)
    act(() => mouseUp())
  })

  it("mirrors drag widths into propertiesPanelStore", () => {
    const { result } = renderHook(() => useResizable())
    act(() => result.current.onResizeStart(mouseDown(500)))
    act(() => mouseMove(450))
    expect(result.current.width).toBe(PANEL_DEFAULT_WIDTH + 50)
    expect(usePropertiesPanelStore.getState().panelWidth).toBe(
      PANEL_DEFAULT_WIDTH + 50
    )
    act(() => mouseUp())
  })

  it("follows store-driven width changes (external resize)", () => {
    const { result } = renderHook(() => useResizable())
    act(() => usePropertiesPanelStore.getState().setPanelWidth(400))
    expect(result.current.width).toBe(400)
  })
})
