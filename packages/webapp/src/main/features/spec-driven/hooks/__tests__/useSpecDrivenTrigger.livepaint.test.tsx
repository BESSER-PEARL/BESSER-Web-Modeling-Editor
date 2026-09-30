/**
 * Live-paint integration test — the PRODUCTION wiring, end to end.
 *
 * Friday's refactor tests proved the slice and the card separately; this
 * test locks the whole assembled path the way the app actually runs it:
 * the REAL app store singleton (so slice registration in
 * `app/store/store.ts` is covered), the REAL shared
 * `assistantConversationStore` (module-level, `useSyncExternalStore`),
 * TWO mounted `useSpecDrivenTrigger` instances (widget + drawer, like
 * production), and the REAL `MessageList`/`ChatMessage`/
 * `LiveSpecDrivenCard` rendering in BOTH surfaces. Events are shaped
 * exactly like the backend's `sse_events.py` serialization (provider
 * "free", `servedModel` on cost, `fileSplit`/null `incompleteReason` on
 * done — fields hand-built fixtures tend to omit).
 *
 * The core guarantee: MID-RUN events paint in every mounted surface, by
 * construction, with no prop change and no message write.
 */
import React, { useSyncExternalStore } from 'react';
import { Provider } from 'react-redux';
import { act, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant/hooks/assistantConversationStore';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { SpecDrivenEvent, TriggerSpecDrivenPayload } from '@/main/features/spec-driven/types';
import {
  sessionStorageSpecDrivenApiKey,
  sessionStorageSpecDrivenProvider,
} from '@/main/shared/constants/constant';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

// Gated SSE mock — real-shaped events, paced like a live stream.
let pushEvent: (ev: SpecDrivenEvent) => void = () => {};
let closeStream: () => void = () => {};
vi.mock('@/main/features/spec-driven/services/specDrivenSseClient', () => ({
  followSpecDrivenRun: vi.fn(() => ({
    controller: new AbortController(),
    abort: vi.fn(),
    events: (async function* () {})(),
  })),
  startSpecDrivenRun: vi.fn(() => {
    const queue: SpecDrivenEvent[] = [];
    let notify: (() => void) | null = null;
    let closed = false;
    pushEvent = (ev) => {
      queue.push(ev);
      notify?.();
    };
    closeStream = () => {
      closed = true;
      notify?.();
    };
    return {
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        for (;;) {
          while (queue.length > 0) yield queue.shift()!;
          if (closed) return;
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
          notify = null;
        }
      })(),
    };
  }),
}));

vi.mock('@/main/features/spec-driven/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

interface SurfaceApi {
  handleTrigger: (p: TriggerSpecDrivenPayload) => Promise<void>;
}

function Surface({ apiRef }: { apiRef: { current: SurfaceApi | null } }) {
  const messages = useSyncExternalStore(
    conversationStore.subscribe,
    conversationStore.getMessages,
  );
  const [, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef<any>({
    id: 'proj-1',
    name: 'P',
    diagrams: { ClassDiagram: [{ id: 'cd1', title: 'd', model: {} }] },
    currentDiagramIndices: { ClassDiagram: 0 },
  });
  const hook = useSpecDrivenTrigger({
    currentProjectRef,
    setMessages: conversationStore.setMessages,
    setIsGenerating,
  });
  apiRef.current = { handleTrigger: hook.handleTrigger };
  return <MessageList messages={messages} isTyping={false} showTimeStamps={false} />;
}

const PAYLOAD: TriggerSpecDrivenPayload = {
  action: 'trigger_smart_generator',
  instructions: 'build it',
  provider: 'anthropic',
  message: 'Starting…',
  planApproved: true,
};

beforeEach(() => {
  conversationStore.clear();
  window.sessionStorage.clear();
  window.localStorage?.clear();
  window.sessionStorage.setItem(sessionStorageSpecDrivenApiKey, 'sk-test');
  window.sessionStorage.setItem(sessionStorageSpecDrivenProvider, 'anthropic');
});

afterEach(() => {
  cleanup();
  conversationStore.clear();
  window.localStorage?.clear();
});

describe('live-paint repro (production wiring)', () => {
  it('mid-run events paint in a second surface rendering the shared conversation', async () => {
    const apiA: { current: SurfaceApi | null } = { current: null };
    const apiB: { current: SurfaceApi | null } = { current: null };
    render(
      <Provider store={store}>
        <Surface apiRef={apiA} />
        <Surface apiRef={apiB} />
      </Provider>,
    );

    let run: Promise<void> = Promise.resolve();
    await act(async () => {
      run = apiA.current!.handleTrigger(PAYLOAD);
      await new Promise((r) => setTimeout(r, 10));
    });

    // Stub is on screen in BOTH surfaces.
    expect(screen.getAllByText(/waiting for the first event/i).length).toBe(2);

    // Real backend start event — exactly sse_events.py's serialization.
    await act(async () => {
      pushEvent({
        event: 'start',
        runId: '9b851145aaaaaaaaaaaaaaaaaaaaaaaa',
        provider: 'free',
        llmModel: 'qwen3-coder:30b',
        maxCost: 1.0,
        maxRuntime: 900,
      } as SpecDrivenEvent);
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      pushEvent({ event: 'phase', phase: 'select', message: 'Selecting generator' });
      pushEvent({
        event: 'cost',
        usd: 0.0,
        turns: 1,
        elapsedSeconds: 2.1,
        servedModel: 'qwen3-coder:30b',
      } as SpecDrivenEvent);
      await new Promise((r) => setTimeout(r, 10));
    });

    // THE assertion: the phase row painted mid-run in both surfaces.
    expect(screen.getAllByText('Selecting generator').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/waiting for the first event/i)).toBeNull();

    await act(async () => {
      pushEvent({
        event: 'done',
        runId: '9b851145aaaaaaaaaaaaaaaaaaaaaaaa',
        downloadUrl: '/besser_api/spec-driven/download/9b851145aaaaaaaaaaaaaaaaaaaaaaaa',
        fileName: 'out.zip',
        isZip: true,
        recipe: { generator_used: 'web_app' },
        fileCount: 12,
        topLevel: ['backend', 'frontend'],
        tokensUsed: 5000,
        incomplete: false,
        incompleteReason: null,
        blockerCount: 0,
        fileSplit: { generator_untouched: 10, llm_authored: 2, total: 12 },
      } as unknown as SpecDrivenEvent);
      closeStream();
      await run;
    });

    expect(screen.getAllByText('Application ready').length).toBeGreaterThanOrEqual(1);
  });
});
