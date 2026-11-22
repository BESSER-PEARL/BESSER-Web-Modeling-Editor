/**
 * Conversation persistence — the assistant chat must survive a full-page
 * reload (most importantly the GitHub OAuth redirect: app → backend auth →
 * github.com → /auth/callback → app, which reloads the SPA and used to wipe
 * the in-memory conversation store).
 *
 * These tests exercise the pure persistence helpers directly: sanitation
 * (bounded, JSON-safe, no Blobs / data-URL attachments / in-flight frames),
 * serialization caps, and the revive path (Date revival, malformed/expired
 * payload rejection, meta pruning).
 */
import { describe, expect, it } from 'vitest';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import {
  MAX_PERSISTED_CHARS,
  MAX_PERSISTED_MESSAGES,
  reviveStoredConversation,
  sanitizeMessageForPersist,
  serializeConversation,
} from '../assistantConversationStore';

const msg = (overrides: Partial<ChatKitMessage> & { id: string }): ChatKitMessage => ({
  role: 'assistant',
  content: 'hello',
  createdAt: new Date('2026-09-03T10:00:00.000Z'),
  ...overrides,
});

describe('sanitizeMessageForPersist', () => {
  it('keeps a plain finished message and serializes createdAt to ISO', () => {
    const out = sanitizeMessageForPersist(msg({ id: 'm1', role: 'user', content: 'hi' }));
    expect(out).not.toBeNull();
    expect(out!.id).toBe('m1');
    expect(out!.createdAt).toBe('2026-09-03T10:00:00.000Z');
  });

  it('drops in-flight and transient frames (streaming, progress, running run cards)', () => {
    expect(sanitizeMessageForPersist(msg({ id: 's', isStreaming: true }))).toBeNull();
    expect(sanitizeMessageForPersist(msg({ id: 'p', isProgress: true }))).toBeNull();
    expect(
      sanitizeMessageForPersist(
        msg({ id: 'r', specDriven: { status: 'running', phases: [], warnings: [], text: '' } }),
      ),
    ).toBeNull();
  });

  it('strips heavy/unserializable fields: attachments and the deterministic Blob', () => {
    const out = sanitizeMessageForPersist(
      msg({
        id: 'm2',
        experimental_attachments: [
          { name: 'a.png', contentType: 'image/png', url: 'data:image/png;base64,AAAA' },
        ] as any,
        specDriven: {
          status: 'done',
          phases: [],
          warnings: [],
          text: '',
          deterministic: true,
          deterministicBlob: new Blob(['zip-bytes']),
          fileName: 'generated.zip',
        },
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.experimental_attachments).toBeUndefined();
    const spec = out!.specDriven as Record<string, unknown>;
    expect(spec.deterministicBlob).toBeUndefined();
    expect(spec.fileName).toBe('generated.zip'); // the rest of the card survives
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});

describe('serializeConversation + reviveStoredConversation round-trip', () => {
  it('round-trips messages and meta, reviving createdAt as a Date', () => {
    const messages = [msg({ id: 'a', role: 'user', content: 'make a class diagram' }), msg({ id: 'b' })];
    const meta = {
      b: { suggestedActions: [{ label: 'Generate code', prompt: 'generate django' }] },
      orphan: { badge: 'error' as const },
    };
    const payload = serializeConversation(messages, meta);
    expect(payload).not.toBeNull();

    const revived = reviveStoredConversation(payload);
    expect(revived).not.toBeNull();
    expect(revived!.messages.map((m) => m.id)).toEqual(['a', 'b']);
    expect(revived!.messages[0].createdAt).toBeInstanceOf(Date);
    expect(revived!.messages[0].createdAt!.toISOString()).toBe('2026-09-03T10:00:00.000Z');
    expect(revived!.messages.every((m) => m.isStreaming === false)).toBe(true);
    // Meta is pruned to persisted message ids only.
    expect(revived!.messageMeta.b).toBeDefined();
    expect(revived!.messageMeta.orphan).toBeUndefined();
  });

  it('caps the number of persisted messages', () => {
    const many = Array.from({ length: MAX_PERSISTED_MESSAGES + 40 }, (_, i) => msg({ id: `m${i}` }));
    const payload = serializeConversation(many, {});
    const revived = reviveStoredConversation(payload);
    expect(revived).not.toBeNull();
    expect(revived!.messages.length).toBeLessThanOrEqual(MAX_PERSISTED_MESSAGES);
    // Newest messages win.
    expect(revived!.messages[revived!.messages.length - 1].id).toBe(`m${MAX_PERSISTED_MESSAGES + 39}`);
  });

  it('sheds oldest messages to fit the byte budget', () => {
    const big = 'x'.repeat(20 * 1024);
    const messages = Array.from({ length: 30 }, (_, i) => msg({ id: `big${i}`, content: big }));
    const payload = serializeConversation(messages, {});
    expect(payload).not.toBeNull();
    expect(payload!.length).toBeLessThanOrEqual(MAX_PERSISTED_CHARS);
    const revived = reviveStoredConversation(payload);
    expect(revived).not.toBeNull();
    // The newest message always survives the shedding loop.
    expect(revived!.messages[revived!.messages.length - 1].id).toBe('big29');
  });

  it('rejects malformed, empty, and expired payloads', () => {
    expect(reviveStoredConversation(null)).toBeNull();
    expect(reviveStoredConversation('not json {')).toBeNull();
    expect(reviveStoredConversation(JSON.stringify({ messages: 'nope' }))).toBeNull();
    const expired = JSON.stringify({
      savedAt: Date.now() - 72 * 60 * 60 * 1000,
      messages: [{ id: 'a', role: 'user', content: 'old' }],
      messageMeta: {},
    });
    // Only a per-tab copy from before v8.9.3 has a maximum age; a project's conversation has none.
    expect(reviveStoredConversation(expired, 48 * 60 * 60 * 1000)).toBeNull();
    expect(reviveStoredConversation(expired)?.messages).toHaveLength(1);
  });

  it('round-trips the conversation id another tab compares against', () => {
    const payload = serializeConversation([msg({ id: 'a' })], {}, 'conv-1');
    expect(payload!.startsWith('{"savedAt":')).toBe(true); // assistantStorage reads it to evict
    expect(reviveStoredConversation(payload)!.conversationId).toBe('conv-1');
  });

  it('skips entries that lost their required shape', () => {
    const payload = JSON.stringify({
      savedAt: Date.now(),
      messages: [
        { id: 'ok', role: 'assistant', content: 'kept' },
        { role: 'assistant', content: 'no id' },
        'garbage',
        null,
      ],
      messageMeta: {},
    });
    const revived = reviveStoredConversation(payload);
    expect(revived).not.toBeNull();
    expect(revived!.messages.map((m) => m.id)).toEqual(['ok']);
  });
});

describe('reviveStoredConversation drops what the renderers would crash on', () => {
  const stored = (messages: unknown[], messageMeta: unknown = {}) =>
    JSON.stringify({ savedAt: Date.now(), conversationId: 'c', messages, messageMeta });

  it('drops a run card without the lists the card reads, and the message if it was only the card', () => {
    const revived = reviveStoredConversation(
      stored([
        { id: 'bad-card', role: 'assistant', content: '', specDriven: { status: 'done', text: '' } },
        { id: 'bad-card-with-text', role: 'assistant', content: 'Here it is', specDriven: { status: 'odd' } },
        {
          id: 'good-card',
          role: 'assistant',
          content: '',
          specDriven: { status: 'done', text: '', phases: [], warnings: [], changedFiles: 'not a list' },
        },
      ]),
    );
    expect(revived!.messages.map((m) => m.id)).toEqual(['bad-card-with-text', 'good-card']);
    expect(revived!.messages[0].specDriven).toBeUndefined();
    expect(revived!.messages[1].specDriven).toMatchObject({ status: 'done', phases: [] });
    expect(revived!.messages[1].specDriven!.changedFiles).toBeUndefined();
  });

  it('keeps only message details of the right type', () => {
    const revived = reviveStoredConversation(
      stored([{ id: 'a', role: 'assistant', content: 'hi' }], {
        a: { suggestedActions: [{ label: 'Go' }], badge: 'generation', badgeLabel: 7 },
      }),
    );
    expect(revived!.messageMeta.a).toEqual({ badge: 'generation' });
  });

  it('reads a new chat (no messages) with its conversation id', () => {
    expect(reviveStoredConversation(stored([]))).toMatchObject({ messages: [], conversationId: 'c' });
  });
});
