import 'besser-agentic-framework-ui/style.css';
import './bafChatOverrides.css';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChatArea,
  PayloadAction,
  REASONING_TRACE_ACTION,
  isReasoningEnd,
  isReasoningStart,
} from 'besser-agentic-framework-ui';
import type { ChatMessage } from 'besser-agentic-framework-ui';
import type { ReasoningStep, ReasoningTraceMessage, Task } from 'besser-agentic-framework-ui';
import { AlertTriangle } from 'lucide-react';
import { useAppSelector } from '@/main/app/store/hooks';
import { selectSessionId } from './agentSimulationSlice';
import { useAgentSimulationSocket, type BafFrame } from './useAgentSimulationSocket';

interface BafChatWrapperProps {}

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function tryParseMessage(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { /* ignore */ }
  try { return JSON.parse((raw as string).replace(/'/g, '"')); } catch { /* ignore */ }
  return raw;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReasoningTraceMessage(message: unknown): message is ReasoningTraceMessage {
  return isObject(message) && Array.isArray(message.steps) && Array.isArray(message.tasks) && typeof message.inProgress === 'boolean';
}

function parseReasoningStep(message: unknown): ReasoningStep | null {
  if (!isObject(message)) return null;
  if (typeof message.kind !== 'string' || typeof message.step !== 'number' || typeof message.summary !== 'string') {
    return null;
  }
  return {
    kind: message.kind,
    step: message.step,
    summary: message.summary,
    details: isObject(message.details) ? message.details : {},
  };
}

function parseTaskList(message: unknown): Task[] | null {
  const source = Array.isArray(message)
    ? message
    : isObject(message) && Array.isArray(message.tasks)
      ? message.tasks
      : null;

  if (!source) return null;

  return source
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => ({
      id: typeof item.id === 'number' ? item.id : Number(item.id ?? 0),
      description: String(item.description ?? ''),
      status: String(item.status ?? 'pending'),
      result: String(item.result ?? ''),
    }));
}

function findActiveTraceIndex(messages: ChatMessage[]): number {
  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const candidate = messages[idx];
    if (
      !candidate.isUser
      && candidate.action === REASONING_TRACE_ACTION
      && isReasoningTraceMessage(candidate.message)
      && candidate.message.inProgress
    ) {
      return idx;
    }
  }
  return -1;
}

function withReasoningStep(messages: ChatMessage[], step: ReasoningStep, timestamp: string): ChatMessage[] {
  const traceFromStep: ReasoningTraceMessage = {
    steps: [step],
    tasks: [],
    inProgress: !isReasoningEnd(step),
  };

  if (isReasoningStart(step)) {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        action: REASONING_TRACE_ACTION,
        message: traceFromStep,
        isUser: false,
        timestamp,
      },
    ];
  }

  const activeIdx = findActiveTraceIndex(messages);
  if (activeIdx === -1) {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        action: REASONING_TRACE_ACTION,
        message: traceFromStep,
        isUser: false,
        timestamp,
      },
    ];
  }

  const updated = [...messages];
  const active = updated[activeIdx];
  const trace = active.message as ReasoningTraceMessage;
  updated[activeIdx] = {
    ...active,
    message: {
      ...trace,
      steps: [...trace.steps, step],
      inProgress: !isReasoningEnd(step),
    },
  };
  return updated;
}

function withTaskListUpdate(messages: ChatMessage[], tasks: Task[], timestamp: string): ChatMessage[] {
  const activeIdx = findActiveTraceIndex(messages);
  if (activeIdx === -1) {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        action: REASONING_TRACE_ACTION,
        message: {
          steps: [],
          tasks,
          inProgress: true,
        } satisfies ReasoningTraceMessage,
        isUser: false,
        timestamp,
      },
    ];
  }

  const updated = [...messages];
  const active = updated[activeIdx];
  const trace = active.message as ReasoningTraceMessage;
  updated[activeIdx] = {
    ...active,
    message: {
      ...trace,
      tasks,
    },
  };
  return updated;
}

function isUserPayloadAction(action: string): boolean {
  return action.startsWith('user_');
}

function parseHistoryMessages(message: unknown): ChatMessage[] {
  const source = Array.isArray(message)
    ? message
    : isObject(message) && Array.isArray(message.messages)
      ? message.messages
      : [];

  return source
    .filter((item): item is Record<string, unknown> => isObject(item) && typeof item.action === 'string')
    .map((item) => {
      const action = String(item.action);
      const parsed = tryParseMessage(item.message);
      return {
        id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
        action,
        message: parsed,
        isUser: typeof item.isUser === 'boolean' ? item.isUser : isUserPayloadAction(action),
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : nowTimestamp(),
      } satisfies ChatMessage;
    });
}

export const BafChatWrapper: React.FC<BafChatWrapperProps> = () => {
  const { t } = useTranslation();
  const sessionId = useAppSelector(selectSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Clear messages when a new session starts
  useEffect(() => {
    setMessages([]);
  }, [sessionId]);

  const handleBafFrame = useCallback((frame: BafFrame) => {
    const timestamp = typeof frame.timestamp === 'string' ? frame.timestamp : nowTimestamp();
    const action = frame.action;
    const parsed = tryParseMessage(frame.message);

    if (action === PayloadAction.RESET) {
      setMessages([]);
      return;
    }

    if (action === PayloadAction.FETCH_USER_MESSAGES) {
      const historyMessages = parseHistoryMessages(parsed);
      if (historyMessages.length === 0) return;
      setMessages((prev) => [...prev, ...historyMessages]);
      return;
    }

    if (action === PayloadAction.AGENT_REPLY_REASONING_STEP) {
      const step = parseReasoningStep(parsed);
      if (!step) return;
      setMessages((prev) => withReasoningStep(prev, step, timestamp));
      return;
    }

    if (action === PayloadAction.AGENT_REPLY_TASK_LIST_UPDATE) {
      const tasks = parseTaskList(parsed);
      if (!tasks) return;
      setMessages((prev) => withTaskListUpdate(prev, tasks, timestamp));
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        action,
        message: parsed,
        isUser: isUserPayloadAction(action),
        timestamp,
      },
    ]);
  }, []);

  // Agent runtime errors are shown inline in the chat (and in the terminal by
  // the socket hook) without ending the session.
  const handleRuntimeError = useCallback(
    (message: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          action: PayloadAction.AGENT_REPLY_STR,
          message: t('agentSimulation.chat.agentError', { message }),
          isUser: false,
          timestamp: nowTimestamp(),
        },
      ]);
    },
    [t],
  );

  const { status: wsStatus, send } = useAgentSimulationSocket(sessionId, {
    onBafFrame: handleBafFrame,
    onRuntimeError: handleRuntimeError,
  });

  return (
    <div className="baf-chat flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* BAF ChatArea fills remaining space */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatArea
          messages={messages}
          setMessages={setMessages}
          status={wsStatus}
          send={send}
        />
      </div>

      {/* Privacy warning */}
      <div className="shrink-0 border-t border-border/30">
        <div className="flex items-start gap-2 bg-amber-50/70 px-3 py-2 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[10px] leading-snug text-amber-700 dark:text-amber-300">
            {t('agentSimulation.chat.sensitivityWarning')}
          </p>
        </div>
      </div>
    </div>
  );
};
