/**
 * Transient feedback for connection drags: a short notice where a refused
 * connection was dropped, and an outline on a node the dragged edge can't
 * attach to. Imperative because the connection gesture lives outside React
 * state (React Flow owns it) and must not touch the diagram store.
 */

const NOTICE_CLASS = "besser-connection-notice"
const INVALID_TARGET_CLASS = "besser-connect-target--invalid"
const NOTICE_MS = 2600

let noticeTimer: ReturnType<typeof setTimeout> | undefined

export const showConnectionNotice = (
  message: string,
  client: { x: number; y: number },
  from?: EventTarget | null
) => {
  const origin = from instanceof Element ? from : null
  const container =
    (origin?.closest(".react-flow") as HTMLElement | null) ??
    (document.querySelector(".react-flow") as HTMLElement | null)
  if (!container) return
  container.querySelector(`.${NOTICE_CLASS}`)?.remove()
  clearTimeout(noticeTimer)

  const bounds = container.getBoundingClientRect()
  const notice = document.createElement("div")
  notice.className = NOTICE_CLASS
  notice.setAttribute("role", "status")
  notice.setAttribute("aria-live", "polite")
  notice.textContent = message
  Object.assign(notice.style, {
    position: "absolute",
    left: `${Math.max(8, Math.min(client.x - bounds.left + 12, bounds.width - 288))}px`,
    top: `${Math.max(8, client.y - bounds.top + 14)}px`,
    maxWidth: "280px",
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
    lineHeight: "1.4",
    color: "var(--besser-background, #fff)",
    background: "var(--besser-primary-contrast, #212529)",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
    pointerEvents: "none",
    zIndex: "10000",
    opacity: "0",
    transform: "translateY(-2px)",
    transition: "opacity 120ms ease-out, transform 120ms ease-out",
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(notice)
  requestAnimationFrame(() => {
    notice.style.opacity = "1"
    notice.style.transform = "none"
  })
  noticeTimer = setTimeout(() => {
    notice.style.opacity = "0"
    setTimeout(() => notice.remove(), 160)
  }, NOTICE_MS)
}

let markedTarget: HTMLElement | null = null

/** Outline `nodeId`'s element as an invalid drop target (null clears it). */
export const markInvalidTarget = (nodeId: string | null) => {
  const el = nodeId
    ? (document.querySelector(
        `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
      ) as HTMLElement | null)
    : null
  if (el === markedTarget) return
  if (markedTarget) {
    markedTarget.classList.remove(INVALID_TARGET_CLASS)
    markedTarget.style.outline = ""
    markedTarget.style.outlineOffset = ""
  }
  markedTarget = el
  if (el) {
    el.classList.add(INVALID_TARGET_CLASS)
    el.style.outline = "2px dashed var(--besser-error, #dc3545)"
    el.style.outlineOffset = "3px"
  }
}
