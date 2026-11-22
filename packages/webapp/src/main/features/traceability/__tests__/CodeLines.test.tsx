import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeLines } from '../components/CodeLines';

describe('CodeLines', () => {
  it('says secrets are redacted when a line holds the redaction mark', () => {
    render(<CodeLines lines={['import os', 'SECRET_KEY = "[REDACTED]"']} />);
    expect(screen.getByText(/redacted in the stored copy/i)).toBeTruthy();
  });

  it('shows no note for code without the mark', () => {
    render(<CodeLines lines={['import os']} />);
    expect(screen.queryByText(/redacted/i)).toBeNull();
  });
});
