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
// The code downloads `response.blob()`. The stubbed fetch returns Node's
// Response, whose Blob is not jsdom's global `Blob`, so `expect.any(Blob)`
// would compare across realms. Check the payload by duck type and content.
async function expectDownloaded(filename: string, body: string) {
  expect(downloadFile).toHaveBeenCalledTimes(1);
  const [blob, name] = downloadFile.mock.calls[0];
  expect(name).toBe(filename);
  expect(typeof blob?.text).toBe('function');
  expect(await blob.text()).toBe(body);
}

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
    await expectDownloaded('new_project.py', 'x');
  });

  it('falls back to .py without a header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x')));
    await exportProjectAsSingleBUMLFile({ id: 'p1', name: 'Library' } as any);
    await expectDownloaded('library.py', 'x');
  });
});
