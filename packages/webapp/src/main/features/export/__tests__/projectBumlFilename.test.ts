import { afterEach, describe, expect, it, vi } from 'vitest';

const downloadFile = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/utils/download', () => ({ downloadFile }));
vi.mock('../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { loadProject: () => null },
}));
vi.mock('../../../shared/utils/projectExportUtils', () => ({ buildProjectPayloadForBackend: (p: unknown) => p }));

import { exportProjectAsSingleBUMLFile } from '../useExportProjectBUML';

// Live report: the project B-UML export of "New Project" downloaded as
// "new_project_project.py" -- the project name prefixed to the backend's
// generic "project.py".
describe('project B-UML export file name', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    downloadFile.mockReset();
  });

  it('is the project name, not the name prefixed to the backend default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x', { headers: { 'Content-Disposition': 'attachment; filename="project.py"' } })),
    );
    await exportProjectAsSingleBUMLFile({ id: 'p1', name: 'New Project' } as any);
    expect(downloadFile).toHaveBeenCalledWith(expect.any(Blob), 'new_project.py');
  });

  it('falls back to .py without a header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x')));
    await exportProjectAsSingleBUMLFile({ id: 'p1', name: 'Library' } as any);
    expect(downloadFile).toHaveBeenCalledWith(expect.any(Blob), 'library.py');
  });
});
