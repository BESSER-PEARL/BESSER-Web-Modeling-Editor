/**
 * An unreadable circuit file is a failure: it goes through reportError (error
 * toast + the caught error to Sentry), never window.alert(), and the circuit is
 * left as it was.
 */
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

const reportError = vi.fn();
vi.mock('../../../../shared/services/errors/reportError', () => ({
  reportError: (...args: unknown[]) => reportError(...args),
}));

import { useCircuitIO } from '../hooks/useCircuitIO';
import type { Circuit } from '../types';

describe('useCircuitIO import', () => {
  it('reports the parse failure with the caught error and keeps the circuit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const nativeAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const setCircuit = vi.fn();
    const { result } = renderHook(() => useCircuitIO({} as Circuit, { setCircuit }));

    const file = new File(['not json'], 'circuit.json', { type: 'application/json' });
    const target = { files: [file], value: 'circuit.json' };
    result.current.handleFileChange({ target } as unknown as React.ChangeEvent<HTMLInputElement>);

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith('Failed to parse JSON file or invalid format.', {
        error: expect.any(SyntaxError),
      }),
    );
    expect(nativeAlert).not.toHaveBeenCalled();
    expect(setCircuit).not.toHaveBeenCalled();
    expect(target.value).toBe('');
  });
});
