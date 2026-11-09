import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import i18n from '../../../shared/i18n';
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

describe('FirstRunLanding translations', () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage('en'));
  });

  it('renders every visible string in English by default', () => {
    renderLanding({ connected: false, username: null, onConnect: vi.fn() });

    expect(screen.getByRole('heading', { name: /How do you want to\s*build\s*\?/ })).toBeTruthy();
    expect(screen.getByText('Welcome to BESSER')).toBeTruthy();
    expect(screen.getByText('Start modelling')).toBeTruthy();
    expect(screen.getByText('Start describing')).toBeTruthy();
    expect(screen.getByText('Free · hosted model')).toBeTruthy();
    expect(screen.getByText('Remember my choice and skip this next time')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
  });

  it('follows the selected language, not only on the GitHub row (issue #742)', async () => {
    await act(() => i18n.changeLanguage('ca'));
    renderLanding({ connected: false, username: null, onConnect: vi.fn() });

    expect(screen.getByRole('heading', { name: /Com vols\s*construir\s*\?/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Modela-ho' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Descriu-ho' })).toBeTruthy();
    expect(screen.getByText('Comença a modelar')).toBeTruthy();
    expect(screen.getByText('Recorda la meva elecció i omet això la propera vegada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Més opcions' })).toBeTruthy();
    expect(screen.queryByText('Model it')).toBeNull();
    expect(screen.queryByText('More options')).toBeNull();
  });
});
