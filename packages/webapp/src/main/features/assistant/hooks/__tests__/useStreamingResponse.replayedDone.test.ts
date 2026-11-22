/**
 * A reconnect can lose every chunk of a streamed reply; the agent then replays
 * only the stream's stream_done (with fullText). It must still render.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { useStreamingResponse } from '../useStreamingResponse';

const apply = (
  handle: ReturnType<typeof useStreamingResponse>['handleStreamingAction'],
  payload: Record<string, unknown>,
  prev: ChatKitMessage[],
): ChatKitMessage[] => {
  let next = prev;
  handle(payload as never, (update) => {
    next = typeof update === 'function' ? update(next) : update;
  });
  return next;
};

describe('useStreamingResponse — replayed stream_done', () => {
  it('renders the full text when no chunk of the stream arrived', () => {
    const { result } = renderHook(() => useStreamingResponse());
    const out = apply(result.current.handleStreamingAction, { action: 'stream_done', streamId: 's1', fullText: 'The model.' }, []);
    const msg = out.find((m) => m.id === 's1');
    expect(msg?.content).toBe('The model.');
    expect(msg?.isStreaming).toBe(false);
  });

  it('completes an existing partial stream in place', () => {
    const { result } = renderHook(() => useStreamingResponse());
    const partial = [{ id: 's1', role: 'assistant', content: 'The ', isStreaming: true, createdAt: new Date() }] as ChatKitMessage[];
    const out = apply(result.current.handleStreamingAction, { action: 'stream_done', streamId: 's1', fullText: 'The model.' }, partial);
    expect(out.filter((m) => m.id === 's1')).toHaveLength(1);
    expect(out.find((m) => m.id === 's1')?.content).toBe('The model.');
  });
});
