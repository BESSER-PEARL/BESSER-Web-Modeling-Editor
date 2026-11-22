/**
 * The real generation entry points report each run exactly once: generator_used on
 * success, generator_failed with the error kind on failure, and the source (menu or
 * assistant). Only the network layer and the hook's neighbours are mocked.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/api-client';
import { createDefaultProject } from '../../../shared/types/project';
import { track } from '../../../shared/services/analytics/events';
import { useGeneratorExecution } from '../useGeneratorExecution';

const generateCode = vi.hoisted(() => vi.fn());
const project = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }), useNavigate: () => vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project.current }) }));
vi.mock('../hooks/useGenerateCode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useGenerateCode')>()),
  useGenerateCode: () => generateCode,
}));
vi.mock('../hooks/useDeployLocally', () => ({ useDeployLocally: () => vi.fn() }));
vi.mock('../../../shared/services/analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/analytics/events')>()),
  track: vi.fn(),
}));

const editor = { model: { type: 'ClassDiagram', elements: {}, relationships: {} } } as never;
const sent = (event: string) => vi.mocked(track).mock.calls.filter(([name]) => name === event).map(([, props]) => props);

describe('useGeneratorExecution analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    project.current = createDefaultProject('Acme Secret', '', '');
  });

  it('reports a menu generation once, as generator_used from the menu', async () => {
    generateCode.mockResolvedValue({ ok: true, filename: 'python_classes.zip' });
    const { result } = renderHook(() => useGeneratorExecution(editor));

    await act(async () => {
      await result.current.handleGenerateRequest('python');
    });

    expect(sent('generator_used')).toEqual([
      expect.objectContaining({ generator_type: 'python', source: 'menu', diagram_type: 'ClassDiagram', duration_ms: expect.any(Number) }),
    ]);
    expect(sent('generator_failed')).toHaveLength(0);
  });

  it('reports an assistant generation that the backend rejected as generator_failed with its status', async () => {
    generateCode.mockResolvedValue({ ok: false, error: 'Acme detail', reason: 'request', cause: new ApiError(500, 'Acme') });
    const { result } = renderHook(() => useGeneratorExecution(editor));

    await act(async () => {
      await result.current.handleAssistantGenerate('python');
    });

    expect(sent('generator_failed')).toEqual([
      expect.objectContaining({ generator_type: 'python', source: 'assistant', reason: 'request', error_type: 'ApiError', http_status: 500 }),
    ]);
    expect(sent('generator_used')).toHaveLength(0);
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/acme/i);
  });
});
