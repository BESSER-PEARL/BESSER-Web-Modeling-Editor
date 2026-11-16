import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TextField } from '../fields';

describe('TextField secret', () => {
  it('masks the value and keeps it out of the DOM', () => {
    const onChange = vi.fn();
    render(<TextField id="sql-pass" label="password" secret value="not-a-real-password" onChange={onChange} />);
    const field = screen.getByLabelText('password') as HTMLInputElement;

    expect(field.type).toBe('password');
    expect(field.value).toBe('not-a-real-password');
    expect(field.hasAttribute('value')).toBe(false);

    fireEvent.change(field, { target: { value: 'changed' } });
    expect(onChange).toHaveBeenCalledWith('changed');
  });
});
