import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const toastMock = vi.hoisted(() => {
  const fn: any = vi.fn();
  for (const k of ['success', 'error', 'warning', 'info', 'loading', 'dismiss']) fn[k] = vi.fn();
  return fn;
});
const project = vi.hoisted(() => ({ current: null as any }));
vi.mock('react-toastify', () => ({ toast: toastMock }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }), useNavigate: () => vi.fn() }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project.current }) }));
vi.mock('../hooks/useGenerateCode', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useGenerateCode: () => vi.fn(),
}));
vi.mock('../hooks/useDeployLocally', () => ({ useDeployLocally: () => vi.fn() }));

import { useGeneratorExecution } from '../useGeneratorExecution';

// Live report: Quality check on the GUI / Quantum editor raised a red error
// toast reading "coming soon" -- an error for something the user did right.
describe('Quality check on editors without validation', () => {
  afterEach(() => Object.values(toastMock).forEach((f: any) => f.mockClear?.()));

  it.each(['GUINoCodeDiagram', 'QuantumCircuitDiagram'])('is a neutral notice on %s', async (type) => {
    project.current = { id: 'p', name: 'P', currentDiagramType: type, diagrams: {}, currentDiagramIndices: {} };
    const { result } = renderHook(() => useGeneratorExecution(undefined));
    await expect(result.current.handleQualityCheck()).resolves.toEqual({ executed: false, passed: false });
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.info).toHaveBeenCalledWith('Quality check is not available for this editor yet.');
  });
});
