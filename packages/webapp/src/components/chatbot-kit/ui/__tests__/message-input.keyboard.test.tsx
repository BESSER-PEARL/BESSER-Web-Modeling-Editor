/**
 * Composer keyboard behaviour.
 *
 * - Escape used to wipe the whole draft (a long prompt lost to one keypress).
 *   It now only steps out of the composer (blur), keeping the text, and only
 *   consumes the event when there was a draft — so on an empty composer the
 *   surface's own Escape (close the sheet / popup) still runs.
 * - Enter during IME composition (CJK input) used to submit the half-typed
 *   message; the Enter that confirms a composition must be left to the IME.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageInput } from '../message-input';

afterEach(() => {
  cleanup();
});

function renderComposer(value: string) {
  const onValueChange = vi.fn();
  const onChange = vi.fn();
  const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <MessageInput value={value} onChange={onChange} onValueChange={onValueChange} isGenerating={false} />
    </form>,
  );
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  return { textarea, onValueChange, onChange, onSubmit };
}

describe('MessageInput Escape', () => {
  it('keeps the draft and blurs the composer', () => {
    const { textarea, onValueChange, onChange } = renderComposer('a long prompt I do not want to lose');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    const notCancelled = fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(textarea);
    // It did something, so it claims the event (the drawer must not close too).
    expect(notCancelled).toBe(false);
  });

  it('leaves Escape unclaimed on an empty composer so the surface can close', () => {
    const { textarea } = renderComposer('');
    textarea.focus();

    const notCancelled = fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(notCancelled).toBe(true);
  });
});

describe('MessageInput Enter during IME composition', () => {
  it('submits on a plain Enter (control)', () => {
    const { textarea, onSubmit } = renderComposer('hello');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit while composing (isComposing)', () => {
    const { textarea, onSubmit } = renderComposer('こんにち');
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit on the legacy composition keyCode 229', () => {
    const { textarea, onSubmit } = renderComposer('こんにち');
    fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
