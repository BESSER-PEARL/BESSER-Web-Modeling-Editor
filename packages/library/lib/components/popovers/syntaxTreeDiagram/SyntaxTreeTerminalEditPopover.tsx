import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"

export const SyntaxTreeTerminalEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  return <DefaultNodeEditPopover elementId={elementId} placeholder="Terminal" />
}
