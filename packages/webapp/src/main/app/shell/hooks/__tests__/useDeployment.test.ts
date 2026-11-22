/**
 * The deploy analytics events carry no repository name, owner or URL: the
 * privacy policy promises no project names and no personal identity. A failed
 * deploy says where it failed and how (stage, HTTP status), never the message.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BesserProject } from '../../../../shared/types/project';
import { ApiError } from '../../../../shared/api/api-client';

const captureEvent = vi.hoisted(() => vi.fn());
const deployToRender = vi.hoisted(() => vi.fn());

vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));
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

async function publish(repoName = 'hospital-acme') {
  const { result } = renderHook(() => useDeployment({ currentProject: project, isDeploymentAvailable: true }));
  act(() => result.current.setGithubRepoName(repoName));
  await act(() => result.current.handlePublishToRender());
  // Only the deploy events (reportError adds its own error_shown).
  return (captureEvent.mock.calls as [string, Record<string, unknown>][]).filter(([event]) =>
    event.startsWith('render_deploy_'),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  captureEvent.mockClear();
  deployToRender.mockReset();
});

describe('useDeployment analytics', () => {
  it('reports the start, then a success with no repo name, owner or URL', async () => {
    deployToRender.mockResolvedValue({
      success: true,
      repo_url: 'https://github.com/jdoe/hospital-acme',
      repo_name: 'hospital-acme',
      owner: 'jdoe',
      files_uploaded: 12,
    });
    const calls = await publish();
    expect(calls.map(([event]) => event)).toEqual(['render_deploy_started', 'render_deploy_success']);
    expect(calls[0][1]).toEqual({
      deployment_target: 'webapp',
      is_private: true,
      is_redeployment: false,
      personalization: false,
    });
    expect(calls[1][1]).toEqual({
      deployment_status: 'success',
      is_private: true,
      files_uploaded: 12,
      is_redeployment: false,
      diagram_type: 'ClassDiagram',
      deployment_target: 'webapp',
      duration_ms: expect.any(Number),
    });
  });

  it('a failure carries the stage and HTTP status, never the message or repo name', async () => {
    deployToRender.mockResolvedValue({
      success: false,
      stage: 'github',
      error: new ApiError(403, 'Repository hospital-acme is not yours', 'jdoe/hospital-acme'),
    });
    const calls = await publish();
    const [event, properties] = calls[calls.length - 1];
    expect(event).toBe('render_deploy_failure');
    expect(properties).toEqual({
      deployment_status: 'failed',
      is_private: true,
      diagram_type: 'ClassDiagram',
      deployment_target: 'webapp',
      stage: 'github',
      duration_ms: expect.any(Number),
      error_type: 'ApiError',
      http_status: 403,
      network_error: false,
    });
    expect(JSON.stringify(calls)).not.toMatch(/hospital|jdoe/i);
  });

  it('reports a deploy blocked before it starts', async () => {
    const calls = await publish('   ');
    expect(calls).toEqual([['render_deploy_blocked', { reason: 'invalid_input' }]]);
    expect(deployToRender).not.toHaveBeenCalled();
  });
});
