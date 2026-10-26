import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../../shared/i18n';
import { GeneratorConfigDialogs } from '../GeneratorConfigDialogs';
import { DEFAULT_FORECASTER_CONFIG } from '../../hooks/useGenerateCode';

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
  'onWebAppGenerate', 'onForecasterConfigChange', 'onForecasterGenerate',
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
    forecasterConfig: { ...DEFAULT_FORECASTER_CONFIG },
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

describe('GeneratorConfigDialogs — Forecaster', () => {
  const field = (key: string) => screen.getByLabelText(new RegExp(`^${i18n.t(`generation.forecaster.${key}`)}`));

  it('opens pre-filled with the defaults and generates on submit', () => {
    const handlers = renderDialogs({ configDialog: 'forecaster' });
    expect(screen.getByRole('dialog')).toHaveTextContent(i18n.t('generation.forecaster.title'));
    expect(field('window')).toHaveValue(24);
    expect(field('horizon')).toHaveValue(12);
    expect(field('season')).toHaveValue(12);
    expect(screen.getByRole('combobox', { name: new RegExp(`^${i18n.t('generation.forecaster.difference')}`) }))
      .toHaveTextContent(i18n.t('generation.forecaster.differenceSeasonal'));
    expect(screen.getByRole('checkbox', { name: i18n.t('generation.forecaster.log') })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: i18n.t('generation.forecaster.channelLast') })).not.toBeChecked();
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(handlers.onForecasterGenerate).toHaveBeenCalledTimes(1);
  });

  it('sends each change as a partial update', () => {
    const handlers = renderDialogs({ configDialog: 'forecaster' });
    fireEvent.change(field('window'), { target: { value: '36' } });
    expect(handlers.onForecasterConfigChange).toHaveBeenCalledWith({ window: 36 });
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('generation.forecaster.calendar') }));
    expect(handlers.onForecasterConfigChange).toHaveBeenCalledWith({ calendar: false });
  });

  it('does not generate while a setting is out of range', () => {
    const handlers = renderDialogs({ configDialog: 'forecaster', forecasterConfig: { ...DEFAULT_FORECASTER_CONFIG, window: 0 } });
    expect(screen.getByRole('button', { name: i18n.t('generation.generate') })).toBeDisabled();
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(handlers.onForecasterGenerate).not.toHaveBeenCalled();
  });

  it('accepts the large values the backend accepts', () => {
    renderDialogs({ configDialog: 'forecaster', forecasterConfig: { ...DEFAULT_FORECASTER_CONFIG, window: 5000, season: 52 } });
    expect(screen.getByRole('button', { name: i18n.t('generation.generate') })).toBeEnabled();
  });

  it('clears the shown errors on Cancel', () => {
    const handlers = renderDialogs({ configDialog: 'forecaster', forecasterConfig: { ...DEFAULT_FORECASTER_CONFIG, window: 0 } });
    fireEvent.blur(field('window'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(handlers.setConfigDialog).toHaveBeenCalledWith('none');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
