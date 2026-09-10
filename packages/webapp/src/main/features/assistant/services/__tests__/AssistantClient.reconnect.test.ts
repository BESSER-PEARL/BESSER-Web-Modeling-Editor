/**
 * Reconnect recovery: a long generation can outlive its WebSocket connection.
 * If the socket reconnects mid-flight, the agent's final reply can be routed to
 * the dead socket and lost, leaving the UI stuck on "still working…". On
 * reconnect-while-waiting the client asks the agent to replay its last completed
 * reply (`replay_last_response`); a terminal reply clears the pending flag.
 */
import { describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';

const evt = (obj: unknown): MessageEvent => ({ data: JSON.stringify(obj) } as MessageEvent);

describe('AssistantClient — reconnect replay recovery', () => {
  it('marks awaiting on send, requests a replay on reconnect, and clears on the terminal reply', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    const sent: string[] = [];
    // Inject a fake open socket so the send path runs without a real server.
    (client as unknown as { ws: unknown }).ws = { readyState: 1, send: (s: string) => sent.push(s) };
    (client as unknown as { isConnected: boolean }).isConnected = true;

    const priv = client as unknown as {
      awaitingResponse: boolean;
      requestReplayIfPending(): void;
      handleMessage(e: MessageEvent): void;
      clearResponseTimer(): void;
    };

    // 1. Sending a user message marks a reply as pending.
    client.sendMessage('make a restaurant ordering app with menus and tables');
    expect(priv.awaitingResponse).toBe(true);
    expect(JSON.parse(JSON.parse(sent[0]).message).action).toBe('user_message');

    // 2. A reconnect while still waiting asks the agent to replay its last reply.
    priv.requestReplayIfPending();
    const replayInner = JSON.parse(JSON.parse(sent[1]).message);
    expect(replayInner.action).toBe('replay_last_response');
    expect(replayInner.sessionId).toBeDefined();

    // 3. The terminal reply concludes the turn — no longer awaiting.
    priv.handleMessage(
      evt({ action: 'inject_complete_system', diagramType: 'ClassDiagram', systemSpec: {}, message: 'Done' }),
    );
    expect(priv.awaitingResponse).toBe(false);

    // 4. A later reconnect does NOT request a replay (nothing pending).
    const before = sent.length;
    priv.requestReplayIfPending();
    expect(sent.length).toBe(before);

    priv.clearResponseTimer();
  });
});
