/**
 * useWebSocketConnection -- WebSocket connection lifecycle management.
 *
 * Owns:
 *  - `connectionStatus` state
 *  - The `onConnection` handler registration
 *  - Initial `connect()` call and teardown on unmount
 *  - Sync of connection status when the panel reopens
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Track active state in a ref so handlers (which are registered once) can
  // check it synchronously without needing to re-register on every toggle.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Sync connection status when drawer reopens
  useEffect(() => {
    if (isActive) {
      setConnectionStatus(
        (assistantClient.connectionState as ConnectionStatus) ||
          (assistantClient.connected ? 'connected' : 'disconnected'),
      );
    }
  }, [isActive, assistantClient]);

  // Register the onConnection handler and initiate the connection once.
  // Keep alive for the lifetime of the hook; disconnect on unmount.
  useEffect(() => {
    assistantClient.onConnection((connected) => {
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
    assistantClient.connect().catch(() => {
      setConnectionStatus('disconnected');
      toast.error('Could not reach the AI assistant \u2014 make sure the backend is running.');
    });

    return () => {
      assistantClient.clearHandlers();
      assistantClient.disconnect({ allowReconnect: false, clearQueue: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantClient]);

  return {
    connectionStatus,
    setConnectionStatus,
  };
}
