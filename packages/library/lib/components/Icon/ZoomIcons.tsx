// React Flow's own control icons (not exported by @xyflow/react), so the
// controls bar looks unchanged. Sized by `.control-button > svg`.
export const ZoomInIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" />
  </svg>
)

export const ZoomOutIcon = () => (
  <svg viewBox="0 0 32 5" aria-hidden="true">
    <path d="M0 0h32v4.2H0z" />
  </svg>
)

export const FitViewIcon = () => (
  <svg viewBox="0 0 32 30" aria-hidden="true">
    <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
  </svg>
)
