import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject, getActiveDiagram } from '../../../../shared/types/project';
import { workspaceReducer, type WorkspaceState } from '../../../../app/store/workspaceSlice';
import { BesserEditorProvider } from '../besser-editor-context';
import { BesserEditorComponent } from '../BesserEditorComponent';

const created: Array<{ options: Record<string, unknown>; errorListeners: Array<(e: unknown) => void> }> = [];

vi.mock('@besser/wme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@besser/wme')>();
  class FakeEditor {
    nextRender = Promise.resolve();
    model: unknown = undefined;
    constructor(_container: HTMLElement, public options: Record<string, unknown>) {
      created.push(this);
    }
    errorListeners: Array<(e: unknown) => void> = [];
    subscribeToModelChange() {
      return 1;
    }
    subscribeToBesserErrors(callback: (e: unknown) => void) {
      this.errorListeners.push(callback);
      return 2;
    }
    unsubscribeFromModelChange() {}
    setAgentDiagramLinker() {}
    setLineageProvider() {}
    setElementPickerProvider() {}
    destroy() {}
  }
  return { ...actual, BesserEditor: FakeEditor };
});

const toastError = vi.fn();
const toastInfo = vi.fn();
vi.mock('react-toastify', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
    success: vi.fn(),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

const mount = (model: unknown) => {
  const project = createDefaultProject('P', '', '');
  const diagram = getActiveDiagram(project, 'ClassDiagram')!;
  diagram.title = 'Library';
  diagram.model = model as any;
  const initial = workspaceReducer(undefined, { type: '@@init' });
  const workspace: WorkspaceState = {
    ...initial,
    project,
    activeDiagramType: 'ClassDiagram',
    activeDiagramIndex: 0,
    activeDiagram: diagram,
    editorRevision: 1,
  };
  const store = configureStore({ reducer: { workspace: workspaceReducer }, preloadedState: { workspace } });
  render(
    <Provider store={store}>
      <BesserEditorProvider value={{ setEditor: () => {} }}>
        <BesserEditorComponent />
      </BesserEditorProvider>
    </Provider>,
  );
};

describe('BesserEditorComponent with a v3 model that failed to migrate', () => {
  afterEach(() => {
    created.length = 0;
    toastError.mockClear();
    toastInfo.mockClear();
  });

  it('opens the editor read-only and names the diagram in an error toast', async () => {
    mount({
      version: '3.0.0',
      type: 'ClassDiagram',
      elements: { c1: { id: 'c1', name: 'Ship', type: 'Class', owner: null } },
      relationships: {},
    });

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].options.readonly).toBe(true);
    expect(String(toastError.mock.calls[0]?.[0])).toContain('Library');
  });

  // Live: once the toast faded the read-only diagram was a blank canvas with
  // no explanation.
  it('keeps a notice on the canvas that names the diagram and how to recover it', async () => {
    mount({
      version: '3.0.0',
      type: 'ClassDiagram',
      elements: { c1: { id: 'c1', name: 'Ship', type: 'Class', owner: null } },
      relationships: {},
    });

    const notice = await screen.findByTestId('legacy-diagram-notice');
    expect(notice.textContent).toContain('Library');
    expect(notice.textContent).toMatch(/read-only/i);
    expect(notice.textContent).toMatch(/import the original file again/i);
  });

  it('opens a v4 diagram editable and silently', async () => {
    mount({ version: '4.0.0', id: '', title: '', type: 'ClassDiagram', nodes: [], edges: [], assessments: {} });

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].options.readonly).toBeFalsy();
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.queryByTestId('legacy-diagram-notice')).toBeNull();
  });

  // Live: a cross-type paste was refused silently.
  it('shows one toast for the library paste-refused notice and none for internal warnings', async () => {
    mount({ version: '4.0.0', id: '', title: '', type: 'ClassDiagram', nodes: [], edges: [], assessments: {} });
    await waitFor(() => expect(created[0]?.errorListeners).toHaveLength(1));

    created[0].errorListeners[0]({ kind: 'pasteRefused', message: 'Cannot paste here.' });
    created[0].errorListeners[0]({ kind: 'diagramBridge.extractClasses', message: 'Malformed payload' });

    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo.mock.calls[0][0]).toBe('Cannot paste here.');
  });
});
