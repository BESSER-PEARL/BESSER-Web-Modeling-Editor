/** The `show_trace` chip: its payload checks and its navigation to the Traceability page. */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { QuickActions } from '../../components/QuickActions';
import { readShowTrace, traceTargetOf, type GuiActionRouteInput } from '../suggestedActionRouting';
import { useOpenTraceability } from '../../../traceability';

afterEach(cleanup);

describe('readShowTrace', () => {
  it('accepts the three views, with or without an artifact', () => {
    for (const view of ['lineage', 'coverage', 'timeline']) {
      expect(readShowTrace({ view, message: 'Open it' }, 'fallback')).toEqual({ label: 'Open it', prompt: '', action: 'show-trace', traceView: view });
    }
    expect(readShowTrace({ view: 'coverage', artifactId: ' r1 ', message: 'Go' }, 'f')).toMatchObject({ traceArtifactId: 'r1' });
  });

  it('refuses an unknown view and ignores an artifact id that is not a short string', () => {
    expect(readShowTrace({ view: 'elements', message: 'x' }, 'f')).toBeNull();
    expect(readShowTrace({ view: 'LINEAGE', message: 'x' }, 'f')).toBeNull();
    expect(readShowTrace({ message: 'x' }, 'f')).toBeNull();
    expect(readShowTrace({ view: 'lineage', artifactId: 42, message: 'x' }, 'f')).not.toHaveProperty('traceArtifactId');
    expect(readShowTrace({ view: 'lineage', artifactId: 'a'.repeat(300), message: 'x' }, 'f')).not.toHaveProperty('traceArtifactId');
  });

  it('falls back to a default label and cuts a long one', () => {
    expect(readShowTrace({ view: 'lineage' }, 'Open the trace')!.label).toBe('Open the trace');
    expect(readShowTrace({ view: 'lineage', message: 'x'.repeat(500) }, 'f')!.label).toHaveLength(120);
  });
});

describe('traceTargetOf', () => {
  it('maps a show-trace chip to the page target and nothing else', () => {
    expect(traceTargetOf({ action: 'show-trace', traceView: 'lineage', traceArtifactId: 'book' })).toEqual({ tab: 'lineage', root: 'book' });
    expect(traceTargetOf({ action: 'show-trace', traceView: 'timeline' })).toEqual({ tab: 'timeline' });
    // "Open the history of Book": the element's own history, not the project's timeline.
    expect(traceTargetOf({ action: 'show-trace', traceView: 'timeline', traceArtifactId: 'book' })).toEqual({ tab: 'elements', element: 'book' });
    expect(traceTargetOf({ action: 'show-trace', traceView: 'coverage', traceArtifactId: 'book' })).toEqual({ tab: 'coverage', element: 'book' });
    expect(traceTargetOf({ action: 'show-trace', traceView: 'coverage' })).toEqual({ tab: 'coverage' });
    expect(traceTargetOf({ action: 'show-trace', traceView: 'bogus' })).toBeNull(); // e.g. a stored chip, tampered with
    expect(traceTargetOf({ action: 'open-gui' })).toBeNull();
    expect(traceTargetOf({ label: 'x', prompt: 'y' })).toBeNull();
    expect(traceTargetOf(null)).toBeNull();
  });
});

function Harness({ chip }: { chip: GuiActionRouteInput & { label: string; prompt: string } }) {
  const open = useOpenTraceability();
  const location = useLocation();
  return (
    <>
      <QuickActions
        actions={[chip]}
        onAction={(action) => {
          const target = traceTargetOf(action);
          if (target) open(target);
        }}
      />
      <output data-testid="url">{location.pathname + location.search}</output>
    </>
  );
}

describe('the chip in the chat', () => {
  const chip = { label: 'Open the lineage of Book', prompt: '', action: 'show-trace', traceView: 'lineage', traceArtifactId: 'book' };

  it('shows the label, does not navigate until clicked, then opens the view on the artifact', () => {
    render(<MemoryRouter initialEntries={['/']}><Harness chip={chip} /></MemoryRouter>);
    expect(screen.getByTestId('url').textContent).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: /Open the lineage of Book/ }));
    expect(screen.getByTestId('url').textContent).toBe('/traceability?tab=lineage&root=book');
  });

  it('opens a view without an artifact', () => {
    render(<MemoryRouter><Harness chip={{ label: 'Open the project timeline', prompt: '', action: 'show-trace', traceView: 'timeline' }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('url').textContent).toBe('/traceability?tab=timeline');
  });
});
