/**
 * The modeling agent requests class-diagram generators the Generate menu does not list (`rest_api`, `rdf`): with a
 * non-UML tab open they still generate from the stored class diagram, like the menu's class generators. And every
 * class generator, Spring included, defers its download to the assistant's result card.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultProject } from '../../../shared/types/project';
import type { BesserProject } from '../../../shared/types/project';
import { generateFromDiagram } from '../../../shared/api/generation';
import { validateDiagram } from '../../../shared/services/validation/validateDiagram';
import { useGeneratorExecution } from '../useGeneratorExecution';
import type { GenerationResult } from '../types';

const project = vi.hoisted(() => ({ current: null as unknown }));
const download = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }), useNavigate: () => vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), warn: vi.fn() } }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: vi.fn() }));
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project.current }) }));
vi.mock('../hooks/useDeployLocally', () => ({ useDeployLocally: () => vi.fn() }));
vi.mock('../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => download }));
vi.mock('../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));
vi.mock('../../../shared/services/validation/validateDiagram', () => ({ validateDiagram: vi.fn() }));
vi.mock('../../../shared/api/generation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/generation')>()),
  generateFromDiagram: vi.fn(),
}));

const CLASS_MODEL = { version: '3.0.0', type: 'ClassDiagram', elements: { c1: { id: 'c1', type: 'Class', name: 'Book' } }, relationships: {} };

function projectWithClassDiagram(): BesserProject {
  const created = createDefaultProject('Library', '', 'Ada');
  created.settings = { ...created.settings, traceabilityEnabled: false };
  created.diagrams.ClassDiagram[0].model = CLASS_MODEL as never;
  return created;
}

async function generate(editor: unknown, generator: string, config?: unknown): Promise<GenerationResult> {
  const { result } = renderHook(() => useGeneratorExecution(editor as never));
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await result.current.handleAssistantGenerate(generator as never, config);
  });
  return outcome!;
}

describe('class-diagram generators the assistant requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project.current = projectWithClassDiagram();
    vi.mocked(validateDiagram).mockResolvedValue({ isValid: true, errors: [], warnings: [] } as never);
    vi.mocked(generateFromDiagram).mockResolvedValue({ blob: new Blob(['code']), headers: new Headers() } as never);
  });

  it.each(['rest_api', 'rdf'])('generates %s from the stored class diagram when no UML editor is open', async (generator) => {
    const outcome = await generate(null, generator);
    expect(outcome).toMatchObject({ ok: true, fromStoredModel: true });
    expect(vi.mocked(generateFromDiagram).mock.calls[0][0]).toMatchObject({ generator, model: CLASS_MODEL });
  });

  it('defers the Spring download to the assistant card', async () => {
    const editor = { model: CLASS_MODEL };
    const outcome = await generate(editor, 'spring', { project_name: 'p', app_name: 'App' });
    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.blob).toBeInstanceOf(Blob);
    expect(download).not.toHaveBeenCalled();
  });
});
