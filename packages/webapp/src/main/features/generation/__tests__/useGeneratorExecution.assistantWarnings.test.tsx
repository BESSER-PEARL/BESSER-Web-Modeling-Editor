/**
 * An assistant-requested generation (handleAssistantGenerate) of a model that
 * validates with warnings asks first, like the menu (#752): declining generates
 * nothing and resolves with `warnings_declined`, which the assistant reports
 * to the agent. Only validation, the confirm dialog and the network are mocked.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultProject } from '../../../shared/types/project';
import { track } from '../../../shared/services/analytics/events';
import { generateFromDiagram } from '../../../shared/api/generation';
import { validateDiagram } from '../../../shared/services/validation/validateDiagram';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import { useGeneratorExecution } from '../useGeneratorExecution';
import type { GenerationResult } from '../types';

const project = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }), useNavigate: () => vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project.current }) }));
vi.mock('../hooks/useDeployLocally', () => ({ useDeployLocally: () => vi.fn() }));
vi.mock('../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => vi.fn() }));
vi.mock('../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));
vi.mock('../../../shared/services/validation/validateDiagram', () => ({ validateDiagram: vi.fn() }));
vi.mock('../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));
vi.mock('../../../shared/api/generation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/generation')>()),
  generateFromDiagram: vi.fn(),
}));
vi.mock('../../../shared/services/analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/analytics/events')>()),
  track: vi.fn(),
}));

const editor = { model: { type: 'ClassDiagram', elements: { a: {} }, relationships: {} } } as never;
const sent = (event: string) => vi.mocked(track).mock.calls.filter(([name]) => name === event).map(([, props]) => props);

const generateFromAssistant = async (): Promise<GenerationResult> => {
  const { result } = renderHook(() => useGeneratorExecution(editor));
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await result.current.handleAssistantGenerate('sql');
  });
  return outcome!;
};

describe('handleAssistantGenerate with validation warnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project.current = createDefaultProject('Shop', '', '');
    vi.mocked(validateDiagram).mockResolvedValue({
      isValid: true, errors: [], warnings: ['⚠️ Class Shop has no attributes'],
    } as never);
    vi.mocked(generateFromDiagram).mockResolvedValue({ blob: new Blob(['CREATE TABLE shop;']), headers: new Headers() } as never);
  });

  it('shows the warnings dialog and, when declined, generates nothing and resolves with warnings_declined', async () => {
    vi.mocked(globalConfirm).mockResolvedValue(false);

    const outcome = await generateFromAssistant();

    expect(globalConfirm).toHaveBeenCalledTimes(1);
    expect(vi.mocked(globalConfirm).mock.calls[0][0].description).toContain('Class Shop has no attributes');
    expect(generateFromDiagram).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false, reason: 'warnings_declined' });
    expect(sent('generator_blocked')).toEqual([
      expect.objectContaining({ generator_type: 'sql', source: 'assistant', reason: 'warnings_declined' }),
    ]);
    expect(sent('generator_failed')).toHaveLength(0);
  });

  it('generates, with the download deferred to the assistant card, when the user goes ahead', async () => {
    vi.mocked(globalConfirm).mockResolvedValue(true);

    const outcome = await generateFromAssistant();

    expect(globalConfirm).toHaveBeenCalledTimes(1);
    expect(generateFromDiagram).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.blob).toBeInstanceOf(Blob);
  });
});
