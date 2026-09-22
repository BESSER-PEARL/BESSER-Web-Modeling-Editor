import { useCallback, useRef, useState } from "react"
import { toast } from "react-toastify"
import { useTranslation } from "react-i18next"

type UseCopyToClipboardProps = {
  text: string
  copyMessage?: string
}

export function useCopyToClipboard({
  text,
  copyMessage,
}: UseCopyToClipboardProps) {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(copyMessage ?? t("assistant.chatKit.copiedToClipboard"))
        setIsCopied(true)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false)
        }, 2000)
      })
      .catch(() => {
        toast.error(t("assistant.chatKit.copyFailed"))
      })
  }, [text, copyMessage, t])

  return { isCopied, handleCopy }
}
