/**
 * The palette used to be a hand-built role="dialog" div: no aria-modal, no
 * focus trap and no combobox semantics, so screen readers could not tell
 * which command was highlighted. These pin the Radix dialog shell and the
 * combobox/listbox wiring while keeping the keyboard behaviour.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette, type CommandAction } from '../CommandPalette';

// jsdom has no layout, so no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);

const makeActions = () => {
  const first = vi.fn();
  const second = vi.fn();
  const actions: CommandAction[] = [
    { id: 'one', label: 'Switch to Class Diagram', icon: null, category: 'Editors', onSelect: first },
    { id: 'two', label: 'Export as JSON', icon: null, category: 'Actions', onSelect: second },
  ];
  return { actions, first, second };
};

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { actions } = makeActions();
    render(<CommandPalette open={false} onOpenChange={() => {}} actions={actions} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a modal dialog whose input is a combobox controlling a listbox', async () => {
    const { actions } = makeActions();
    render(<CommandPalette open onOpenChange={() => {}} actions={actions} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const input = screen.getByRole('combobox');
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute('aria-expanded', 'true');

    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('moves the active option with the arrow keys and runs it on Enter', async () => {
    const { actions, second } = makeActions();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} actions={actions} />);

    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
  });

  it('filters options and collapses the listbox when nothing matches', () => {
    const { actions } = makeActions();
    render(<CommandPalette open onOpenChange={() => {}} actions={actions} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'export' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);

    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('closes on Escape', () => {
    const { actions } = makeActions();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} actions={actions} />);

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
