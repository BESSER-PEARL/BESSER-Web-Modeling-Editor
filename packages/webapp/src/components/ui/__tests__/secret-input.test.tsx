import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SecretInput } from '../secret-input';

const KEY = 'sk-test-not-a-real-key';

const Form = () => {
  const [value, setValue] = React.useState('');
  const [shown, setShown] = React.useState(true);
  return (
    <>
      {shown && <SecretInput aria-label="key" value={value} onChange={(e) => setValue(e.target.value)} />}
      <output>{value}</output>
      <button onClick={() => setValue('')}>clear</button>
      <button onClick={() => setShown((s) => !s)}>toggle</button>
    </>
  );
};

const field = () => screen.getByLabelText('key') as HTMLInputElement;

describe('SecretInput', () => {
  it('shows what the parent keeps, as a controlled input does', () => {
    const Trimming = () => {
      const [value, setValue] = React.useState('');
      return <SecretInput aria-label="key" value={value} onChange={(e) => setValue(e.target.value.trim())} />;
    };
    render(<Trimming />);
    fireEvent.change(field(), { target: { value: `${KEY} ` } });

    expect(field().value).toBe(KEY);
  });

  it('shows nothing for a missing value', () => {
    render(<SecretInput aria-label="key" value={undefined} onChange={() => {}} />);

    expect(field().value).toBe('');
  });

  it('is a password field that reports what is typed', () => {
    render(<Form />);
    fireEvent.change(field(), { target: { value: KEY } });

    expect(field().type).toBe('password');
    expect(field().value).toBe(KEY);
    expect(screen.getByRole('status').textContent).toBe(KEY);
  });

  it('never writes the value to the DOM, where a CSS selector could read it', () => {
    const { container } = render(<Form />);
    fireEvent.change(field(), { target: { value: KEY } });

    expect(field().hasAttribute('value')).toBe(false);
    expect(container.querySelector('input[value^="sk-"]')).toBeNull();
  });

  it('follows a value set from outside', () => {
    render(<Form />);
    fireEvent.change(field(), { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(field().value).toBe('');
  });

  it('shows the value again after being unmounted and mounted back', () => {
    render(<Form />);
    fireEvent.change(field(), { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(field().value).toBe(KEY);
    expect(field().hasAttribute('value')).toBe(false);
  });
});
