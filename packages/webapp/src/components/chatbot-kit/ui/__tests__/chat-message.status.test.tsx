/**
 * Status badges ("Applied", "Error", …) must be visible without hover:
 * they render as a `status` line under the bubble, not inside the
 * hover-only `actions` toolbar.
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatMessage } from '../chat-message';

afterEach(cleanup);

describe('ChatMessage status', () => {
  it('renders the status outside the hover-only actions toolbar', () => {
    render(
      <ChatMessage
        id="m1"
        role="assistant"
        content="Done."
        status={<span>Applied</span>}
        actions={<span>Toolbar</span>}
      />,
    );
    const status = screen.getByText('Applied');
    const toolbar = screen.getByText('Toolbar').parentElement as HTMLElement;
    expect(toolbar.className).toContain('opacity-0');
    expect(toolbar.contains(status)).toBe(false);
    expect(status.closest('.opacity-0')).toBeNull();
  });

  it('reveals the actions toolbar on keyboard focus and on touch devices', () => {
    render(<ChatMessage id="m2" role="assistant" content="Hi" actions={<button>Copy</button>} />);
    const toolbar = screen.getByRole('button', { name: 'Copy' }).parentElement as HTMLElement;
    expect(toolbar.className).toContain('group-focus-within/message:opacity-100');
    expect(toolbar.className).toContain('[@media(hover:none)]:opacity-100');
    expect(toolbar.className).not.toContain('transition-all');
  });
});
