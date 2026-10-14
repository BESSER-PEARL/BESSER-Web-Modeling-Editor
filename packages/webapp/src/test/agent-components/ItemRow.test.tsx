import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemRow } from '@/main/features/agent-components/ui/ItemRow';

function renderRow(expanded = false) {
  const onToggle = vi.fn();
  const onDelete = vi.fn();
  render(
    <ItemRow name="greet" expanded={expanded} onToggle={onToggle} onDelete={onDelete}>
      <p>details</p>
    </ItemRow>,
  );
  return { onToggle, onDelete };
}

describe('ItemRow', () => {
  it('exposes the row header as a keyboard-reachable expandable button', () => {
    const { onToggle } = renderRow();
    const toggle = screen.getByRole('button', { name: /greet/, expanded: false });
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('gives the remove button a name and keeps it outside the toggle', () => {
    const { onToggle, onDelete } = renderRow(true);
    const remove = screen.getByRole('button', { name: 'Remove: greet' });
    const toggle = screen.getByRole('button', { name: /greet/, expanded: true });
    expect(toggle).not.toContainElement(remove);
    fireEvent.click(remove);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
