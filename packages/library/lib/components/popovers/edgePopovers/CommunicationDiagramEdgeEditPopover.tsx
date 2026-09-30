import { Box, IconButton } from "@mui/material"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { CustomEdgeProps, MessageData } from "@/edges/EdgeProps"
import { ArrowBackIcon, ArrowForwardIcon, DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "../types"
import { useState, useEffect } from "react"
import { generateUUID } from "@/utils"
import { EdgeStyleEditor, TextField } from "@/components/ui"
import { log } from "../../../logger"
import { useTranslation } from "@/i18n"

export const CommunicationDiagramEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { t } = useTranslation()
  const { setEdges, updateEdgeData } = useReactFlow()
  const edge = useReactiveEdge(elementId)
  const sourceNode = useReactiveNode(edge?.source)
  const targetNode = useReactiveNode(edge?.target)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [newLabelInput, setNewLabelInput] = useState("")
  const [duplicateError, setDuplicateError] = useState(false)
  const sourceName = (sourceNode?.data?.name as string) ?? t("common.source", "Source")
  const targetName = (targetNode?.data?.name as string) ?? t("common.target", "Target")

  useEffect(() => {
    if (edge?.data) {
      const edgeData = edge.data as CustomEdgeProps
      if (edgeData.messages) {
        setMessages(edgeData.messages)
      }
    }
  }, [edge])

  const handleMessagesChange = (newMessages: MessageData[]) => {
    setMessages(newMessages)
    if (edge) {
      const labels = newMessages.map((msg) => msg.text)
      setEdges((edges) =>
        edges.map((e) =>
          e.id === elementId
            ? {
                ...e,
                data: {
                  ...e.data,
                  messages: newMessages,
                  labels: labels,
                },
              }
            : e
        )
      )
    }
  }

  const handleAddMessage = () => {
    if (newLabelInput.trim()) {
      const trimmedInput = newLabelInput.trim()
      const messageExists = messages.some(
        (msg) => msg.text.toLowerCase() === trimmedInput.toLowerCase()
      )

      if (messageExists) {
        setDuplicateError(true)
        log.warn(`Message "${trimmedInput}" already exists`)
        return
      }

      setDuplicateError(false)

      const newMessage: MessageData = {
        id: generateUUID(),
        text: trimmedInput,
        direction: "target",
      }
      const newMessages = [...messages, newMessage]
      handleMessagesChange(newMessages)
      setNewLabelInput("")
    }
  }

  const handleInputChange = (value: string) => {
    setNewLabelInput(value)
    if (duplicateError) {
      const trimmedValue = value.trim()
      const wouldBeDuplicate =
        trimmedValue &&
        messages.some(
          (msg) => msg.text.toLowerCase() === trimmedValue.toLowerCase()
        )
      if (!wouldBeDuplicate) {
        setDuplicateError(false)
      }
    }
  }

  const handleDeleteMessage = (index: number) => {
    const newMessages = messages.filter((_, i) => i !== index)
    handleMessagesChange(newMessages)
  }

  const handleMessageTextUpdate = (index: number, value: string) => {
    const newMessages = [...messages]
    newMessages[index] = { ...newMessages[index], text: value }
    handleMessagesChange(newMessages)
  }

  const handleMessageDirectionToggle = (index: number) => {
    const newMessages = [...messages]
    newMessages[index] = {
      ...newMessages[index],
      direction:
        newMessages[index].direction === "target" ? "source" : "target",
    }
    handleMessagesChange(newMessages)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddMessage()
    }
  }

  if (!edge) {
    return null
  }
  const edgeData = edge.data as CustomEdgeProps | undefined

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={edgeData}
        handleDataFieldUpdate={(key, value) =>
          updateEdgeData(elementId, { ...edge.data, [key]: value })
        }
        label={t(
          "packages.CommunicationDiagram.CommunicationLink",
          "Communication Link"
        )}
      />

      {messages.map((message, index) => {
        const isDuplicateText = messages.some(
          (msg, i) =>
            i !== index &&
            msg.text.toLowerCase() === message.text.toLowerCase() &&
            message.text.trim() !== ""
        )

        return (
          <Box
            key={index}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            {/* Direction Toggle Button */}
            <IconButton
              size="small"
              onClick={() => handleMessageDirectionToggle(index)}
              color={message.direction === "target" ? "primary" : "secondary"}
              title={t("popup.communication.direction", "Direction: {{direction}}", {
                direction:
                  message.direction === "target"
                    ? `${sourceName} → ${targetName}`
                    : `${targetName} → ${sourceName}`,
              })}
            >
              {message.direction === "target" ? (
                <ArrowForwardIcon
                  fontSize="small"
                  fill="var(--besser-primary-contrast, #000000)"
                />
              ) : (
                <ArrowBackIcon
                  fontSize="small"
                  fill="var(--besser-primary-contrast, #000000)"
                />
              )}
            </IconButton>

            {/* Message Text Field */}
            <TextField
              value={message.text}
              onChange={(e) => handleMessageTextUpdate(index, e.target.value)}
              size="small"
              fullWidth
              placeholder={t("popup.communication.messagePlaceholder", "Message {{index}}", {
                index: index + 1,
              })}
              error={isDuplicateText}
              helperText={
                isDuplicateText
                  ? t("popup.communication.duplicateMessage", "Duplicate message")
                  : ""
              }
            />

            {/* Delete Button */}
            <DeleteIcon
              width={16}
              height={16}
              aria-label={t("popup.communication.deleteMessage", "Delete message")}
              style={{ cursor: "pointer" }}
              onClick={() => handleDeleteMessage(index)}
            />
          </Box>
        )
      })}

      {/* Add new message input */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          value={newLabelInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
          fullWidth
          placeholder={t("popup.communication.addMessagePlaceholder", "+ Add Message")}
          error={duplicateError}
          helperText={
            duplicateError
              ? t(
                  "popup.communication.messageExists",
                  "This message already exists"
                )
              : ""
          }
        />
      </Box>
    </Box>
  )
}
