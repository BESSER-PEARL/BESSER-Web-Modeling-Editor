import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NestedCircuitModal } from '../components/NestedCircuitModal';
import { Gate } from '../types';

const functionGate: Gate = { id: 'f1', type: 'FUNCTION', label: 'QFT', isFunctionGate: true, height: 2 };

describe('NestedCircuitModal', () => {
  it('is an accessible dialog that closes on Escape', () => {
    const onClose = vi.fn();
    render(<NestedCircuitModal gate={functionGate} onClose={onClose} onSave={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Edit Function Gate' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByDisplayValue('QFT')).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
