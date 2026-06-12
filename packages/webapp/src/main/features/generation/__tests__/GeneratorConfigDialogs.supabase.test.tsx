import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { GeneratorConfigDialogs } from '../dialogs/GeneratorConfigDialogs';
import type { ConfigDialog } from '../generator-dialog-config';

// The dialog component reads router + project context; neither matters for
// the Supabase dialog, so stub them out instead of mounting providers.
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: null }),
}));

/**
 * Minimal full prop bag for <GeneratorConfigDialogs />. Mirrors the
 * configState shape produced by useGeneratorExecution. This test exists to
 * guard the develop `077afbdf9` failure mode: the Supabase dialog rendering
 * with undefined handlers because application.tsx forgot to forward props.
 */
const baseProps = (overrides: Partial<React.ComponentProps<typeof GeneratorConfigDialogs>> = {}) => ({
  configDialog: 'none' as ConfigDialog,
  setConfigDialog: vi.fn(),
  isLocalEnvironment: false,
  djangoProjectName: '',
  djangoAppName: '',
  useDocker: false,
  sqlDialect: 'sqlite' as const,
  supabaseUserRoot: 'User',
  sqlAlchemyDbms: 'sqlite' as const,
  jsonSchemaMode: 'regular' as const,
  sourceLanguage: 'none',
  pendingAgentLanguage: 'none',
  selectedAgentLanguages: [],
  hasSavedAgentConfiguration: false,
  agentMode: 'original' as const,
  storedAgentConfigurations: [],
  storedAgentMappings: [],
  selectedStoredAgentConfigIds: [],
  agentVariantOptions: [],
  selectedAgentVariantId: '',
  agentGenerationMode: 'selected' as any,
  qiskitBackend: 'aer_simulator' as const,
  qiskitShots: 1024,
  onDjangoProjectNameChange: vi.fn(),
  onDjangoAppNameChange: vi.fn(),
  onUseDockerChange: vi.fn(),
  onSqlDialectChange: vi.fn(),
  onSupabaseUserRootChange: vi.fn(),
  onSqlAlchemyDbmsChange: vi.fn(),
  onJsonSchemaModeChange: vi.fn(),
  onSourceLanguageChange: vi.fn(),
  onPendingAgentLanguageChange: vi.fn(),
  onSelectedAgentLanguagesChange: vi.fn(),
  onQiskitBackendChange: vi.fn(),
  onQiskitShotsChange: vi.fn(),
  onAgentModeChange: vi.fn(),
  onStoredAgentConfigToggle: vi.fn(),
  onSelectedAgentVariantIdChange: vi.fn(),
  onAgentGenerationModeChange: vi.fn(),
  webAppChecklist: null,
  onDjangoGenerate: vi.fn(),
  onDjangoDeploy: vi.fn(),
  onSqlGenerate: vi.fn(),
  onSupabaseGenerate: vi.fn(),
  onSqlAlchemyGenerate: vi.fn(),
  onJsonSchemaGenerate: vi.fn(),
  onAgentGenerate: vi.fn(),
  onQiskitGenerate: vi.fn(),
  onWebAppGenerate: vi.fn(),
  ...overrides,
});

describe('GeneratorConfigDialogs — Supabase', () => {
  it('does not render the Supabase dialog when closed', () => {
    render(<GeneratorConfigDialogs {...baseProps()} />);
    expect(screen.queryByText('Supabase Configuration')).not.toBeInTheDocument();
  });

  it('renders title, helper text, and the user-root input prefilled from props', () => {
    render(<GeneratorConfigDialogs {...baseProps({ configDialog: 'supabase', supabaseUserRoot: 'Account' })} />);

    expect(screen.getByText('Supabase Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText('User-root class name')).toHaveValue('Account');
    // Helper text mentions both skip-auth semantics and the default.
    expect(screen.getByText(/Leave blank to skip auth integration/)).toBeInTheDocument();
  });

  it('typing in the input calls onSupabaseUserRootChange with the new value', () => {
    const onSupabaseUserRootChange = vi.fn();
    render(
      <GeneratorConfigDialogs
        {...baseProps({ configDialog: 'supabase', onSupabaseUserRootChange })}
      />,
    );

    fireEvent.change(screen.getByLabelText('User-root class name'), { target: { value: 'Member' } });
    expect(onSupabaseUserRootChange).toHaveBeenCalledWith('Member');
  });

  it('Generate triggers onSupabaseGenerate; Cancel closes the dialog', () => {
    const onSupabaseGenerate = vi.fn();
    const setConfigDialog = vi.fn();
    render(
      <GeneratorConfigDialogs
        {...baseProps({ configDialog: 'supabase', onSupabaseGenerate, setConfigDialog })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(onSupabaseGenerate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setConfigDialog).toHaveBeenCalledWith('none');
  });
});
