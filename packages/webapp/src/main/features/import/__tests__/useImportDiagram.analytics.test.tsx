/**
 * A diagram import is reported once: `diagram_imported` with its format and type,
 * or `diagram_import_failed` with which step failed. Never the file or diagram name.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureEvent = vi.hoisted(() => vi.fn());
const dispatch = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../../app/store/workspaceSlice', () => ({
  bumpEditorRevision: () => ({ type: 'bump' }),
  loadProjectThunk: () => ({ type: 'load' }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../useBumlToDiagram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../useBumlToDiagram')>()),
  useBumlToDiagram: () => vi.fn(),
}));
vi.mock('../useImportBpmnXml', () => ({ useImportBpmnXml: () => vi.fn() }));

import { useImportDiagramToProject } from '../useImportDiagram';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, MAX_DIAGRAMS_PER_TYPE } from '../../../shared/types/project';

const diagramFile = (name: string) =>
  new File(
    [JSON.stringify({ id: 'x', title: 'Acme Orders', model: { type: 'ClassDiagram', version: '3.0.0', elements: {}, relationships: {} } })],
    name,
    { type: 'application/json' },
  );

async function importFile(file: File) {
  const { result } = renderHook(() => useImportDiagramToProject());
  await act(async () => {
    await result.current(file).catch(() => undefined);
  });
  return captureEvent.mock.calls.filter(([event]) => event.startsWith('diagram_import'));
}

beforeEach(() => {
  captureEvent.mockClear();
  vi.restoreAllMocks();
  vi.spyOn(ProjectStorageRepository, 'saveProject').mockImplementation(() => undefined as never);
});

describe('diagram import analytics', () => {
  it('reports an imported diagram with its format and type, never its name', async () => {
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(createDefaultProject('Acme', '', ''));
    const events = await importFile(diagramFile('acme-orders.json'));
    expect(events).toEqual([['diagram_imported', { format: 'json', diagram_type: 'ClassDiagram', source: 'file' }]]);
    expect(JSON.stringify(events)).not.toMatch(/acme/i);
  });

  it('reports an unsupported file', async () => {
    const events = await importFile(new File(['x'], 'model.txt', { type: 'text/plain' }));
    expect(events).toEqual([
      ['diagram_import_failed', { format: 'unsupported', source: 'file', reason: 'unsupported', error_type: 'Error', network_error: false }],
    ]);
  });

  it('reports a project that already has the most diagrams of that type', async () => {
    const project = createDefaultProject('Acme', '', '');
    project.diagrams.ClassDiagram = Array.from({ length: MAX_DIAGRAMS_PER_TYPE }, (_, i) => ({
      ...project.diagrams.ClassDiagram[0],
      id: `d${i}`,
    }));
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(project);
    const events = await importFile(diagramFile('acme-orders.json'));
    expect(events).toEqual([
      ['diagram_import_failed', { format: 'json', source: 'file', reason: 'limit_reached', error_type: 'Error', network_error: false }],
    ]);
  });
});
