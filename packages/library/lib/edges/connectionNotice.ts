/**
 * Transient feedback for connection drags: a short notice where a refused
 * connection was dropped, and an outline on a node the dragged edge can't
 * attach to (styles in `styles/connections.css`). Imperative because the
 * connection gesture lives outside React state (React Flow owns it) and must
 * not touch the diagram store.
 */

const NOTICE_CLASS = "besser-connection-notice"
const NOTICE_VISIBLE_CLASS = "besser-connection-notice--visible"
const INVALID_TARGET_CLASS = "besser-connect-target--invalid"
const NOTICE_MS = 2600

let noticeTimer: ReturnType<typeof setTimeout> | undefined

/** Removes the refusal notice (a new connection gesture or a success). */
export const clearConnectionNotice = () => {
  clearTimeout(noticeTimer)
  document.querySelectorAll(`.${NOTICE_CLASS}`).forEach((el) => el.remove())
}

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
  clearConnectionNotice()

  const bounds = container.getBoundingClientRect()
  const notice = document.createElement("div")
  notice.className = NOTICE_CLASS
  notice.setAttribute("role", "status")
  notice.setAttribute("aria-live", "polite")
  notice.textContent = message
  notice.style.left = `${Math.max(8, Math.min(client.x - bounds.left + 12, bounds.width - 288))}px`
  notice.style.top = `${Math.max(8, client.y - bounds.top + 14)}px`
  container.appendChild(notice)
  requestAnimationFrame(() => notice.classList.add(NOTICE_VISIBLE_CLASS))
  noticeTimer = setTimeout(() => {
    notice.classList.remove(NOTICE_VISIBLE_CLASS)
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
  markedTarget?.classList.remove(INVALID_TARGET_CLASS)
  markedTarget = el
  el?.classList.add(INVALID_TARGET_CLASS)
}
