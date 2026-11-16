import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApollonEditor } from '@besser/wme';
import { focusElementOnCanvas } from '../../../../shared/utils/elementFocusSignal';
import { ModelFocusLayer } from '../ModelFocusLayer';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('ModelFocusLayer', () => {
  it('marks the focused element like the GitHub collaboration marks, until the next click', async () => {
    const node = document.createElement('div');
    node.setAttribute('data-id', 'c1');
    document.body.appendChild(node);
    const editor = { scrollToElement: () => {} } as unknown as ApollonEditor;
    render(<ModelFocusLayer />);

    expect(screen.queryByTestId('focused-element')).toBeNull();
    act(() => focusElementOnCanvas(editor, 'c1'));
    const mark = await screen.findByTestId('focused-element');
    expect(mark.style.boxShadow).toContain('hsl(var(--brand))');

    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('focused-element')).toBeNull();
  });
});
