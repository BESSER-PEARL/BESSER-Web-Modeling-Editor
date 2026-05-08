import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"

export const SyntaxTreeNonterminalEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  return (
    <DefaultNodeEditPopover elementId={elementId} placeholder="Nonterminal" />
  )
}
