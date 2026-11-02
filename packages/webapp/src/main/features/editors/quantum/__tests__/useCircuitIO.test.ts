/**
 * An unreadable circuit file is reported in the app's dialog (globalAlert),
 * no longer with window.alert(), and the circuit is left as it was.
 */
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

const globalAlert = vi.fn((_options: { title: string }) => Promise.resolve());
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({
  globalAlert: (options: { title: string }) => globalAlert(options),
}));

import { useCircuitIO } from '../hooks/useCircuitIO';
import type { Circuit } from '../types';

describe('useCircuitIO import', () => {
  it('shows the parse failure in the app dialog and keeps the circuit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const nativeAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const setCircuit = vi.fn();
    const { result } = renderHook(() => useCircuitIO({} as Circuit, { setCircuit }));

    const file = new File(['not json'], 'circuit.json', { type: 'application/json' });
    const target = { files: [file], value: 'circuit.json' };
    result.current.handleFileChange({ target } as unknown as React.ChangeEvent<HTMLInputElement>);

    await waitFor(() =>
      expect(globalAlert).toHaveBeenCalledWith({ title: 'Failed to parse JSON file or invalid format.' }),
    );
    expect(nativeAlert).not.toHaveBeenCalled();
    expect(setCircuit).not.toHaveBeenCalled();
    expect(target.value).toBe('');
  });
});
