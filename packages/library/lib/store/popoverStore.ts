import { create, StoreApi, UseBoundStore } from "zustand"
import { devtools } from "zustand/middleware"

export type PopoverStore = {
  popoverElementId: string | null
  /**
   * Bumped by every explicit open (double-click, Enter, edit button) but not
   * by `retargetPopOverElementId`, so the inspector can tell the two apart.
   */
  popoverRequest: number
  popupEnabled: boolean
  setPopOverElementId: (value: string | null) => void
  /** Points the open inspector at another element (selection follow). */
  retargetPopOverElementId: (value: string) => void
  setPopupEnabled: (isPopupEnabled: boolean) => void
  reset: () => void
}

type InitialPopoverState = {
  popoverElementId: string | null
  popoverRequest: number
  popupEnabled: boolean
}
const initialPopoverState: InitialPopoverState = {
  popoverElementId: null,
  popoverRequest: 0,
  popupEnabled: true,
}

export const createPopoverStore = (): UseBoundStore<StoreApi<PopoverStore>> =>
  create<PopoverStore>()(
    devtools(
      (set) => ({
        ...initialPopoverState,

        setPopOverElementId: (value: string | null) => {
          set(
            (state) => ({
              popoverElementId: value,
              popoverRequest:
                value === null ? state.popoverRequest : state.popoverRequest + 1,
            }),
            undefined,
            "setPopOverElementId"
          )
        },

        retargetPopOverElementId: (value: string) => {
          set({ popoverElementId: value }, undefined, "retargetPopOverElementId")
        },

        setPopupEnabled: (popupEnabled) => {
          set({ popupEnabled }, undefined, "setPopupEnabled")
        },

        reset: () => {
          set(initialPopoverState, undefined, "reset")
        },
      }),
      { name: "PopoverStore", enabled: true }
    )
  )
