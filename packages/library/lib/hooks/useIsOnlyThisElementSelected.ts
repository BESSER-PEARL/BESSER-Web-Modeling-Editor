import { useDiagramStore } from "@/store"
import { useShallow } from "zustand/shallow"

export const useIsOnlyThisElementSelected = (elementId: string) => {
  const { selectedElementIds } = useDiagramStore(
    useShallow((state) => ({
      selectedElementIds: state.selectedElementIds,
    }))
  )

  return selectedElementIds.length === 1 && selectedElementIds[0] === elementId
}
