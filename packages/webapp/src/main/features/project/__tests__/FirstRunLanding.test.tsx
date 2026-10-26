import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FirstRunLanding } from '../FirstRunLanding';

const renderLanding = (github: { connected: boolean; username: string | null; onConnect: () => void }) =>
  render(
    <Dialog open>
      <DialogContent>
        <FirstRunLanding onChoose={vi.fn()} onMoreOptions={vi.fn()} github={github} />
      </DialogContent>
    </Dialog>,
  );

describe('FirstRunLanding GitHub row', () => {
  it('offers to connect GitHub when signed out', () => {
    const onConnect = vi.fn();
    renderLanding({ connected: false, username: null, onConnect });

    expect(screen.getByText('Keep your projects in your own GitHub repositories')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('shows the connected account instead of the button when signed in', () => {
    renderLanding({ connected: true, username: 'octocat', onConnect: vi.fn() });

    expect(screen.getByText('Connected as octocat')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).toBeNull();
  });
});
