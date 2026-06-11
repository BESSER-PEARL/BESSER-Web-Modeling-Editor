/**
 * useStreamingResponse -- Streaming state and chunk assembly.
 *
 * Owns:
 *  - `isGenerating` state
 *  - `streamingMessageId` state
 *  - `progressMessage` state
 *  - The `onTyping` handler
 *  - Stream chunk handling (stream_start, stream_chunk, stream_done)
 *  - The isGenerating timeout safety net
 */

import { useEffect, useState } from 'react';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { AssistantActionPayload } from '../services';

/* ------------------------------------------------------------------ */
/*  Debug timing (shared with orchestrator)                            */
/* ------------------------------------------------------------------ */

interface PendingTimer {
  label: string;
  start: number;
}

/** Module-level debug flag -- matches the orchestrator's DEBUG_TIMING. */
const DEBUG_TIMING = false;

const pendingTimers = new Map<string, PendingTimer>();

export const startTimer = (key: string, label: string) => {
  if (!DEBUG_TIMING) return;
  pendingTimers.set(key, { label, start: performance.now() });
};

export const stopTimer = (key: string): string | null => {
  if (!DEBUG_TIMING) return null;
  const timer = pendingTimers.get(key);
  if (!timer) return null;
  pendingTimers.delete(key);
  const elapsed = performance.now() - timer.start;
  const formatted =
    elapsed < 1000 ? `${Math.round(elapsed)}ms` : `${(elapsed / 1000).toFixed(2)}s`;
  const msg = `\u23f1 ${timer.label}: ${formatted}`;
  console.log(`[AssistantTiming] ${msg}`);
  return msg;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toKitMessage = (
  role: 'user' | 'assistant',
  content: string,
  extras?: Partial<
    Pick<
      ChatKitMessage,
      'isProgress' | 'progressStep' | 'progressTotal' | 'isError' | 'isStreaming' | 'injectionType'
    >
  >,
): ChatKitMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
  ...extras,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UseStreamingResponseReturn {
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  streamingMessageId: string | null;
  setStreamingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  progressMessage: string;
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  /**
   * Handle streaming-related action payloads (stream_start, stream_chunk,
   * stream_done, progress). Returns `true` if the payload was handled,
   * `false` if it should be processed by the orchestrator.
   */
  handleStreamingAction: (
    payload: AssistantActionPayload,
    setMessages: React.Dispatch<React.SetStateAction<ChatKitMessage[]>>,
  ) => boolean;
  /** Register the onTyping handler on the assistant client. */
  registerTypingHandler: (
    assistantClient: { onTyping: (cb: (typing: boolean) => void) => void },
  ) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useStreamingResponse(): UseStreamingResponseReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');

  /* ---- isGenerating timeout safety net ---- */

  useEffect(() => {
    if (!isGenerating) return;
    const timeout = setTimeout(() => {
      setIsGenerating(false);
    }, 120_000);
    return () => clearTimeout(timeout);
  }, [isGenerating]);

  /* ---- handler registration ---- */

  const registerTypingHandler = (
    assistantClient: { onTyping: (cb: (typing: boolean) => void) => void },
  ) => {
    assistantClient.onTyping((typing) => {
      setIsGenerating((prev) => (prev === typing ? prev : typing));
    });
  };

  /* ---- streaming action handler ---- */

  const handleStreamingAction = (
    payload: AssistantActionPayload,
    setMessages: React.Dispatch<React.SetStateAction<ChatKitMessage[]>>,
  ): boolean => {
    if (payload.action === 'stream_start') {
      // First stream event -- record response time
      const responseTiming = stopTimer('response');
      if (responseTiming) {
        console.log(`[AssistantTiming] Stream started \u2014 ${responseTiming}`);
      }
      startTimer('streaming', 'Streaming duration');
      return true;
    }

    if (payload.action === 'stream_chunk') {
      const { streamId, chunk } = payload as Record<string, any>;
      if (typeof streamId !== 'string' || typeof chunk !== 'string') return true;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === streamId && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk, isStreaming: true },
          ];
        }
        return [
          ...prev,
          {
            id: streamId,
            role: 'assistant' as const,
            content: chunk,
            isStreaming: true,
            createdAt: new Date(),
          },
        ];
      });
      setStreamingMessageId(streamId);
      return true;
    }

    if (payload.action === 'stream_done') {
      const { streamId, fullText } = payload as Record<string, any>;
      if (typeof streamId !== 'string') return true;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamId
            ? {
                ...msg,
                content: (typeof fullText === 'string' ? fullText : undefined) || msg.content,
                isStreaming: false,
              }
            : msg,
        ),
      );
      setStreamingMessageId(null);
      setProgressMessage('');

      // Show timing summary after stream completes
      const streamTiming = stopTimer('streaming');
      const totalTiming = stopTimer('total');
      if (streamTiming || totalTiming) {
        const timingText = [streamTiming, totalTiming].filter(Boolean).join(' \u00b7 ');
        setMessages((prev) => [
          ...prev,
          toKitMessage('assistant', timingText, { isProgress: true }),
        ]);
      }
      return true;
    }

    if (payload.action === 'progress') {
      const progressMsg = typeof payload.message === 'string' ? payload.message : '';
      const step =
        typeof (payload as any).step === 'number' ? ((payload as any).step as number) : undefined;
      const total =
        typeof (payload as any).total === 'number'
          ? ((payload as any).total as number)
          : undefined;
      const label = step && total ? `[${step}/${total}] ${progressMsg}` : progressMsg;
      setProgressMessage(label);
      return true;
    }

    return false;
  };

  return {
    isGenerating,
    setIsGenerating,
    streamingMessageId,
    setStreamingMessageId,
    progressMessage,
    setProgressMessage,
    handleStreamingAction,
    registerTypingHandler,
  };
}
