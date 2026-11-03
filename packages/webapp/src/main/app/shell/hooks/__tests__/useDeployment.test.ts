/**
 * The deploy analytics events carry no repository name, owner or URL: the
 * privacy policy promises no project names and no personal identity.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BesserProject } from '../../../../shared/types/project';

const posthog = vi.hoisted(() => ({ capture: vi.fn() }));
const deployToRender = vi.hoisted(() => vi.fn());

vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({ getPostHog: () => posthog }));
vi.mock('../../../../shared/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ isAuthenticated: true, githubSession: 'session' }),
}));
vi.mock('../../../../features/deploy/hooks/useRenderDeploy', () => ({
  useRenderDeploy: () => ({ deployToRender, isDeploying: false, deploymentResult: null }),
}));
vi.mock('../../../../features/deploy/utils/restoreBaseAgentModels', () => ({
  restoreBaseAgentModels: (project: unknown) => project,
  stripAgentConfigToSystem: (project: unknown) => project,
}));
vi.mock('../../../../features/deploy/utils/agentPersonalizationPayload', () => ({
  buildPersonalizationMapping: () => [],
  hasPersonalizationVariants: () => false,
}));

import { useDeployment } from '../useDeployment';

const project = {
  id: 'p1',
  name: 'Hospital-Acme',
  currentDiagramType: 'ClassDiagram',
  diagrams: { ClassDiagram: [], GUINoCodeDiagram: [], AgentDiagram: [] },
} as unknown as BesserProject;

async function publish() {
  const { result } = renderHook(() => useDeployment({ currentProject: project, isDeploymentAvailable: true }));
  act(() => result.current.setGithubRepoName('hospital-acme'));
  await act(() => result.current.handlePublishToRender());
  expect(posthog.capture).toHaveBeenCalledTimes(1);
  return posthog.capture.mock.lastCall as [string, Record<string, unknown>];
}

beforeEach(() => {
  window.localStorage.clear();
  posthog.capture.mockClear();
  deployToRender.mockReset();
});

describe('useDeployment analytics', () => {
  it('render_deploy_success has no repo name, owner or URL', async () => {
    deployToRender.mockResolvedValue({
      success: true,
      repo_url: 'https://github.com/jdoe/hospital-acme',
      repo_name: 'hospital-acme',
      owner: 'jdoe',
      files_uploaded: 12,
    });
    const [event, properties] = await publish();
    expect(event).toBe('render_deploy_success');
    expect(properties).toEqual({
      deployment_status: 'success',
      is_private: true,
      files_uploaded: 12,
      is_redeployment: false,
      diagram_type: 'ClassDiagram',
      deployment_target: 'webapp',
    });
  });

  it('render_deploy_failure has no repo name', async () => {
    deployToRender.mockResolvedValue(null);
    const [event, properties] = await publish();
    expect(event).toBe('render_deploy_failure');
    expect(properties).toEqual({
      deployment_status: 'failed',
      is_private: true,
      diagram_type: 'ClassDiagram',
      deployment_target: 'webapp',
    });
  });
});
