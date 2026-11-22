import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultProject, type BesserProject } from '../../../shared/types/project';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';

let mockProject: BesserProject | null = null;
vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: mockProject }) }));
vi.mock('../AgentRuntimePanel', () => ({
  AgentRuntimePanel: ({ updateAgentRuntimeConfig }: { updateAgentRuntimeConfig: (patch: object) => void }) => (
    <button onClick={() => updateAgentRuntimeConfig({ agentPlatform: 'telegram' })}>Change platform</button>
  ),
}));

import { AgentConfigurationPanel } from '../AgentConfigurationPanel';

describe('AgentConfigurationPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockProject = createDefaultProject('P', '', 'me');
  });

  it('shows runtime configuration without a personalization tab or profile controls', () => {
    render(<AgentConfigurationPanel />);
    expect(screen.getByRole('button', { name: 'Change platform' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /personalization/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save & apply configuration/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/map.*user profile/i)).not.toBeInTheDocument();
  });

  it('preserves existing variant data when runtime settings change', () => {
    const diagram = mockProject!.diagrams.AgentDiagram[0];
    diagram.config = { personalizedVariants: [{ id: 'saved-variant' }], activePersonalizedVariantId: 'saved-variant' };
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(mockProject!);
    const update = vi.spyOn(ProjectStorageRepository, 'updateDiagram').mockImplementation(() => undefined as never);
    render(<AgentConfigurationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Change platform' }));
    expect(update).toHaveBeenCalledWith(mockProject!.id, 'AgentDiagram', expect.objectContaining({
      config: expect.objectContaining({
        agentPlatform: 'telegram',
        personalizedVariants: [{ id: 'saved-variant' }],
        activePersonalizedVariantId: 'saved-variant',
      }),
    }), 0);
  });
});
