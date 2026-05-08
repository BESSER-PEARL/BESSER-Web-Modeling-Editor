import { create, StoreApi, UseBoundStore } from "zustand"
import { devtools } from "zustand/middleware"

export type PopoverStore = {
  popoverElementId: string | null
  popupEnabled: boolean
  setPopOverElementId: (value: string | null) => void
  setPopupEnabled: (isPopupEnabled: boolean) => void
  reset: () => void
}

type InitialPopoverState = {
  popoverElementId: string | null
  popupEnabled: boolean
}
const initialPopoverState: InitialPopoverState = {
  popoverElementId: null,
  popupEnabled: true,
}

export const createPopoverStore = (): UseBoundStore<StoreApi<PopoverStore>> =>
  create<PopoverStore>()(
    devtools(
      (set) => ({
        ...initialPopoverState,

        setPopOverElementId: (value: string | null) => {
          set({ popoverElementId: value }, undefined, "setPopOverElementId")
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
