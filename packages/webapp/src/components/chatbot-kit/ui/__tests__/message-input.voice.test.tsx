/**
 * Voice-input parity tests for MessageInput.
 *
 * Regression guard for the hackathon bug "voice works in the widget but not
 * the drawer": the mic control must render (and the voice path must be wired)
 * whenever `onVoiceSend` is supplied — regardless of which surface's prop set
 * is used. The widget and the drawer pass slightly different prop bags
 * (placeholder/onKeyDown vs lastSentMessage/onValueChange); voice support must
 * not depend on those.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageInput } from '../message-input';

// useAudioRecording gates the mic on navigator.mediaDevices.getUserMedia.
beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};

describe('MessageInput voice control parity', () => {
  it('renders the mic button with the WIDGET prop set', () => {
    render(
      <MessageInput
        value=""
        onChange={noop}
        onKeyDown={noop}
        placeholder="Describe what you want to create or modify..."
        onVoiceSend={vi.fn()}
        allowAttachments
        files={null}
        setFiles={noop}
        isGenerating={false}
        stop={noop}
      />,
    );
    expect(screen.getByLabelText('Start voice recording')).toBeInTheDocument();
  });

  it('renders the mic button with the DRAWER prop set', () => {
    render(
      <MessageInput
        value=""
        onChange={noop}
        onVoiceSend={vi.fn()}
        allowAttachments
        files={null}
        setFiles={noop}
        stop={noop}
        isGenerating={false}
        lastSentMessage=""
        onValueChange={noop}
      />,
    );
    expect(screen.getByLabelText('Start voice recording')).toBeInTheDocument();
  });

  it('hides the mic button when onVoiceSend is omitted', () => {
    render(
      <MessageInput
        value=""
        onChange={noop}
        allowAttachments
        files={null}
        setFiles={noop}
        isGenerating={false}
        stop={noop}
      />,
    );
    expect(screen.queryByLabelText('Start voice recording')).not.toBeInTheDocument();
  });
});
