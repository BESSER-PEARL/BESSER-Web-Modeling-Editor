import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaletteDropdown } from '../traits/PaletteDropdown';

const palettes = [
  ['#000000', '#111111'],
  ['#ffffff', '#eeeeee'],
];

describe('PaletteDropdown', () => {
  it('opens from the keyboard and reports the chosen palette', () => {
    const onChange = vi.fn();
    render(<PaletteDropdown palettes={palettes} value={0} onChange={onChange} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    fireEvent.click(options[1]);

    expect(onChange).toHaveBeenCalledWith(1);
  });
});
