import { useEffect, useRef, useState } from "react"

import { recordAudio } from "@/components/chatbot-kit/lib/audio-utils"

interface UseAudioRecordingOptions {
  transcribeAudio?: (blob: Blob) => Promise<string>
  onTranscriptionComplete?: (text: string) => void
  /** Called with the raw audio blob when recording finishes (for voice send). */
  onVoiceSend?: (blob: Blob) => void
  maxDurationMs?: number
}

export function useAudioRecording({
  transcribeAudio,
  onTranscriptionComplete,
  onVoiceSend,
  maxDurationMs = 60_000,
}: UseAudioRecordingOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(
    !!(transcribeAudio || onVoiceSend),
  )
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [recordingEndsAt, setRecordingEndsAt] = useState<number | null>(null)
  const [, setTicker] = useState(0)
  const activeRecordingRef = useRef<any>(null)
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitializingRef = useRef(false)

  useEffect(() => {
    const hasMediaDevices = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    )
    setIsSpeechSupported(hasMediaDevices && !!(transcribeAudio || onVoiceSend))
  }, [transcribeAudio, onVoiceSend])

  useEffect(() => {
    if (!isRecording || recordingEndsAt === null) return

    const interval = setInterval(() => {
      setTicker((value) => value + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording, recordingEndsAt])

  const clearAutoStopTimeout = () => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current)
      autoStopTimeoutRef.current = null
    }
  }

  const stopRecording = async () => {
    clearAutoStopTimeout()
    setRecordingEndsAt(null)
    setIsRecording(false)
    setIsTranscribing(true)
    try {
      // First stop the recording to get the final blob
      recordAudio.stop()
      // Wait for the recording promise to resolve with the final blob
      const recording = await activeRecordingRef.current

      // Dedicated voice-send path — no transcription needed.
      if (onVoiceSend) {
        onVoiceSend(recording)
      } else if (transcribeAudio) {
        const text = await transcribeAudio(recording)
        onTranscriptionComplete?.(text)
      }
    } catch (error) {
      console.error("Error processing audio:", error)
    } finally {
      setIsTranscribing(false)
      setIsListening(false)
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop())
        setAudioStream(null)
      }
      activeRecordingRef.current = null
    }
  }

  const toggleListening = async () => {
    // Guard against rapid double-taps while getUserMedia is resolving.
    if (isInitializingRef.current) return

    if (!isListening) {
      isInitializingRef.current = true
      try {
        setIsListening(true)
        setIsRecording(true)
        setRecordingEndsAt(Date.now() + maxDurationMs)
        // Get audio stream first
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })
        setAudioStream(stream)

        // Start recording with the stream
        activeRecordingRef.current = recordAudio(stream)
        autoStopTimeoutRef.current = setTimeout(() => {
          stopRecording().catch((error) => {
            console.error("Error auto-stopping recording:", error)
          })
        }, maxDurationMs)
      } catch (error) {
        console.error("Error recording audio:", error)
        setIsListening(false)
        setIsRecording(false)
        setRecordingEndsAt(null)
        clearAutoStopTimeout()
        if (audioStream) {
          audioStream.getTracks().forEach((track) => track.stop())
          setAudioStream(null)
        }
      } finally {
        isInitializingRef.current = false
      }
    } else {
      await stopRecording()
    }
  }

  useEffect(() => {
    return () => {
      clearAutoStopTimeout()
    }
  }, [])

  const recordingSecondsLeft = recordingEndsAt
    ? Math.max(0, Math.ceil((recordingEndsAt - Date.now()) / 1000))
    : 0

  return {
    isListening,
    isSpeechSupported,
    isRecording,
    isTranscribing,
    audioStream,
    recordingSecondsLeft,
    toggleListening,
    stopRecording,
  }
}
