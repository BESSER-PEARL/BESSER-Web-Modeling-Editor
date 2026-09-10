/**
 * LiveSpecDrivenCard — the run card's own Redux subscription.
 *
 * The architectural fix for the "empty bubble until the run finishes"
 * bug: a live run's chat message is only a stub carrying
 * `specDriven.liveKey`; the card renders the slice entry
 * `specDriven.runs[liveKey]` via useAppSelector. These tests lock the
 * core guarantee — dispatching an SSE event into the slice updates what
 * the card renders WITHOUT any other trigger (no message write, no
 * parent re-render, no prop change).
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import {
  liveRunEnded,
  liveRunEvent,
  liveRunStarted,
  specDrivenReducer,
} from '@/main/features/spec-driven/state/specDrivenSlice';

// The card module imports the shared download helper; mock it so jsdom
// never deals with URL.createObjectURL / anchor clicks.
vi.mock('@/main/shared/utils/specDrivenDownload', () => ({
  fetchAndSaveSpecDrivenArtifact: vi.fn(() =>
    Promise.resolve({ ok: true, sizeBytes: 42 }),
  ),
}));

const LIVE_KEY = 'live-run-key-1';

function makeStore() {
  return configureStore({ reducer: { specDriven: specDrivenReducer } });
}

/** Render the stub message a live run puts into the chat. */
function renderLiveStub(store: ReturnType<typeof makeStore>) {
  return render(
    <Provider store={store}>
      <ChatMessage
        id="m1"
        role="assistant"
        content=""
        isStreaming
        specDriven={{
          liveKey: LIVE_KEY,
          phases: [],
          warnings: [],
          text: '',
          status: 'running',
        }}
      />
    </Provider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('LiveSpecDrivenCard — store-driven rendering', () => {
  it('renders live slice state and re-renders on each dispatched SSE event, with no prop change', () => {
    const store = makeStore();
    store.dispatch(liveRunStarted({ key: LIVE_KEY }));
    renderLiveStub(store);

    // Fresh run: no events yet.
    expect(screen.getByText(/waiting for the first event/i)).toBeTruthy();

    // A start event fills the header (provider / model) — via the store
    // alone; the rendered message props never change.
    act(() => {
      store.dispatch(
        liveRunEvent({
          key: LIVE_KEY,
          event: {
            event: 'start',
            runId: 'a'.repeat(32),
            provider: 'anthropic',
            llmModel: 'claude-sonnet-4-6',
            maxCost: 1.0,
            maxRuntime: 600,
          },
        }),
      );
    });
    expect(screen.getByText(/anthropic/)).toBeTruthy();

    // A phase event appends a timeline row.
    act(() => {
      store.dispatch(
        liveRunEvent({
          key: LIVE_KEY,
          event: { event: 'phase', phase: 'generate', message: '' },
        }),
      );
    });
    expect(screen.getByText('Running deterministic generator')).toBeTruthy();
    expect(screen.queryByText(/waiting for the first event/i)).toBeNull();

    // A text delta streams into the card body.
    act(() => {
      store.dispatch(
        liveRunEvent({
          key: LIVE_KEY,
          event: { event: 'text', delta: 'Scaffolding your app…' },
        }),
      );
    });
    expect(screen.getByText(/scaffolding your app/i)).toBeTruthy();
  });

  it('falls back to the message snapshot when the live entry is gone (finalized elsewhere)', () => {
    const store = makeStore();
    store.dispatch(liveRunStarted({ key: LIVE_KEY }));
    renderLiveStub(store);

    act(() => {
      store.dispatch(
        liveRunEvent({
          key: LIVE_KEY,
          event: { event: 'phase', phase: 'select', message: '' },
        }),
      );
      store.dispatch(liveRunEnded({ key: LIVE_KEY }));
    });

    // No crash, and the card renders the (stub) message snapshot again.
    expect(screen.getByText(/waiting for the first event/i)).toBeTruthy();
  });

  it('a message WITHOUT a liveKey renders the plain card and never touches the store', () => {
    // No Provider at all — historical/final cards must not subscribe.
    render(
      <ChatMessage
        id="m2"
        role="assistant"
        content=""
        specDriven={{
          runId: 'f'.repeat(32),
          phases: [
            { phase: 'generate', label: 'Generated', message: '', toolCalls: [] },
          ],
          warnings: [],
          text: '',
          status: 'done',
          fileName: 'out.zip',
          isZip: true,
        }}
      />,
    );
    expect(screen.getByText('Application ready')).toBeTruthy();
  });
});
