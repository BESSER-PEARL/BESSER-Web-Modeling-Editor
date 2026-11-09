/**
 * A model that validates with warnings asks before it is generated, so a user
 * who wants to fix the warnings first does not spend a generation (#752).
 */
import { act, renderHook } from '@testing-library/react';
import type { ApollonEditor } from '@besser/wme';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateCode } from '../useGenerateCode';
import type { GenerationResult } from '../../types';
import { generateFromDiagram } from '../../../../shared/api/generation';
import { validateDiagram } from '../../../../shared/services/validation/validateDiagram';
import { globalConfirm } from '../../../../shared/services/confirm/globalConfirm';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => vi.fn() }));
vi.mock('../../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));
vi.mock('../../../../shared/services/validation/validateDiagram', () => ({ validateDiagram: vi.fn() }));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));
vi.mock('../../../../shared/api/generation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/api/generation')>()),
  generateFromDiagram: vi.fn(),
}));

const editor = { model: { type: 'ClassDiagram', elements: { a: {} }, relationships: {} } } as unknown as ApollonEditor;

const generateSql = async (): Promise<GenerationResult> => {
  const { result } = renderHook(() => useGenerateCode());
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await result.current(editor, 'sql', 'Shop', {}, { autoDownload: false });
  });
  return outcome!;
};

const validWith = (warnings: string[]) =>
  vi.mocked(validateDiagram).mockResolvedValue({ isValid: true, errors: [], warnings } as never);

describe('useGenerateCode with validation warnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateFromDiagram).mockResolvedValue({ blob: new Blob(['CREATE TABLE shop;']), headers: new Headers() } as never);
  });

  it('does not generate when the user chooses to fix the warnings first', async () => {
    validWith(['⚠️ Class Shop has no attributes']);
    vi.mocked(globalConfirm).mockResolvedValue(false);

    const outcome = await generateSql();

    expect(globalConfirm).toHaveBeenCalledTimes(1);
    expect(vi.mocked(globalConfirm).mock.calls[0][0].description).toContain('Class Shop has no attributes');
    expect(generateFromDiagram).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false, reason: 'warnings_declined' });
  });

  it('generates when the user chooses to go ahead', async () => {
    validWith(['⚠️ Class Shop has no attributes']);
    vi.mocked(globalConfirm).mockResolvedValue(true);

    const outcome = await generateSql();

    expect(generateFromDiagram).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(true);
  });

  it('generates without asking when there are no warnings', async () => {
    validWith([]);

    const outcome = await generateSql();

    expect(globalConfirm).not.toHaveBeenCalled();
    expect(generateFromDiagram).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(true);
  });
});
