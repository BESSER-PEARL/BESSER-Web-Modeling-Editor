/**
 * Reconnect must never apply a reply twice, nor apply the previous turn's reply.
 *
 * On reconnect the first heartbeat flushes the agent's outbox (delivering the
 * reply that was lost to the dead socket) and, in the same tick, the client asks
 * for a replay. The agent then re-sends its buffered reply: the SAME reply a
 * second time, or — if the current turn has not replied yet — the PREVIOUS
 * turn's. Each user message now carries a `turnId`; the agent echoes it with a
 * per-turn `replySeq` on every frame, and the client applies each
 * (turnId, replySeq) at most once and drops frames for turns it never sent or
 * that a newer turn has superseded.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';
import type { InjectionCommand } from '../assistant-types';

// The agent's wire envelope: the action payload JSON-encoded in `message`.
const wire = (inner: Record<string, unknown>): MessageEvent =>
  ({ data: JSON.stringify({ action: 'agent_reply_str', message: JSON.stringify(inner) }) } as MessageEvent);

type Priv = {
  awaitingResponse: boolean;
  requestReplayIfPending(): void;
  handleMessage(e: MessageEvent): void;
  clearResponseTimer(): void;
};

const clients: AssistantClient[] = [];

const setup = () => {
  const client = new AssistantClient('ws://never-connect.invalid');
  clients.push(client);
  const sent: string[] = [];
  (client as unknown as { ws: unknown }).ws = { readyState: 1, send: (s: string) => sent.push(s) };
  (client as unknown as { isConnected: boolean }).isConnected = true;
  const injections: InjectionCommand[] = [];
  const actions: string[] = [];
  client.onInjection((c) => injections.push(c));
  client.onAction((a) => actions.push(a.action));
  const inner = (i: number) => JSON.parse(JSON.parse(sent[i]).message);
  return { client, priv: client as unknown as Priv, sent, injections, actions, inner };
};

const system = (turnId: string | undefined, replySeq: number | undefined, name: string) => ({
  action: 'inject_complete_system',
  diagramType: 'ClassDiagram',
  systemSpec: { classes: [{ className: name }] },
  message: `built ${name}`,
  ...(turnId !== undefined ? { turnId } : {}),
  ...(replySeq !== undefined ? { replySeq } : {}),
});

afterEach(() => {
  clients.splice(0).forEach((c) => (c as unknown as Priv).clearResponseTimer());
});

describe('AssistantClient — turn-scoped reply dedupe', () => {
  it('every user message carries a fresh turnId', () => {
    const { client, inner } = setup();
    client.sendMessage('first');
    client.sendMessage('second');
    const a = inner(0).turnId;
    const b = inner(1).turnId;
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
    expect(a).not.toBe(b);
  });

  it('applies the same reply once when the outbox flush and the replay both deliver it', () => {
    const { client, priv, sent, injections, inner } = setup();
    client.sendMessage('make a library system');
    const turnId = inner(0).turnId;

    // Reconnect: the replay request names the awaited turn...
    priv.requestReplayIfPending();
    const replay = inner(sent.length - 1);
    expect(replay.action).toBe('replay_last_response');
    expect(replay.turnId).toBe(turnId);

    // ...the heartbeat flush delivers the lost reply, then the replay re-sends it.
    priv.handleMessage(wire(system(turnId, 1, 'Book')));
    priv.handleMessage(wire(system(turnId, 1, 'Book')));

    expect(injections).toHaveLength(1);
    expect(priv.awaitingResponse).toBe(false);
  });

  it("never applies the previous turn's reply while the current turn is pending", () => {
    const { client, priv, injections, inner } = setup();
    client.sendMessage('make a library system');
    const t1 = inner(0).turnId;
    priv.handleMessage(wire(system(t1, 1, 'Book')));
    expect(injections).toHaveLength(1);

    client.sendMessage('now add a Member class');
    expect(priv.awaitingResponse).toBe(true);

    // Reconnect mid-turn-2: a replay of turn 1's buffered reply comes back.
    priv.requestReplayIfPending();
    priv.handleMessage(wire(system(t1, 1, 'Book')));

    expect(injections).toHaveLength(1);
    expect(priv.awaitingResponse).toBe(true);
  });

  it('reports the already-applied reply seqs of the awaited turn in the replay request', () => {
    const { client, priv, sent, inner } = setup();
    client.sendMessage('make a web app');
    const turnId = inner(0).turnId;
    priv.handleMessage(wire({ action: 'progress', message: 'working', turnId, replySeq: 1 }));
    priv.handleMessage(wire({ action: 'progress', message: 'still working', turnId, replySeq: 2 }));
    priv.requestReplayIfPending();
    expect(inner(sent.length - 1).appliedSeqs).toEqual([1, 2]);
  });

  it('applies every distinct reply of a multi-reply turn', () => {
    const { client, priv, injections, actions, inner } = setup();
    client.sendMessage('class diagram plus a GUI, then generate django');
    const turnId = inner(0).turnId;
    priv.handleMessage(wire(system(turnId, 1, 'Book')));
    priv.handleMessage(wire({ action: 'auto_generate_gui', message: 'gui', turnId, replySeq: 2 }));
    priv.handleMessage(wire({ action: 'trigger_generator', generatorType: 'django', turnId, replySeq: 3 }));
    expect(injections).toHaveLength(1);
    expect(actions).toEqual(['auto_generate_gui', 'trigger_generator']);
  });

  it('keeps accepting a turn\'s later replies after a newer message was sent but before it replied', () => {
    const { client, priv, actions, inner } = setup();
    client.sendMessage('first');
    const t1 = inner(0).turnId;
    priv.handleMessage(wire({ action: 'assistant_message', message: 'part 1', turnId: t1, replySeq: 1 }));
    client.sendMessage('second');
    const t2 = inner(1).turnId;
    // Turn 1's body was still running when the user typed again.
    priv.handleMessage(wire({ action: 'assistant_message', message: 'part 2', turnId: t1, replySeq: 2 }));
    // A turn-1 reply does not conclude turn 2.
    expect(priv.awaitingResponse).toBe(true);
    priv.handleMessage(wire({ action: 'assistant_message', message: 'answer 2', turnId: t2, replySeq: 1 }));
    expect(priv.awaitingResponse).toBe(false);
    // Once turn 2 has replied, turn 1 is complete: a late turn-1 frame is stale.
    priv.handleMessage(wire({ action: 'assistant_message', message: 'late', turnId: t1, replySeq: 3 }));
    expect(actions).toEqual(['assistant_message', 'assistant_message', 'assistant_message']);
  });

  it('ignores replies for a turn this client never sent', () => {
    const { client, priv, injections } = setup();
    client.sendMessage('make a library system');
    // e.g. a previous page load's reply flushed from the shared per-user outbox.
    priv.handleMessage(wire(system('turn_from_another_page', 1, 'Invoice')));
    expect(injections).toHaveLength(0);
    expect(priv.awaitingResponse).toBe(true);
  });

  it('a dropped duplicate does not disarm the pending turn\'s response timer', () => {
    const { client, priv, inner } = setup();
    client.sendMessage('first');
    const t1 = inner(0).turnId;
    priv.handleMessage(wire(system(t1, 1, 'Book')));
    client.sendMessage('second');
    const timerBefore = (client as unknown as { responseTimeout: unknown }).responseTimeout;
    expect(timerBefore).not.toBeNull();
    priv.handleMessage(wire(system(t1, 1, 'Book')));
    expect((client as unknown as { responseTimeout: unknown }).responseTimeout).toBe(timerBefore);
  });
});

describe('AssistantClient — session reset and streamed turns', () => {
  it('after resetSession, a late reply to the old conversation is not applied', () => {
    const { client, priv, sent, injections, inner } = setup();
    client.sendMessage('make a library system');
    const oldTurn = inner(0).turnId;
    client.resetSession();
    priv.handleMessage(wire(system(oldTurn, 1, 'Book')));
    expect(injections).toHaveLength(0);
    // ...and a reconnect does not ask for the abandoned turn.
    const before = sent.length;
    priv.requestReplayIfPending();
    expect(sent.length).toBe(before);
  });

  it('a stamped stream keeps the turn awaited until stream_done, so a mid-stream reconnect replays it', () => {
    const { client, priv, sent, actions, inner } = setup();
    client.sendMessage('describe my model');
    const turnId = inner(0).turnId;
    priv.handleMessage(wire({ action: 'stream_start', streamId: 's1', turnId, replySeq: 1 }));
    priv.handleMessage(wire({ action: 'stream_chunk', streamId: 's1', chunk: 'The ', turnId, replySeq: 2 }));
    expect(priv.awaitingResponse).toBe(true);

    priv.requestReplayIfPending();
    const replay = inner(sent.length - 1);
    expect(replay.action).toBe('replay_last_response');
    expect(replay.appliedSeqs).toEqual([1, 2]);

    priv.handleMessage(wire({ action: 'stream_done', streamId: 's1', fullText: 'The model.', turnId, replySeq: 5 }));
    expect(priv.awaitingResponse).toBe(false);
    priv.handleMessage(wire({ action: 'stream_done', streamId: 's1', fullText: 'The model.', turnId, replySeq: 5 }));
    expect(actions.filter((a) => a === 'stream_done')).toHaveLength(1);
  });

  it('an unstamped stream_start still ends the wait (an old agent would replay the previous turn)', () => {
    const { client, priv } = setup();
    client.sendMessage('describe my model');
    priv.handleMessage(wire({ action: 'stream_start', streamId: 's1' }));
    expect(priv.awaitingResponse).toBe(false);
  });
});

describe('AssistantClient — turn protocol compatibility', () => {
  it('new client with an old agent: unstamped replies are applied exactly as before', () => {
    const { client, priv, injections } = setup();
    client.sendMessage('make a library system');
    priv.requestReplayIfPending();
    // An old agent echoes no turnId / replySeq.
    priv.handleMessage(wire(system(undefined, undefined, 'Book')));
    expect(injections).toHaveLength(1);
    expect(priv.awaitingResponse).toBe(false);
    // Legacy frames carry nothing to dedupe on, so a second copy still applies
    // (the pre-turn-id behaviour; fixed once the agent is upgraded).
    priv.handleMessage(wire(system(undefined, undefined, 'Book')));
    expect(injections).toHaveLength(2);
  });

  it('voice turns carry no turnId, so their replies follow the legacy path', () => {
    const { client, priv, sent, injections } = setup();
    client.sendVoiceMessage('AAAA', 'audio/wav');
    priv.requestReplayIfPending();
    const replay = JSON.parse(JSON.parse(sent[sent.length - 1]).message);
    expect(replay.action).toBe('replay_last_response');
    expect(replay.turnId).toBeUndefined();
    priv.handleMessage(wire(system(undefined, undefined, 'Book')));
    expect(injections).toHaveLength(1);
    expect(priv.awaitingResponse).toBe(false);
  });
});
