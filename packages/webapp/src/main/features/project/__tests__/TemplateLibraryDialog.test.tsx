import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { TemplateLibraryDialog } from '../TemplateLibraryDialog';

vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  // selectActiveDiagramType → ClassDiagram; selectProject → no project.
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ workspace: { activeDiagramType: 'ClassDiagram', project: null } }),
}));

const renderDialog = () =>
  render(
    <MemoryRouter>
      <TemplateLibraryDialog open onOpenChange={() => {}} />
    </MemoryRouter>,
  );

describe('TemplateLibraryDialog', () => {
  it('opens with focus on the selected category, so focus and selection never disagree', () => {
    renderDialog();
    const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    // Active diagram is ClassDiagram -> the structural category, not the first one (Full Project).
    expect(pressed[0].getAttribute('data-category')).not.toBe(
      screen.getAllByRole('button').find((b) => b.hasAttribute('data-category'))?.getAttribute('data-category'),
    );
    expect(document.activeElement).toBe(pressed[0]);
  });

  it('exposes template tiles as a keyboard-operable radiogroup', () => {
    renderDialog();
    const group = screen.getByRole('radiogroup');
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(1);
    expect(group.contains(radios[0])).toBe(true);

    // Exactly one tile is checked and it is the only tab stop (roving tabindex).
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual(checked);

    // ArrowDown moves selection and focus to the next tile.
    const start = radios.indexOf(checked[0]);
    fireEvent.keyDown(checked[0], { key: 'ArrowDown' });
    const next = screen.getAllByRole('radio')[(start + 1) % radios.length];
    expect(next.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(next);

    // Space on another tile selects it.
    const other = screen.getAllByRole('radio')[start];
    fireEvent.keyDown(other, { key: ' ' });
    expect(other.getAttribute('aria-checked')).toBe('true');
  });
});
