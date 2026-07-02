import { BPMNExpandableEditPopover } from "./BPMNSubprocessEditPopover"
import { PopoverProps } from "../types"

// Transaction reuses the same expand/collapse editor as Subprocess
// (develop wraps both in BPMNExpandableUpdate).
export const BPMNTransactionEditPopover: React.FC<PopoverProps> = (props) => (
  <BPMNExpandableEditPopover {...props} label="Transaction" />
)
