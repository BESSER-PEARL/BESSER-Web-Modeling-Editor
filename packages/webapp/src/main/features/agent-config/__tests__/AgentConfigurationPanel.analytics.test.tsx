import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createDefaultProject, type BesserProject } from '../../../shared/types/project';

const captureEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));

let mockProject: BesserProject | null = null;
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: mockProject }),
}));
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));
vi.mock('../../../shared/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ githubSession: null }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import { AgentConfigurationPanel } from '../AgentConfigurationPanel';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

describe('AgentConfigurationPanel analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    captureEvent.mockClear();
  });

  // Renders the whole panel: ~2.5 s alone, past the 5 s default under full-suite load.
  it('tracks a Save & Apply that cannot run as a failed save, not a save', async () => {
    mockProject = createDefaultProject('P', '', 'me');
    render(<AgentConfigurationPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Personalization' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Apply Configuration' }));

    await waitFor(() =>
      expect(captureEvent).toHaveBeenCalledWith(
        'agent_config_action_failed',
        expect.objectContaining({ action: 'save' }),
      ),
    );
    expect(captureEvent).not.toHaveBeenCalledWith('agent_config_action', expect.anything());
  }, 15_000);
});
