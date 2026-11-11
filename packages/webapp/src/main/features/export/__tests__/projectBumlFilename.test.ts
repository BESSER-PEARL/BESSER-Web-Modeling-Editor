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
// The code downloads `response.blob()`. Node's Response yields a Node Blob,
// which jsdom's FileReader rejects, so the stub answers with a jsdom Blob.
function stubFetch(headers?: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(headers), blob: async () => new Blob(['x']) })),
  );
}

async function expectDownloaded(filename: string, body: string) {
  expect(downloadFile).toHaveBeenCalledTimes(1);
  const [blob, name] = downloadFile.mock.calls[0];
  expect(name).toBe(filename);
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  expect(text).toBe(body);
}

describe('project B-UML export file name', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    downloadFile.mockReset();
  });

  it('is the project name, not the name prefixed to the backend default', async () => {
    stubFetch({ 'Content-Disposition': 'attachment; filename="project.py"' });
    await exportProjectAsSingleBUMLFile({ id: 'p1', name: 'New Project' } as any);
    await expectDownloaded('new_project.py', 'x');
  });

  it('falls back to .py without a header', async () => {
    stubFetch();
    await exportProjectAsSingleBUMLFile({ id: 'p1', name: 'Library' } as any);
    await expectDownloaded('library.py', 'x');
  });
});
