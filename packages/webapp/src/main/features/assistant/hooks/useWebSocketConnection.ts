/**
 * useWebSocketConnection -- WebSocket connection lifecycle management.
 *
 * Owns:
 *  - `connectionStatus` state
 *  - The `onConnection` handler registration
 *  - Initial `connect()` call and teardown on unmount
 *  - Sync of connection status when the panel reopens
 *
 * In the BESSER Lab build (`LAB_BUILD`) the chat talks to the lab backend, so the
 * modeling agent's socket is never opened: the status is then the lab backend's,
 * which the lab shell already reached before any chat shows.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LAB_BUILD } from '../../../shared/constants/constant';
import { reportError } from '../../../shared/services/errors/reportError';
import type { AssistantClient } from '../services';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'closed'
  | 'closing'
  | 'unknown';

export interface UseWebSocketConnectionOptions {
  /** The singleton AssistantClient instance. */
  assistantClient: AssistantClient;
  /** Whether the assistant panel is currently open/visible. */
  isActive: boolean;
}

export interface UseWebSocketConnectionReturn {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useWebSocketConnection({
  assistantClient,
  isActive,
}: UseWebSocketConnectionOptions): UseWebSocketConnectionReturn {
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(LAB_BUILD ? 'connected' : 'disconnected');

  // Sync connection status when drawer reopens
  useEffect(() => {
    if (isActive && !LAB_BUILD) {
      setConnectionStatus(
        (assistantClient.connectionState as ConnectionStatus) ||
          (assistantClient.connected ? 'connected' : 'disconnected'),
      );
    }
  }, [isActive, assistantClient]);

  // Register the onConnection handler and initiate the connection once.
  // Keep alive for the lifetime of the hook; disconnect on unmount.
  useEffect(() => {
    if (LAB_BUILD) return undefined;
    const unsubConnection = assistantClient.onConnection((connected) => {
      let next: ConnectionStatus;
      if (connected) {
        next = 'connected';
      } else if (
        assistantClient.connectionState === 'closed' ||
        assistantClient.connectionState === 'disconnected'
      ) {
        next = assistantClient.connected
          ? (assistantClient.connectionState as ConnectionStatus)
          : 'reconnecting';
      } else {
        next = assistantClient.connectionState as ConnectionStatus;
      }
      setConnectionStatus((prev) => (prev === next ? prev : next));
    });

    setConnectionStatus('connecting');
    // connect() is idempotent \u2014 if the other surface already opened the shared
    // client, this resolves immediately.
    assistantClient.connect().catch(() => {
      setConnectionStatus('disconnected');
      // Both surfaces (widget + drawer) connect; a fixed toastId shows the error once.
      reportError(t('assistant.errors.backendUnreachable'), { toastId: 'assistant-backend-unreachable' });
    });

    // The client is SHARED between the widget and the drawer, so a single
    // surface unmounting must NOT clearHandlers()/disconnect() \u2014 that would
    // kill the other surface's connection. Only drop this surface's own
    // connection-status subscription; the socket lives on (heartbeat keeps it).
    return () => {
      unsubConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantClient]);

  return {
    connectionStatus,
    setConnectionStatus,
  };
}
