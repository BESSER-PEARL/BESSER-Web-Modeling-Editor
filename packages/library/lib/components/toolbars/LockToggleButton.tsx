import { LockIcon, LockOpenIcon } from "../Icon"
import { ToolbarButton } from "./ToolbarButton"
import { useElementLock } from "@/hooks/useDiagramModifiable"
import { useTranslation } from "@/i18n"
import { useDiagramStore } from "@/store/context"

/** Toolbar toggle that locks or unlocks one node or edge. */
export const LockToggleButton = ({ elementId }: { elementId: string }) => {
  const { t } = useTranslation()
  const { locked } = useElementLock(elementId)
  const setElementLocked = useDiagramStore((state) => state.setElementLocked)
  return (
    <ToolbarButton
      label={t("lock.lock", "Lock")}
      aria-pressed={locked}
      onClick={(event) => {
        event.stopPropagation()
        setElementLocked(elementId, !locked)
      }}
    >
      {locked ? <LockIcon /> : <LockOpenIcon />}
    </ToolbarButton>
  )
}
