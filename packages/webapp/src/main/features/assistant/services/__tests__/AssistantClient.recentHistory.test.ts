/**
 * BESSER#745: the agent keeps its conversation memory in its own process, so a
 * restart or an idle expiry loses it. The first message on each new socket
 * carries the recent turns so the agent can rebuild its memory.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AssistantClient,
  MAX_RECENT_HISTORY_CHARS,
  MAX_RECENT_HISTORY_TURNS,
  clampRecentHistory,
  type HistoryTurn,
} from '../AssistantClient';
import { recentHistoryFrom } from '../../hooks/recentHistory';
import { readAssistantSessionId } from '../../../../shared/services/storage/assistantStorage';

const HISTORY: HistoryTurn[] = [
  { role: 'user', content: 'A library system with books and loans' },
  { role: 'assistant', content: 'Created Book and Loan.' },
];

const internals = (client: AssistantClient) =>
  client as unknown as {
    sendHistoryOnNextMessage: boolean;
    buildUserPayload(message: string, diagramType: string): Record<string, unknown>;
  };

describe('AssistantClient — recentHistory after a (re)connect', () => {
  it('sends the history on the first message after the socket opens, and only then', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    client.setHistoryProvider(() => HISTORY);
    internals(client).sendHistoryOnNextMessage = true; // what onopen sets

    const first = internals(client).buildUserPayload('Add a Member class', 'ClassDiagram');
    const second = internals(client).buildUserPayload('Rename it', 'ClassDiagram');

    expect(first.recentHistory).toEqual(HISTORY);
    expect(second).not.toHaveProperty('recentHistory');
  });

  it('sends nothing when there is no earlier conversation', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    client.setHistoryProvider(() => []);
    internals(client).sendHistoryOnNextMessage = true;
    expect(internals(client).buildUserPayload('Hello', 'ClassDiagram')).not.toHaveProperty('recentHistory');
  });

  it('a new conversation has no history to send', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    client.setHistoryProvider(() => HISTORY);
    internals(client).sendHistoryOnNextMessage = true;
    client.resetSession();
    expect(internals(client).buildUserPayload('Hello', 'ClassDiagram')).not.toHaveProperty('recentHistory');
  });

  it('after another tab changed the conversation, the next message starts a new session carrying the history', () => {
    sessionStorage.clear();
    const client = new AssistantClient('ws://never-connect.invalid');
    client.setHistoryProvider(() => HISTORY);
    const before = internals(client).buildUserPayload('A library system', 'ClassDiagram');
    expect(readAssistantSessionId()).toBe(before.sessionId);

    client.restartWithHistoryOnNextMessage();
    const restarted = internals(client).buildUserPayload('Add a Member class', 'ClassDiagram');
    expect(restarted.sessionId).not.toBe(before.sessionId);
    // The old id is cleared from the tab, so a reload does not reuse it.
    expect(readAssistantSessionId()).toBe(restarted.sessionId);
    expect(restarted.recentHistory).toEqual(HISTORY);

    const next = internals(client).buildUserPayload('Rename it', 'ClassDiagram');
    expect(next.sessionId).toBe(restarted.sessionId);
    expect(next).not.toHaveProperty('recentHistory');
  });

  it('a new chat cancels a pending restart: the new session has no history to send', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    client.setHistoryProvider(() => HISTORY);
    client.restartWithHistoryOnNextMessage();
    client.resetSession();
    expect(internals(client).buildUserPayload('Hello', 'ClassDiagram')).not.toHaveProperty('recentHistory');
  });

  it('keeps the newest turns and cuts long ones', () => {
    const many = Array.from({ length: MAX_RECENT_HISTORY_TURNS + 5 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as HistoryTurn['role'],
      content: `turn ${i} ` + 'x'.repeat(MAX_RECENT_HISTORY_CHARS),
    }));
    const clamped = clampRecentHistory(many);
    expect(clamped).toHaveLength(MAX_RECENT_HISTORY_TURNS);
    expect(clamped[0].content.startsWith('turn 5 ')).toBe(true);
    expect(clamped.every((t) => t.content.length === MAX_RECENT_HISTORY_CHARS)).toBe(true);
  });
});

/** A WebSocket that opens when the test says so and records what is sent. */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
}

// A user message is double-encoded (its v2 payload is a string inside the frame).
const userFrames = (socket: FakeSocket) =>
  socket.sent
    .map((s) => JSON.parse(s).message)
    .filter((m): m is string => typeof m === 'string')
    .map((m) => JSON.parse(m))
    .filter((m) => m.action === 'user_message');

describe('AssistantClient — recentHistory on the wire', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeSocket.last = null;
  });

  it('every new socket sends the history with its first message, including one queued before it opened', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new AssistantClient('ws://agent.test');
    client.setHistoryProvider(() => HISTORY);

    const connected = client.connect();
    client.sendMessage('Add a Member class'); // queued: the socket is not open yet
    FakeSocket.last!.open();
    await connected;
    client.sendMessage('Rename it');

    const first = userFrames(FakeSocket.last!);
    expect(first).toHaveLength(2);
    expect(first[0].recentHistory).toEqual(HISTORY);
    expect(first[1]).not.toHaveProperty('recentHistory');

    // A reconnect is a new socket: its first message carries the history again.
    client.disconnect();
    const reconnected = client.connect();
    FakeSocket.last!.open();
    await reconnected;
    client.sendMessage('Add a Loan class');
    expect(userFrames(FakeSocket.last!)[0].recentHistory).toEqual(HISTORY);

    client.disconnect();
  });
});

describe('recentHistoryFrom', () => {
  it('drops status lines and the message being sent', () => {
    const messages = [
      { id: '1', role: 'user', content: 'A library system' },
      { id: '2', role: 'assistant', content: 'Still working on this…', isProgress: true },
      { id: '3', role: 'assistant', content: 'Created Book.' },
      { id: '4', role: 'assistant', content: 'Something failed', isError: true },
      { id: '5', role: 'user', content: 'Add Loan' },
    ];
    expect(recentHistoryFrom(messages as never, 'Add Loan')).toEqual([
      { role: 'user', content: 'A library system' },
      { role: 'assistant', content: 'Created Book.' },
    ]);
  });
});
