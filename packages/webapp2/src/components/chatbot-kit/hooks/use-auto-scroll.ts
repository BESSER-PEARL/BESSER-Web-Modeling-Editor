import { useEffect, useRef, useState } from "react"

// How many pixels from the bottom of the container to enable auto-scroll
const ACTIVATION_THRESHOLD = 40
// Minimum pixels of scroll-up movement required to disable auto-scroll
const MIN_SCROLL_UP_THRESHOLD = 10

export function useAutoScroll(dependencies: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousScrollTop = useRef<number | null>(null)
  const isAtBottomRef = useRef(true)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }

  const updateScrollState = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const distanceFromBottom = Math.abs(scrollHeight - scrollTop - clientHeight)
    const isAtBottom = distanceFromBottom < ACTIVATION_THRESHOLD

    // Only update state if the at-bottom status actually changed
    if (isAtBottomRef.current !== isAtBottom) {
      isAtBottomRef.current = isAtBottom
      setShouldAutoScroll(isAtBottom)
    }
  }

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop } = containerRef.current

      const isScrollingUp = previousScrollTop.current
        ? scrollTop < previousScrollTop.current
        : false

      const scrollUpDistance = previousScrollTop.current
        ? previousScrollTop.current - scrollTop
        : 0

      const isDeliberateScrollUp =
        isScrollingUp && scrollUpDistance > MIN_SCROLL_UP_THRESHOLD

      // If user deliberately scrolls up, disable auto-scroll
      if (isDeliberateScrollUp) {
        if (isAtBottomRef.current) {
          isAtBottomRef.current = false
          setShouldAutoScroll(false)
        }
      } else {
        // For all other scroll movements, check if we're at bottom
        updateScrollState()
      }

      previousScrollTop.current = scrollTop
    }
  }

  const handleTouchStart = () => {
    // On touch start, disable auto-scroll to prevent unwanted scrolling during gestures
    if (isAtBottomRef.current) {
      isAtBottomRef.current = false
      setShouldAutoScroll(false)
    }
  }

  useEffect(() => {
    if (containerRef.current) {
      previousScrollTop.current = containerRef.current.scrollTop
      updateScrollState()
    }
  }, [])

  useEffect(() => {
    if (shouldAutoScroll && containerRef.current) {
      scrollToBottom()
    }
  }, dependencies)

  return {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  }
}
