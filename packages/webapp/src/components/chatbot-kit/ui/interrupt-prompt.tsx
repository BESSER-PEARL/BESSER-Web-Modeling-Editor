import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

interface InterruptPromptProps {
  isOpen: boolean
  close: () => void
}

export function InterruptPrompt({ isOpen, close }: InterruptPromptProps) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-50%", y: 0, opacity: 0 }}
          animate={{ x: "-50%", y: -40, opacity: 1, transition: { type: "spring" } }}
          exit={{ x: "-50%", y: 0, opacity: 0 }}
          className="absolute left-1/2 top-0 flex overflow-hidden whitespace-nowrap rounded-full border bg-background py-1 text-center text-sm text-muted-foreground"
        >
          <span className="ml-2.5">{t("assistant.chatKit.interruptPrompt")}</span>
          <button
            className="ml-1 mr-2.5 flex items-center"
            type="button"
            onClick={close}
            aria-label={t("assistant.chatKit.close")}
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
