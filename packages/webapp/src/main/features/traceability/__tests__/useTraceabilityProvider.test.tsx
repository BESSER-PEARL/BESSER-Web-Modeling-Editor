/**
 * The editor gets a new traceability provider only when an element enters or leaves the trace, not on every
 * recorded edit (each one publishes a new trace).
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTraceabilityProvider } from '../useTraceabilityProvider';
import { loadProjectTrace, setTraceStorage, updateProjectTrace } from '../../../shared/traceability/traceStore';
import { memoryTraceStorage } from '../../../shared/traceability/traceDatabase';
import { createDefaultProject } from '../../../shared/types/project';

const now = '2026-10-30T10:00:00.000Z';

describe('useTraceabilityProvider', () => {
  beforeEach(() => setTraceStorage(memoryTraceStorage()));

  it('keeps its provider while the traced elements stay the same', async () => {
    const project = createDefaultProject('Library', '', 'Ada');
    await loadProjectTrace(project.id);
    await act(async () => {
      await updateProjectTrace(project.id, (trace) => {
        trace.artifacts.push({ id: 'b', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', timestamp: now });
      });
    });
    const { result } = renderHook(() => useTraceabilityProvider(project), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    const first = result.current;
    expect(first?.hasTrace('c1')).toBe(true);

    // An edit of a known element (a new change, a new code file): same elements, same provider.
    await act(async () => {
      await updateProjectTrace(project.id, (trace) => {
        trace.artifacts.push({ id: 'f', type: 'CodeArtifact', name: 'app.py', path: 'app.py', contentHash: 'h', timestamp: now });
      });
    });
    expect(result.current).toBe(first);

    // A new element: a new provider that knows it.
    await act(async () => {
      await updateProjectTrace(project.id, (trace) => {
        trace.artifacts.push({ id: 'm', type: 'ModelArtifact', name: 'Member', elementId: 'c2', elementType: 'Class', timestamp: now });
      });
    });
    expect(result.current).not.toBe(first);
    expect(result.current?.hasTrace('c2')).toBe(true);
  });
});
