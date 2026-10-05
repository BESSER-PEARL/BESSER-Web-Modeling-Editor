import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GuiEmptyState, pluralize } from '../GuiEmptyState';

const handlers = () => ({
  onGenerate: vi.fn(),
  onOpenBlocks: vi.fn(),
  onDescribe: vi.fn(),
  onAddClasses: vi.fn(),
});

describe('GuiEmptyState', () => {
  it('offers generation from the class diagram when classes exist', () => {
    const h = handlers();
    render(
      <GuiEmptyState
        classes={[
          { name: 'Book', attributes: ['title', 'isbn', 'year'] },
          { name: 'Author', attributes: ['name'] },
        ]}
        {...h}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Generate from class diagram/ }));
    expect(h.onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Add classes first/ })).not.toBeInTheDocument();
    // The illustration uses the user's own model: Book becomes a "Books" page.
    expect(screen.getByText('Books')).toBeInTheDocument();
  });

  it('sends the user to the Class editor when there are no classes', () => {
    const h = handlers();
    render(<GuiEmptyState classes={[]} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: /Add classes first/ }));
    expect(h.onAddClasses).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Generate from class diagram/ })).not.toBeInTheDocument();
  });

  it('wires the block and describe paths', () => {
    const h = handlers();
    render(<GuiEmptyState classes={[]} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: /Start from a block/ }));
    fireEvent.click(screen.getByRole('button', { name: /Describe the screen/ }));
    expect(h.onOpenBlocks).toHaveBeenCalledTimes(1);
    expect(h.onDescribe).toHaveBeenCalledTimes(1);
  });

  it('pluralizes the illustrated page title', () => {
    expect(pluralize('Book')).toBe('Books');
    expect(pluralize('Category')).toBe('Categories');
    expect(pluralize('Address')).toBe('Addresses');
    expect(pluralize('Day')).toBe('Days');
  });
});
