import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createDefaultProject, type BesserProject } from '../../../shared/types/project';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';

let mockProject: BesserProject | null = null;

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: mockProject }),
}));
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));
vi.mock('../../github/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ githubSession: null }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import { AgentConfigurationPanel } from '../AgentConfigurationPanel';
import { installPointerEventPolyfill } from './pointerEventPolyfill';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  installPointerEventPolyfill();
});

const withAgentConfig = (project: BesserProject, config: Record<string, unknown>): BesserProject => ({
  ...project,
  diagrams: {
    ...project.diagrams,
    AgentDiagram: project.diagrams.AgentDiagram.map((d, i) => (i === 0 ? { ...d, config } : d)),
  },
});

const pick = (combobox: HTMLElement, option: string) => {
  fireEvent.pointerDown(combobox, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};

describe('AgentConfigurationPanel hydration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps unsaved personalization edits when an unrelated project write lands', () => {
    const storedConfig = { agentStyle: 'formal' } as never;
    const saved = LocalStorageRepository.saveAgentConfiguration('Saved', storedConfig);
    LocalStorageRepository.setActiveAgentConfigurationId(saved.id);

    const base = withAgentConfig(createDefaultProject('P', '', 'me'), { agentStyle: 'formal' });
    mockProject = base;
    const { rerender } = render(<AgentConfigurationPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Personalization' }));
    fireEvent.click(screen.getByRole('button', { name: /Presentation/i }));
    const style = () => screen.getByRole('combobox', { name: 'Style' });
    expect(style()).toHaveTextContent('Formal');

    pick(style(), 'Informal');
    expect(style()).toHaveTextContent('Informal');

    // Same project, new object: e.g. the default LLM name was persisted.
    mockProject = withAgentConfig(base, { agentStyle: 'formal', default_llm_name: 'gpt' });
    rerender(<AgentConfigurationPanel />);

    expect(style()).toHaveTextContent('Informal');
    // Renders the whole panel through Radix selects: slower than 5 s when the full suite runs in parallel.
  }, 20_000);
});
