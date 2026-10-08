import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormControl, FormField } from '../form-field';
import { Input } from '../input';
import { Textarea } from '../textarea';

describe('FormField', () => {
  it('links the error to a legacy htmlFor + id control', () => {
    render(
      <FormField label="Repository name" htmlFor="repo-name" error="Name is required">
        <Input id="repo-name" />
      </FormField>,
    );
    const input = screen.getByLabelText('Repository name');
    expect(input.id).toBe('repo-name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Name is required');
  });

  it('links helper text when there is no error', () => {
    render(
      <FormField label="Commit message" htmlFor="msg" helperText="Describe what changed">
        <Textarea id="msg" />
      </FormField>,
    );
    const textarea = screen.getByLabelText('Commit message');
    expect(textarea).not.toHaveAttribute('aria-invalid');
    expect(textarea).toHaveAccessibleDescription('Describe what changed');
  });

  it('FormControl wires generated ids without htmlFor', () => {
    render(
      <FormField label="Email" error="Invalid email">
        <FormControl>
          <Input />
        </FormControl>
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.id).not.toBe('');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Invalid email');
  });

  it('leaves non-matching children untouched', () => {
    render(
      <FormField label="Mode" htmlFor="mode" error="Pick one">
        <div data-testid="group">
          <input id="mode" />
        </div>
      </FormField>,
    );
    expect(screen.getByTestId('group')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Mode').id).toBe('mode');
  });

  it('FormControl outside a FormField is a passthrough', () => {
    render(
      <FormControl>
        <Input data-testid="bare" />
      </FormControl>,
    );
    const input = screen.getByTestId('bare');
    expect(input).not.toHaveAttribute('id');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});
