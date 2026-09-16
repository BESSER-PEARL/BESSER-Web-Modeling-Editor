import { useLayoutEffect, useRef } from "react"

interface UseAutosizeTextAreaProps {
  ref: React.RefObject<HTMLTextAreaElement>
  maxHeight?: number
  borderWidth?: number
  dependencies: React.DependencyList
}

export function useAutosizeTextArea({
  ref,
  maxHeight = Number.MAX_SAFE_INTEGER,
  borderWidth = 0,
  dependencies,
}: UseAutosizeTextAreaProps) {
  const originalHeight = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!ref.current) return

    const currentRef = ref.current
    const borderAdjustment = borderWidth * 2

    currentRef.style.removeProperty("height")

    if (originalHeight.current === null) {
      // The empty height, measured with the value blanked. Measuring it as-is
      // captured whatever content was present on the first render, and since
      // it is the lower clamp below, a box that mounted holding a long value
      // could never shrink again — a 4600-char prompt left a 1284px empty
      // input after sending. Restored synchronously, before paint.
      const value = currentRef.value
      currentRef.value = ""
      originalHeight.current = currentRef.scrollHeight - borderAdjustment
      currentRef.value = value
      currentRef.style.removeProperty("height")
    }

    const scrollHeight = currentRef.scrollHeight
    // maxHeight is the hard ceiling: clamping up to the minimum afterwards
    // used to be able to exceed it, which is how 240px became 1284px.
    const clamped = Math.min(
      Math.max(Math.min(scrollHeight, maxHeight), originalHeight.current),
      maxHeight,
    )

    currentRef.style.height = `${clamped + borderAdjustment}px`
  }, [maxHeight, ref, ...dependencies])
}
