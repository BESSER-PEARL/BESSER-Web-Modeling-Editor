/**
 * BYOK (bring-your-own-key) modal for the Spec-Driven Agent.
 *
 * Opened for every `trigger_smart_generator` action (and from the assistant
 * settings). The user enters/confirms their provider + key + model + run
 * budget, then clicks the primary button to start the run directly — there
 * is no separate plan-review/approve step. The run's generate-vs-modify
 * decision is computed by the trigger hook (`useSmartGenTrigger`).
 *
 * The raw key never enters Redux — only `apiKeyInStore` (boolean).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import type { RootState } from '../../../app/store/store';
import type { BesserProject } from '../../../shared/types/project';
import {
  CUSTOM_MODEL_VALUE,
  MODEL_PRESETS,
} from '../../../shared/components/byok/LlmKeyDialog';
import {
  clearSessionKey,
  readSessionBudget,
  readSessionKey,
  writeFreeTierSelected,
  writeSessionBudget,
  writeSessionKey,
} from '../storage';
import {
  FALLBACK_SMART_GEN_CONFIG,
  getSmartGenConfig,
  type SmartGenConfig,
} from '../services/smartGenConfig';
import {
  approvePendingTrigger,
  clearPendingTrigger,
  closeByokDialog,
  setApiKeyPresent,
  setProvider,
} from '../state/smartGeneratorSlice';
import type { SmartGenProvider } from '../types';

export interface SmartGenByokDialogProps {
  /** Optional callback fired when the user saves a key. */
  onKeySaved?: () => void;
  /** Active project (accepted for API stability; not required by the dialog). */
  project?: BesserProject | null;
}

interface ProviderOption {
  value: SmartGenProvider;
  label: string;
  placeholder: string;
  hint: string;
  expectedPrefix: string;
}

const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    hint: 'Keys typically start with sk-ant-',
    expectedPrefix: 'sk-ant-',
  },
  {
    value: 'openai',
    label: 'OpenAI (GPT)',
    placeholder: 'sk-...',
    hint: 'Keys typically start with sk-',
    expectedPrefix: 'sk-',
  },
  {
    value: 'mistral',
    label: 'Mistral',
    placeholder: 'Your Mistral API key',
    // Mistral keys have no fixed public prefix, so we don't assert one.
    hint: 'Paste your Mistral API key (no fixed prefix)',
    expectedPrefix: '',
  },
] as const;

/** Default preset for a provider — used when no prior choice is stored. */
function _defaultModelForProvider(provider: SmartGenProvider): string {
  return MODEL_PRESETS[provider][0].value;
}

/** Placeholder shown in the Custom model ID input, per provider. */
const CUSTOM_MODEL_PLACEHOLDER: Partial<Record<SmartGenProvider, string>> = {
  anthropic: 'e.g. claude-opus-4-6',
  openai: 'e.g. o1-preview',
  mistral: 'e.g. mistral-medium-latest',
} as const;

/**
 * Given a provider and a stored/resolved model value, determine how the
 * UI should show it: either as one of the presets (dropdown value = that
 * preset's ``value``, custom input empty) or as a custom value
 * (dropdown value = CUSTOM_MODEL_VALUE, custom input = the actual string).
 */
function _classifyStoredModel(
  provider: SmartGenProvider,
  stored: string | undefined,
): { choice: string; custom: string } {
  if (!stored) {
    return { choice: _defaultModelForProvider(provider), custom: '' };
  }
  const matchesPreset = MODEL_PRESETS[provider].some(
    (p) => p.value !== CUSTOM_MODEL_VALUE && p.value === stored,
  );
  if (matchesPreset) {
    return { choice: stored, custom: '' };
  }
  return { choice: CUSTOM_MODEL_VALUE, custom: stored };
}

const PRIVACY_COPY =
  'Your key stays in this browser tab only and is sent directly to the ' +
  'BESSER backend for each run you start. It is never stored on our ' +
  'servers and it is cleared when you close the tab.';

/**
 * Infer the provider from the key prefix. Returns ``null`` when the
 * prefix is ambiguous or unrecognised (user must pick manually).
 *
 *   ``sk-ant-…``              → anthropic (Anthropic always uses this prefix)
 *   ``sk-proj-…``             → openai    (OpenAI project-scoped keys)
 *   ``sk-`` (but not sk-ant-) → openai    (legacy OpenAI user keys)
 */
function _inferProviderFromKey(trimmedKey: string): SmartGenProvider | null {
  if (!trimmedKey) return null;
  if (trimmedKey.startsWith('sk-ant-')) return 'anthropic';
  if (trimmedKey.startsWith('sk-')) return 'openai';
  return null;
}

function _providerLabel(provider: SmartGenProvider | null): string {
  const found = PROVIDER_OPTIONS.find((p) => p.value === provider);
  return found ? found.label : 'the other provider';
}

/** Render a number for an `<input type="number">` without float noise. */
function _formatBudgetNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Clamp `value` into `[min, max]`; fall back to `fallback` when unusable. */
function _clampBudget(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  const v = Number.isFinite(value) && value > 0 ? value : fallback;
  return Math.min(Math.max(v, min), max);
}

export const SmartGenByokDialog: React.FC<SmartGenByokDialogProps> = ({
  onKeySaved,
}) => {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s: RootState) => s.smartGenerator.byokDialogOpen);
  const storedProvider = useAppSelector((s: RootState) => s.smartGenerator.provider);
  const pendingTrigger = useAppSelector((s: RootState) => s.smartGenerator.pendingTrigger);
  // Reactive — driven by Redux, not by a one-shot `hasSessionKey()` call
  // evaluated at render time. When `handleClear` dispatches
  // `setApiKeyPresent(false)`, this re-renders correctly.
  const apiKeyPresent = useAppSelector((s: RootState) => s.smartGenerator.apiKeyInStore);

  const [provider, setLocalProvider] = useState<SmartGenProvider>(
    storedProvider ?? pendingTrigger?.provider ?? 'anthropic',
  );
  const [apiKey, setApiKey] = useState<string>('');
  const [storedSessionKey, setStoredSessionKey] = useState<ReturnType<typeof readSessionKey>>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set to ``true`` whenever the user has manually picked a provider —
  // after that, we stop auto-detecting from the key prefix because we
  // respect the explicit choice.
  const [providerLockedByUser, setProviderLockedByUser] = useState<boolean>(false);

  // Model selector state. ``modelChoice`` is the dropdown value (either
  // a preset model ID or ``CUSTOM_MODEL_VALUE``). ``customModel`` is the
  // free-text input that shows up when Custom is picked.
  const [modelChoice, setModelChoice] = useState<string>(() => _defaultModelForProvider(
    storedProvider ?? pendingTrigger?.provider ?? 'anthropic',
  ));
  const [customModel, setCustomModel] = useState<string>('');

  // Backend run-budget configuration (caps + defaults). Fetched once per
  // page load (module-level cache in smartGenConfig); the fallback keeps
  // the inputs usable while the request is in flight or failing.
  const [config, setConfig] = useState<SmartGenConfig>(FALLBACK_SMART_GEN_CONFIG);
  // Budget inputs as raw strings (so the user can clear/retype freely);
  // parsed + clamped on save. Runtime is edited in MINUTES, stored in seconds.
  const [maxCostInput, setMaxCostInput] = useState<string>('');
  const [maxRuntimeMinInput, setMaxRuntimeMinInput] = useState<string>('');
  const [showBudgetLimits, setShowBudgetLimits] = useState<boolean>(false);

  // True only while we're intentionally closing the dialog to START a run.
  // Closing the dialog fires the Radix `onOpenChange(false)` → `handleCancel`,
  // which would otherwise clear the just-approved pending trigger (and, for the
  // keyless free path, emit the "no API key" message) before the trigger hook's
  // resume effect can consume it. This flag makes handleCancel stand down.
  const startingRunRef = useRef(false);

  useEffect(() => {
    if (open) {
      startingRunRef.current = false;
      setApiKey('');
      setSaveError(null);
      setProviderLockedByUser(false);
      const storedKey = readSessionKey();
      setStoredSessionKey(storedKey);
      const nextProvider =
        storedKey?.provider ?? storedProvider ?? pendingTrigger?.provider ?? 'anthropic';
      setLocalProvider(nextProvider);
      // Re-hydrate the model fields from sessionStorage if a prior run
      // persisted one, else fall back to the provider default.
      const classified = _classifyStoredModel(
        nextProvider,
        storedKey?.llmModel,
      );
      setModelChoice(classified.choice);
      setCustomModel(classified.custom);
    }
  }, [open, storedProvider, pendingTrigger]);

  // Prefill the budget inputs whenever the dialog opens: previously saved
  // values win, otherwise the backend's defaults from /smart-gen/config.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getSmartGenConfig().then((cfg) => {
      if (cancelled) return;
      setConfig(cfg);
      const saved = readSessionBudget();
      const costUsd = saved?.maxCostUsd ?? cfg.caps.default_max_cost_usd;
      const runtimeSeconds =
        saved?.maxRuntimeSeconds ?? cfg.caps.default_max_runtime_seconds;
      setMaxCostInput(_formatBudgetNumber(costUsd));
      setMaxRuntimeMinInput(_formatBudgetNumber(runtimeSeconds / 60));
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // When the provider changes (either by auto-detect or manual pick),
  // reset the model choice to that provider's default. This prevents a
  // stale selection like "claude-opus-4-6" from leaking into an OpenAI
  // run — which would trigger the model_not_found 404 we saw earlier.
  useEffect(() => {
    // Only reset if the current modelChoice doesn't belong to this
    // provider's preset list. Otherwise leave the user's choice alone.
    const presetValues = new Set(MODEL_PRESETS[provider].map((p) => p.value));
    if (modelChoice !== CUSTOM_MODEL_VALUE && !presetValues.has(modelChoice)) {
      setModelChoice(_defaultModelForProvider(provider));
      setCustomModel('');
    }
  }, [provider, modelChoice]);

  const freeAvailable = config.free_tier.available;
  const isFreeProvider = provider === 'free';

  const trimmedKey = apiKey.trim();
  const storedKeyUsable =
    storedSessionKey !== null && storedSessionKey.provider === provider;
  // The free tier needs no key, so it's always runnable when selected.
  const canUseKey = isFreeProvider || trimmedKey.length > 0 || storedKeyUsable;

  // Provider dropdown: the keyless Free tier first (when the server offers it),
  // then the BYOK providers. pia/local are not offered in this dialog.
  // In SETTINGS mode (no pending trigger — reached from the free-run note's
  // "use your own API key" link) the free tier is hidden: the user opened the
  // dialog specifically to store a paid key, and "Save" on a keyless provider
  // is a dead-end (it demands a key).
  const providerOptions = useMemo<readonly ProviderOption[]>(() => {
    if (!freeAvailable || !pendingTrigger) return PROVIDER_OPTIONS;
    const freeOption: ProviderOption = {
      value: 'free',
      label: `Free — ${config.free_tier.model ?? 'qwen3-coder'} (no key)`,
      placeholder: '',
      hint: 'No API key needed. Runs on a hosted open-weight model; quality is lower than the paid providers.',
      expectedPrefix: '',
    };
    return [freeOption, ...PROVIDER_OPTIONS];
  }, [freeAvailable, config.free_tier.model, pendingTrigger]);

  const selectedProvider = useMemo(
    () => providerOptions.find((p) => p.value === provider) ?? providerOptions[0],
    [provider, providerOptions],
  );

  // If a stale 'free' provider survives on a deploy that doesn't offer it —
  // or in settings mode, where 'free' isn't an option — fall back to a real
  // provider so the dialog can't get stuck in free mode with no key field.
  useEffect(() => {
    if (provider === 'free' && (!freeAvailable || !pendingTrigger)) {
      setLocalProvider('anthropic');
    }
  }, [provider, freeAvailable, pendingTrigger]);

  // Live (purely informational) format hint — shown as the user types,
  // never blocks the save.
  const formatLooksWrong =
    trimmedKey.length > 0 && !trimmedKey.startsWith(selectedProvider.expectedPrefix);

  // Auto-detected provider from the key prefix. Drives auto-switching
  // of the provider dropdown and the strong "this key belongs to the
  // OTHER provider" warning.
  const inferredProvider = _inferProviderFromKey(trimmedKey);
  const providerMismatch =
    inferredProvider !== null && inferredProvider !== provider;

  // Auto-switch the provider dropdown when the user pastes a key whose
  // prefix unambiguously identifies the provider — but only if the
  // user hasn't explicitly overridden the choice.
  useEffect(() => {
    if (providerLockedByUser) return;
    if (inferredProvider === null) return;
    if (inferredProvider === provider) return;
    setLocalProvider(inferredProvider);
  }, [inferredProvider, provider, providerLockedByUser]);

  const handleProviderChange = (next: SmartGenProvider) => {
    setLocalProvider(next);
    // The user explicitly picked a provider — don't second-guess them.
    setProviderLockedByUser(true);
  };

  /**
   * Resolve the effective model string to persist. Returns empty string
   * when the user selected the provider default and didn't override via
   * Custom — in that case we don't write the key at all and the backend
   * falls back to its own default.
   */
  const resolveEffectiveModel = (): string => {
    if (modelChoice === CUSTOM_MODEL_VALUE) {
      return customModel.trim();
    }
    return modelChoice;
  };

  // Model-format sanity check mirrors the backend's
  // ``_LLM_MODEL_NAME_RE`` — lets the user see the problem live.
  const effectiveModel = resolveEffectiveModel();
  const modelFormatInvalid =
    modelChoice === CUSTOM_MODEL_VALUE &&
    effectiveModel.length > 0 &&
    !/^[A-Za-z0-9_.\-/]+$/.test(effectiveModel);
  const modelMissing =
    modelChoice === CUSTOM_MODEL_VALUE && effectiveModel.length === 0;

  const persistSettings = (): boolean => {
    const effectiveApiKey = trimmedKey || (storedKeyUsable ? storedSessionKey.apiKey : '');
    if (!effectiveApiKey) {
      setSaveError('Paste an API key for the selected provider before running.');
      return false;
    }
    // Hard guard: if the key prefix unambiguously identifies a
    // provider that differs from the selected one, refuse to save.
    if (providerMismatch) {
      setSaveError(
        `This key looks like ${_providerLabel(inferredProvider)} but the ` +
          `Provider is set to ${selectedProvider.label}. Change one so ` +
          `they match, or paste a different key.`,
      );
      return false;
    }
    if (modelMissing) {
      setSaveError('Custom model ID is empty — pick a preset or type a model name.');
      return false;
    }
    if (modelFormatInvalid) {
      setSaveError(
        'Model ID may only contain letters, digits, dashes, dots, underscores, or slashes.',
      );
      return false;
    }
    const saved = writeSessionKey(provider, effectiveApiKey, effectiveModel);
    if (!saved) {
      setSaveError(
        'Could not store the key in this browser tab (sessionStorage is unavailable). ' +
          'Try enabling site storage or use a different browser.',
      );
      return false;
    }
    // Persist the run budget alongside the key. Clamped to the backend's
    // hard caps — the server enforces them anyway, but clamping here
    // means the user never sees a request silently downgraded.
    const caps = config.caps;
    const clampedCostUsd = _clampBudget(
      Number.parseFloat(maxCostInput),
      0.01,
      caps.max_cost_usd_hard_cap,
      caps.default_max_cost_usd,
    );
    const clampedRuntimeSeconds = Math.round(
      _clampBudget(
        Number.parseFloat(maxRuntimeMinInput) * 60,
        30,
        caps.max_runtime_seconds_hard_cap,
        caps.default_max_runtime_seconds,
      ),
    );
    writeSessionBudget({
      maxCostUsd: clampedCostUsd,
      maxRuntimeSeconds: clampedRuntimeSeconds,
    });
    setSaveError(null);
    // Saving a BYOK key opts OUT of the free tier — the two are mutually
    // exclusive so a stale free flag can't override the key the user just set.
    writeFreeTierSelected(false);
    dispatch(setProvider(provider));
    dispatch(setApiKeyPresent(true));
    setStoredSessionKey({
      provider,
      apiKey: effectiveApiKey,
      llmModel: effectiveModel || undefined,
    });
    onKeySaved?.();
    return true;
  };

  const handleSave = () => {
    if (!persistSettings()) return;
    dispatch(closeByokDialog());
  };

  // Save the key/budget and start the run directly. The trigger hook
  // computes the generate-vs-modify decision from the project's last run;
  // there is no separate plan-review step.
  const handleSaveAndRun = () => {
    if (!pendingTrigger) return;
    // Free provider: no key to persist — go straight to the keyless run path.
    if (provider === 'free') {
      handleRunFree();
      return;
    }
    if (!persistSettings()) return;
    startingRunRef.current = true;
    dispatch(approvePendingTrigger({ ...pendingTrigger, planApproved: true }));
  };

  // Start the run on the keyless free tier — no API key, no budget entry
  // needed. Sets the dedicated free flag (kept OUT of the shared LLM key so
  // it can't disturb the assistant) and hands off to the trigger hook, which
  // sends provider='free' with no api_key; the server injects the endpoint.
  const handleRunFree = () => {
    if (!pendingTrigger) return;
    writeFreeTierSelected(true);
    setSaveError(null);
    dispatch(setProvider('free'));
    startingRunRef.current = true;
    dispatch(approvePendingTrigger({ ...pendingTrigger, planApproved: true }));
  };

  const handleClear = () => {
    clearSessionKey();
    dispatch(setApiKeyPresent(false));
    setStoredSessionKey(null);
    setApiKey('');
    setSaveError(null);
  };

  const handleCancel = () => {
    // Closing the dialog to START a run (Save & run / Use the free model) also
    // fires this via onOpenChange — that's not a cancel. Stand down so the
    // approved pending trigger survives for the trigger hook to consume.
    if (startingRunRef.current) {
      startingRunRef.current = false;
      return;
    }
    // If the user dismisses the key box (clicks outside / Cancel / Esc) while
    // a smart-gen run was pending AND no key is stored, the run cannot start —
    // tell them why in the chat instead of leaving them with silent nothing.
    if (pendingTrigger && !apiKeyPresent) {
      window.dispatchEvent(new CustomEvent('wme:smartgen-key-cancelled'));
    }
    // Cancelling the dialog drops any pending trigger so the user's
    // original request doesn't silently resume later when they reopen
    // the dialog for a different purpose.
    dispatch(clearPendingTrigger());
    dispatch(closeByokDialog());
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleCancel(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {pendingTrigger ? 'Spec-Driven Agent — Run' : 'Spec-Driven Agent — Settings'}
          </DialogTitle>
          <DialogDescription>
            {pendingTrigger
              ? 'Confirm your provider, key, and budget, then start the run. '
              : 'Configure the provider, model, and guardrails used by your runs. '}
            <strong>{PRIVACY_COPY}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Keyless free tier — top of the dialog so it's the first thing
              seen. Hidden once the user has already picked Free below. */}
          {pendingTrigger && freeAvailable && !isFreeProvider && (
            <div className="rounded-md border border-brand/40 bg-brand/5 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    No API key? Generate for free
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Runs on the hosted {config.free_tier.model ?? 'open-weight'}{' '}
                    model — no key needed. Quality is lower than the paid
                    providers below.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleRunFree}
                  className="shrink-0 whitespace-nowrap gap-2 bg-brand text-brand-foreground hover:bg-brand-dark"
                >
                  Use the free model
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-3.5 text-brand" /> Provider and guardrails
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smart-gen-provider">Provider</Label>
            <select
              id="smart-gen-provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as SmartGenProvider)}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {providerOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {isFreeProvider ? (
              <p className="text-xs text-muted-foreground">
                No API key needed — runs on the hosted{' '}
                {config.free_tier.model ?? 'open-weight'} model. Quality is
                lower than the paid providers.
              </p>
            ) : (
              inferredProvider !== null && !providerLockedByUser && inferredProvider === provider && trimmedKey.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Provider auto-selected from the key prefix.
                </p>
              )
            )}
          </div>

          {!isFreeProvider && (
          <div className="space-y-1.5">
            <Label htmlFor="smart-gen-api-key">API Key</Label>
            <Input
              id="smart-gen-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setSaveError(null);
              }}
              placeholder={selectedProvider.placeholder}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">{selectedProvider.hint}</p>
            {storedKeyUsable && !trimmedKey && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Your stored {selectedProvider.label} key will be used. Paste a new key only to replace it.
              </p>
            )}
            {storedSessionKey && !storedKeyUsable && !trimmedKey && (
              <p className="text-xs font-medium text-amber-600">
                Paste a new key to switch from {storedSessionKey.provider} to {provider}.
              </p>
            )}
            {providerMismatch && (
              <p className="text-xs font-medium text-destructive">
                This key looks like a {_providerLabel(inferredProvider)} key,
                but Provider is set to {selectedProvider.label}. Change one
                so they match — otherwise the API will reject the key and
                your run will silently fall back to a generic deterministic
                template instead of the stack you asked for.
              </p>
            )}
            {!providerMismatch && formatLooksWrong && (
              <p className="text-xs text-amber-600">
                That doesn&rsquo;t look like a {selectedProvider.label} key,
                but the prefix is unusual enough that we can&rsquo;t tell
                for sure. Save will still proceed.
              </p>
            )}
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          </div>
          )}

          {!isFreeProvider && (
          <div className="space-y-1.5">
            <Label htmlFor="smart-gen-model">Model</Label>
            <select
              id="smart-gen-model"
              value={modelChoice}
              onChange={(e) => {
                const next = e.target.value;
                setModelChoice(next);
                if (next !== CUSTOM_MODEL_VALUE) {
                  // Switching away from Custom clears any leftover text.
                  setCustomModel('');
                }
                setSaveError(null);
              }}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {MODEL_PRESETS[provider].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {modelChoice === CUSTOM_MODEL_VALUE && (
              <Input
                id="smart-gen-model-custom"
                type="text"
                aria-label="Custom model ID"
                value={customModel}
                onChange={(e) => {
                  setCustomModel(e.target.value);
                  setSaveError(null);
                }}
                placeholder={CUSTOM_MODEL_PLACEHOLDER[provider]}
                autoComplete="off"
                spellCheck={false}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Defaults to a balanced model for your provider. Pick a stronger
              model (Opus / o1) for complex code generation, or Custom for any
              model ID your account has access to.
            </p>
          </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowBudgetLimits((v) => !v)}
              aria-expanded={showBudgetLimits}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  showBudgetLimits ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
              Cost and runtime limits
            </button>
            {showBudgetLimits && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="smart-gen-max-cost">Max cost (USD)</Label>
                    <Input
                      id="smart-gen-max-cost"
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step={0.1}
                      max={config.caps.max_cost_usd_hard_cap}
                      value={maxCostInput}
                      onChange={(e) => {
                        setMaxCostInput(e.target.value);
                        setSaveError(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smart-gen-max-runtime">Max runtime (min)</Label>
                    <Input
                      id="smart-gen-max-runtime"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      max={Math.ceil(config.caps.max_runtime_seconds_hard_cap / 60)}
                      value={maxRuntimeMinInput}
                      onChange={(e) => {
                        setMaxRuntimeMinInput(e.target.value);
                        setSaveError(null);
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The run stops automatically when either budget is reached
                  (server caps: ${_formatBudgetNumber(config.caps.max_cost_usd_hard_cap)} /{' '}
                  {_formatBudgetNumber(config.caps.max_runtime_seconds_hard_cap / 60)} min).
                </p>
              </div>
            )}
          </div>

          {(apiKeyPresent || storedSessionKey) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear stored key
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {pendingTrigger ? (
            <Button
              onClick={handleSaveAndRun}
              disabled={!canUseKey}
              className="gap-2 bg-brand text-brand-foreground hover:bg-brand-dark"
            >
              <ShieldCheck className="size-4" />{' '}
              {isFreeProvider ? 'Run for free' : 'Save & run'}
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!canUseKey}
              className="bg-brand text-brand-foreground hover:bg-brand-dark"
            >
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
