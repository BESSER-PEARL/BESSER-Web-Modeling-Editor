import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAgentComponent } from '../component-registrars/registerAgentComponent';
import { registerChartComponent } from '../component-registrars/registerChartComponent';
import { registerMapComponent } from '../component-registrars/registerMapComponent';
import { registerMetricCardComponent } from '../component-registrars/registerMetricCardComponent';
import { registerTableComponent } from '../component-registrars/registerTableComponent';

/** Fake GrapesJS editor: records `Components.addType` definitions, no-ops the rest. */
const fakeEditor = () => {
  const types: Record<string, any> = {};
  const noop: any = new Proxy(() => noop, { get: () => noop });
  const editor: any = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === 'Components' ? { addType: (id: string, def: any) => (types[id] = def), getType: () => undefined } : noop,
    },
  );
  return { editor, types };
};

const removedHooks = (): Array<[string, (this: any) => void]> => {
  const { editor, types } = fakeEditor();
  const Dummy = () => null;
  registerAgentComponent(editor);
  registerChartComponent(editor, { id: 'bar-chart', label: 'Bar', component: Dummy, traits: [] } as any);
  registerMapComponent(editor, { id: 'map', label: 'Map', component: Dummy, traits: [] } as any);
  registerMetricCardComponent(editor, { id: 'metric-card', label: 'Metric', component: Dummy, traits: [] } as any);
  registerTableComponent(editor, { id: 'table', label: 'Table', component: Dummy, traits: [] } as any);
  return Object.entries(types).map(([id, def]) => [id, def.view.removed]);
};

afterEach(() => vi.restoreAllMocks());

describe('GUI component views unmount their React root outside a React render', () => {
  // Live: switching or importing a project destroys the GrapesJS editor from a
  // React effect cleanup, and each view's synchronous root.unmount() logged
  // "Attempted to synchronously unmount a root while React was already rendering".
  it.each(removedHooks())('%s', async (_id, removed) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('div');
    const view: any = { __reactRoot: ReactDOM.createRoot(host) };
    act(() => view.__reactRoot.render(<span>preview</span>));

    const Editor = () => {
      useEffect(() => () => removed.call(view), []);
      return null;
    };
    const { unmount } = render(<Editor />);
    act(() => unmount());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(view.__reactRoot).toBeNull();
    expect(host.innerHTML).toBe('');
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/synchronously unmount a root/);
  });
});
