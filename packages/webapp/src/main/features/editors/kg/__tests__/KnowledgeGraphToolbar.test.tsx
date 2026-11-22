/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphToolbar } from '../KnowledgeGraphToolbar';

const renderToolbar = (props: Partial<React.ComponentProps<typeof KnowledgeGraphToolbar>> = {}) => {
  const handlers = { onUndo: vi.fn(), onRedo: vi.fn(), onConnectModeChange: vi.fn() };
  render(
    <KnowledgeGraphToolbar
      connectMode="off"
      nodeCount={3}
      edgeCount={2}
      hiddenCount={0}
      canUndo
      canRedo
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('undo / redo buttons', () => {
  it('undo and redo call their handlers', () => {
    const { onUndo, onRedo } = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('are disabled when there is nothing to undo or redo', () => {
    const { onUndo, onRedo } = renderToolbar({ canUndo: false, canRedo: false });

    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    fireEvent.click(undo);
    fireEvent.click(redo);
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('enable independently', () => {
    renderToolbar({ canUndo: true, canRedo: false });

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('name their keyboard shortcut in the tooltip', () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', 'Undo (Ctrl+Z)');
    expect(screen.getByRole('button', { name: 'Redo' })).toHaveAttribute('title', 'Redo (Ctrl+Y)');
  });

  it('are not shown by hosts that offer no history', () => {
    render(
      <KnowledgeGraphToolbar connectMode="off" onConnectModeChange={vi.fn()} nodeCount={0} edgeCount={0} hiddenCount={0} />,
    );

    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
