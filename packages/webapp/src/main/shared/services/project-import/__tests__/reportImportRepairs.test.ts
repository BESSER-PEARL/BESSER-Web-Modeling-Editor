import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast }));
vi.mock('../../../../features/assistant/hooks/useModelInjection', () => ({ centerEditorViewport: vi.fn() }));

import { reportImportRepairs } from '../reportImportRepairs';
import { importProjectFromBUML } from '../projectImport';
import { buildProjectExportEnvelope } from '../../../utils/projectExportUtils';
import { createDefaultProject } from '../../../types/project';
import { loadProjectTrace, setTraceStorage } from '../../../traceability/traceStore';
import { memoryTraceStorage } from '../../../traceability/traceDatabase';

const ownerEnd = (association: string, end: string) => ({
  code: 'buml-import-repaired',
  message: `Association '${association}': the non-composite end '${end}' of a composition must be navigable; made it navigable.`,
});

beforeEach(() => {
  setTraceStorage(memoryTraceStorage());
  toast.warn.mockReset();
  localStorage.clear();
});

describe('reportImportRepairs', () => {
  it('shows every repair, also when they share a code', () => {
    const repairs = [ownerEnd('Algorithme_elements', 'algorithme'), ownerEnd('Ressource_ports', 'ressource')];

    reportImportRepairs(repairs);

    expect(toast.warn.mock.calls.map((call) => call[0])).toEqual(repairs.map((r) => r.message));
  });

  it.each([undefined, null, 'oops', {}, [{ code: 'no-message' }, null, { message: '' }]])(
    'shows nothing for %j',
    (value) => {
      reportImportRepairs(value);

      expect(toast.warn).not.toHaveBeenCalled();
    },
  );
});

describe('importProjectFromBUML', () => {
  it('imports the project and shows what the backend repaired', async () => {
    const envelope = buildProjectExportEnvelope(createDefaultProject('algorithme', '', 'me'), undefined, {
      includePersonalization: false,
    });
    const repair = ownerEnd('Ressource_ports', 'ressource');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...envelope, warnings: [repair] }) }),
    );

    const project = await importProjectFromBUML(new File(['x = 1'], 'algorithme.py'));

    expect(project.name).toBe('algorithme');
    expect(toast.warn).toHaveBeenCalledWith(repair.message, expect.anything());
    vi.unstubAllGlobals();
  });

  it('imports the project without a trace and shows the backend\'s trace-not-imported warning', async () => {
    const project = createDefaultProject('algorithme', '', 'me');
    const envelope = buildProjectExportEnvelope(project, undefined, { includePersonalization: false });
    const warning = {
      code: 'trace-not-imported',
      message: 'The trace in this file could not be loaded and was not imported: unknown trace artifact.',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...envelope, trace: null, warnings: [warning] }) }),
    );

    const imported = await importProjectFromBUML(new File(['x = 1'], 'algorithme.py'));

    expect(imported.name).toBe('algorithme');
    expect(toast.warn).toHaveBeenCalledTimes(1);
    expect(toast.warn).toHaveBeenCalledWith(warning.message, expect.anything());
    expect((await loadProjectTrace(imported.id)).artifacts).toEqual([]); // imported without a trace
    vi.unstubAllGlobals();
  });
});
