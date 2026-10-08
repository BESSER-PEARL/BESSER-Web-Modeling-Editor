import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../../shared/i18n';
import { GeneratorConfigDialogs } from '../GeneratorConfigDialogs';

vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: null }) }));

afterEach(cleanup);

const handlerNames = [
  'setConfigDialog', 'onDjangoProjectNameChange', 'onDjangoAppNameChange', 'onUseDockerChange',
  'onSpringProjectNameChange', 'onSpringAppNameChange', 'onSpringPackageNameChange', 'onSpringBootVersionChange',
  'onSpringJavaVersionChange', 'onSqlDialectChange', 'onSupabaseUserRootChange', 'onSqlAlchemyDbmsChange',
  'onJsonSchemaModeChange', 'onSourceLanguageChange', 'onPendingAgentLanguageChange', 'onSelectedAgentLanguagesChange',
  'onQiskitBackendChange', 'onQiskitShotsChange', 'onAgentModeChange', 'onStoredAgentConfigToggle',
  'onSelectedAgentVariantIdChange', 'onAgentGenerationModeChange', 'onWebAppVersionModeChange',
  'onWebAppSelectedProfileIdChange', 'onDjangoGenerate', 'onDjangoDeploy', 'onSpringGenerate', 'onSqlGenerate',
  'onSupabaseGenerate', 'onSqlAlchemyGenerate', 'onJsonSchemaGenerate', 'onAgentGenerate', 'onQiskitGenerate',
  'onWebAppGenerate',
] as const;

const renderDialogs = (overrides: Record<string, unknown> = {}) => {
  const handlers = Object.fromEntries(handlerNames.map((name) => [name, vi.fn()]));
  const props = {
    ...handlers,
    configDialog: 'django',
    isLocalEnvironment: true,
    djangoProjectName: 'my_project',
    djangoAppName: 'my_app',
    useDocker: false,
    springProjectName: 'p', springAppName: 'App', springPackageName: 'com.example',
    springBootVersion: '3.4.5', springJavaVersion: '21',
    sqlDialect: 'sqlite', supabaseUserRoot: 'User', sqlAlchemyDbms: 'sqlite', jsonSchemaMode: 'regular',
    sourceLanguage: 'none', pendingAgentLanguage: 'none', selectedAgentLanguages: [],
    hasSavedAgentConfiguration: true, agentMode: 'original', storedAgentConfigurations: [], storedAgentMappings: [],
    selectedStoredAgentConfigIds: [], agentVariantOptions: [], selectedAgentVariantId: '', agentGenerationMode: 'none',
    qiskitBackend: 'aer_simulator', qiskitShots: 1024,
    webAppChecklist: null, webAppVersionMode: 'base', webAppSelectedProfileId: '',
    ...overrides,
  };
  render(
    <MemoryRouter>
      <GeneratorConfigDialogs {...(props as any)} />
    </MemoryRouter>,
  );
  return handlers as Record<(typeof handlerNames)[number], ReturnType<typeof vi.fn>>;
};

describe('GeneratorConfigDialogs — Django', () => {
  it('orders the footer Cancel, Deploy, Generate with Generate as the submit button', () => {
    renderDialogs();
    const dialog = screen.getByRole('dialog');
    const footerButtons = within(dialog)
      .getAllByRole('button')
      .filter((b) => [i18n.t('common.cancel'), i18n.t('generation.deploy'), i18n.t('generation.generate')].includes(b.textContent ?? ''));
    expect(footerButtons.map((b) => b.textContent)).toEqual([
      i18n.t('common.cancel'),
      i18n.t('generation.deploy'),
      i18n.t('generation.generate'),
    ]);
    expect(footerButtons[2]).toHaveAttribute('type', 'submit');
    expect(footerButtons[1]).toHaveAttribute('type', 'button');
  });

  it('submits on Enter in a field, and does not deploy', () => {
    const handlers = renderDialogs();
    fireEvent.submit(screen.getByLabelText(new RegExp(i18n.t('generation.django.projectName'))).closest('form')!);
    expect(handlers.onDjangoGenerate).toHaveBeenCalledTimes(1);
    expect(handlers.onDjangoDeploy).not.toHaveBeenCalled();
  });

  it('does not submit while the names are invalid', () => {
    const handlers = renderDialogs({ djangoAppName: 'my_project' });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(handlers.onDjangoGenerate).not.toHaveBeenCalled();
  });

  it('uses a real labelled checkbox for Docker', () => {
    const handlers = renderDialogs();
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('generation.django.includeDocker') }));
    expect(handlers.onUseDockerChange).toHaveBeenCalledWith(true);
  });
});
