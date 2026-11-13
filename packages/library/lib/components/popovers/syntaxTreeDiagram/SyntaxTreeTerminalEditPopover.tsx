import { DefaultNodeEditPopover } from "../DefaultNodeEditPopover"
import { PopoverProps } from "../types"
import { useTranslation } from "@/i18n"

export const SyntaxTreeTerminalEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  return (
    <DefaultNodeEditPopover
      elementId={elementId}
      placeholder={t("packages.SyntaxTree.SyntaxTreeTerminal", "Terminal")}
    />
  )
}
