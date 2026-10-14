import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectionStatus } from 'besser-agentic-framework-ui';
import { useAppDispatch } from '@/main/app/store/hooks';
import {
  AGENT_SIMULATION_WS_AUTH_FAILED_CODE,
  buildAgentSimulationAuthFrame,
  getAgentSimulationWebSocketUrl,
} from '@/main/shared/api/agentSimulation';
import {
  appendStdoutLine,
  reportRuntimeError,
  setCurrentAgentState,
  setError,
  setLastTransition,
} from './agentSimulationSlice';

/** A BAF-native frame (has an `action` field) forwarded from the agent. */
export type BafFrame = Record<string, unknown> & { action: string };

interface UseAgentSimulationSocketOptions {
  /** Called for every BAF-native chat frame. */
  onBafFrame: (frame: BafFrame) => void;
  /** Called when the agent reports a runtime error (already shown in the terminal). */
  onRuntimeError?: (message: string) => void;
}

/**
 * Owns the simulation WebSocket for one session.
 *
 * - Opens `WS <backend>/simulation/{id}/ws` and sends the auth frame FIRST
 *   (`{"type":"auth","githubSession":...}`); the connection counts as
 *   connected only once the backend answers `{"type":"auth_ok"}`.
 * - A close with code 4401 is a lifecycle error (authentication required).
 * - Agent runtime errors (`{"type":"error"}`) are routed to the terminal/chat
 *   and never change the lifecycle status, so they cannot tear the socket down.
 * - The effect depends only on `sessionId`; it closes cleanly on unmount or
 *   when the session ends (sessionId → null).
 */
export function useAgentSimulationSocket(
  sessionId: string | null,
  { onBafFrame, onRuntimeError }: UseAgentSimulationSocketOptions,
) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Keep the latest callbacks / translator without re-opening the socket.
  const handlersRef = useRef({ onBafFrame, onRuntimeError, t });
  handlersRef.current = { onBafFrame, onRuntimeError, t };

  useEffect(() => {
    if (!sessionId) {
      setStatus('disconnected');
      return;
    }

    const wsUrl = getAgentSimulationWebSocketUrl(sessionId);
    if (!wsUrl) {
      setStatus('error');
      dispatch(setError(handlersRef.current.t('agentSimulation.chat.backendUnavailable')));
      return;
    }

    let disposed = false;
    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(buildAgentSimulationAuthFrame());
    };

    ws.onclose = (event: CloseEvent) => {
      if (disposed) return;
      if (wsRef.current === ws) wsRef.current = null;
      if (event.code === AGENT_SIMULATION_WS_AUTH_FAILED_CODE) {
        setStatus('error');
        dispatch(setError(handlersRef.current.t('agentSimulation.chat.authRequired')));
        return;
      }
      // 4400 (bad session id), 4404 (not this user's session), 4429 (rate limited):
      // the backend refused the connection, so the session cannot be used.
      if (event.code >= 4400 && event.code < 4500) {
        setStatus('error');
        dispatch(setError(event.reason || handlersRef.current.t('agentSimulation.chat.connectionRejected')));
        return;
      }
      setStatus('disconnected');
    };

    ws.onerror = () => {
      if (disposed) return;
      setStatus('error');
      dispatch(reportRuntimeError(handlersRef.current.t('agentSimulation.chat.websocketError')));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (disposed) return;
      let raw: unknown;
      try {
        raw = JSON.parse(event.data as string);
      } catch {
        dispatch(appendStdoutLine(String(event.data)));
        return;
      }
      if (typeof raw !== 'object' || raw === null) {
        dispatch(appendStdoutLine(String(event.data)));
        return;
      }
      const frame = raw as Record<string, unknown>;

      if (typeof frame.action === 'string') {
        handlersRef.current.onBafFrame(frame as BafFrame);
        return;
      }

      // Events injected by the sandbox from the agent's stdout
      switch (frame.type) {
        case 'auth_ok':
          setStatus('connected');
          break;
        case 'state_change':
          if (frame.state) dispatch(setCurrentAgentState(String(frame.state)));
          if (frame.transition) dispatch(setLastTransition(String(frame.transition)));
          break;
        case 'stdout':
          dispatch(appendStdoutLine(String(frame.line ?? '')));
          break;
        case 'error': {
          const message =
            typeof frame.message === 'string' && frame.message
              ? frame.message
              : handlersRef.current.t('agentSimulation.chat.unknownError');
          dispatch(reportRuntimeError(message));
          handlersRef.current.onRuntimeError?.(message);
          break;
        }
        default:
          break;
      }
    };

    return () => {
      disposed = true;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close(1000);
      }
      if (wsRef.current === ws) wsRef.current = null;
      setStatus('disconnected');
    };
  }, [sessionId, dispatch]);

  const send = useCallback((action: string, message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, message }));
    }
  }, []);

  return { status, send };
}
