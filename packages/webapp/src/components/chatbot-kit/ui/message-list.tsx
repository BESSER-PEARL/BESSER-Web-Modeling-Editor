import { useEffect, useRef, useState } from "react"

import {
  ChatMessage,
  type ChatMessageProps,
  type Message,
} from "@/components/chatbot-kit/ui/chat-message"
import { TypingIndicator } from "@/components/chatbot-kit/ui/typing-indicator"

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>

interface MessageListProps {
  typingLabel?: string
  messages: Message[]
  showTimeStamps?: boolean
  isTyping?: boolean
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: Message) => AdditionalMessageOptions)
}

/**
 * Text of the reply whose stream just ended, or null. The log region below
 * only announces additions, so a streamed reply would otherwise be read out
 * as its first chunk and never again.
 */
function useFinishedStreamAnnouncement(messages: Message[]): string {
  const [announcement, setAnnouncement] = useState("")
  const streamingIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const wasStreaming = streamingIdsRef.current
    const nowStreaming = new Set<string>()
    let finished: Message | undefined
    for (const message of messages) {
      if (message.isStreaming) nowStreaming.add(message.id)
      else if (wasStreaming.has(message.id)) finished = message
    }
    streamingIdsRef.current = nowStreaming
    if (finished?.content) setAnnouncement(finished.content)
  }, [messages])

  return announcement
}

export function MessageList({
  messages,
  showTimeStamps = true,
  isTyping = false,
  typingLabel,
  messageOptions,
}: MessageListProps) {
  const announcement = useFinishedStreamAnnouncement(messages)

  return (
    <>
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="space-y-4 overflow-visible"
      >
        {messages.map((message) => {
          const additionalOptions =
            typeof messageOptions === "function"
              ? messageOptions(message)
              : messageOptions

          return (
            <ChatMessage
              key={message.id}
              showTimeStamp={showTimeStamps}
              {...message}
              {...additionalOptions}
            />
          )
        })}
        {isTyping && <TypingIndicator label={typingLabel} />}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  )
}
