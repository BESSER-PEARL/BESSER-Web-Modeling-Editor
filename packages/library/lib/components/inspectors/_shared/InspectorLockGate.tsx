import type { KeyboardEvent, ReactNode } from "react"
import { useShallow } from "zustand/shallow"
import { LockIcon } from "@/components/Icon"
import { useElementLock } from "@/hooks/useDiagramModifiable"
import { useTranslation } from "@/i18n"
import { useDiagramStore } from "@/store/context"

// Fields of a locked element take only Tab (move on) and Escape (close).
const blockEditingKeys = (event: KeyboardEvent) => {
  if (event.key === "Tab" || event.key === "Escape") return
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Inspector body of a locked element or diagram: a notice with the way to
 * unlock, above the fields, which stay readable but disabled.
 */
export const InspectorLockGate = ({
  elementId,
  children,
}: {
  elementId: string
  children: ReactNode
}) => {
  const { t } = useTranslation()
  const { locked } = useElementLock(elementId)
  const { diagramLocked, setDiagramLocked, setElementLocked } = useDiagramStore(
    useShallow((state) => ({
      diagramLocked: state.diagramLocked,
      setDiagramLocked: state.setDiagramLocked,
      setElementLocked: state.setElementLocked,
    }))
  )
  if (!locked && !diagramLocked) return <>{children}</>

  return (
    <>
      <div className="bp-lock-notice" role="status">
        <LockIcon width={16} height={16} aria-hidden="true" />
        <span className="bp-lock-notice__text">
          {diagramLocked
            ? t("lock.diagramLockedNotice", "This diagram is locked.")
            : t("lock.elementLockedNotice", "This element is locked.")}
        </span>
        <button
          type="button"
          className="bp-text-btn"
          onClick={() =>
            diagramLocked
              ? setDiagramLocked(false)
              : setElementLocked(elementId, false)
          }
        >
          {diagramLocked
            ? t("lock.unlockDiagram", "Unlock diagram")
            : t("lock.unlock", "Unlock")}
        </button>
      </div>
      <fieldset
        className="bp-lock-fields"
        disabled
        onKeyDownCapture={blockEditingKeys}
      >
        {children}
      </fieldset>
    </>
  )
}
