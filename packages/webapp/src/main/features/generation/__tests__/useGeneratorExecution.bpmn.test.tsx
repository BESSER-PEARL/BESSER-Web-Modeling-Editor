/**
 * BPMN 2.0 XML comes from the backend BPMNGenerator. A browser-side export once
 * replaced it and dropped each flow node's <bpmn:incoming>/<bpmn:outgoing>.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultProject } from '../../../shared/types/project';
import { useGeneratorExecution } from '../useGeneratorExecution';

const generateCode = vi.hoisted(() => vi.fn());
const project = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }), useNavigate: () => vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project.current }) }));
vi.mock('../hooks/useGenerateCode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useGenerateCode')>()),
  useGenerateCode: () => generateCode,
}));
vi.mock('../hooks/useDeployLocally', () => ({ useDeployLocally: () => vi.fn() }));

const editor = { model: { version: '4.0.0', type: 'BPMN', nodes: [], edges: [] } } as never;

describe('useGeneratorExecution BPMN 2.0 XML', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    project.current = createDefaultProject('Orders', '', '');
  });

  it('sends the BPMN diagram to the backend generator', async () => {
    project.current.currentDiagramType = 'BPMN';
    generateCode.mockResolvedValue({ ok: true, filename: 'bpmn_diagram.bpmn' });
    const { result } = renderHook(() => useGeneratorExecution(editor));

    await act(async () => {
      await result.current.handleGenerateRequest('bpmn');
    });

    expect(generateCode).toHaveBeenCalledTimes(1);
    expect(generateCode.mock.calls[0].slice(0, 2)).toEqual([editor, 'bpmn']);
  });

  it('asks for a BPMN diagram when another editor is open', async () => {
    const { result } = renderHook(() => useGeneratorExecution(editor));

    await act(async () => {
      await result.current.handleGenerateRequest('bpmn');
    });

    expect(generateCode).not.toHaveBeenCalled();
  });
});
