/**
 * BYOK (bring-your-own-key) modal for the Smart Generator.
 *
 * Opened by `useSmartGenTrigger` when a `trigger_smart_generator` action
 * arrives from the modeling agent and sessionStorage does not contain a
 * BYOK key. On save, writes the key to sessionStorage and flips
 * `apiKeyInStore` in Redux; the trigger hook's resume-effect then starts
 * the run automatically.
 *
 * The raw key never enters Redux — only `apiKeyInStore` (boolean).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { clearSessionKey, readSessionKey, writeSessionKey } from '../storage';
import {
  clearPendingTrigger,
  closeByokDialog,
  setApiKeyPresent,
  setProvider,
} from '../state/smartGeneratorSlice';
import type { SmartGenProvider } from '../types';

export interface SmartGenByokDialogProps {
  /** Optional callback fired when the user saves a key. */
  onKeySaved?: () => void;
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
] as const;

interface ModelPreset {
  value: string;
  label: string;
}

/**
 * Curated list of preset models per provider. The first entry is the
 * default shown when the provider is picked for the first time.
 *
 * ``CUSTOM_MODEL_VALUE`` is a sentinel — selecting it reveals a free-text
 * input so users can type any model ID the backend accepts (the server
 * validates the format against ``^[A-Za-z0-9_.\-/]+$``).
 */
const CUSTOM_MODEL_VALUE = '__custom__';

const MODEL_PRESETS: Record<SmartGenProvider, readonly ModelPreset[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced (default)' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 — most capable' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
  openai: [
    { value: 'gpt-5.4', label: 'GPT-5.4 — flagship, strongest for code' },
    { value: 'gpt-5', label: 'GPT-5 — prior flagship' },
    { value: 'o1', label: 'o1 — reasoning, deep chains-of-thought (Tier 5+)' },
    { value: 'o1-mini', label: 'o1-mini — cheaper reasoning' },
    { value: 'gpt-4o', label: 'GPT-4o — balanced (default)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
} as const;

/** Default preset for a provider — used when no prior choice is stored. */
function _defaultModelForProvider(provider: SmartGenProvider): string {
  return MODEL_PRESETS[provider][0].value;
}

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
  'BESSER backend with this single request. It is never stored on our ' +
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

export const SmartGenByokDialog: React.FC<SmartGenByokDialogProps> = ({ onKeySaved }) => {
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

  useEffect(() => {
    if (open) {
      setApiKey('');
      setSaveError(null);
      setProviderLockedByUser(false);
      const nextProvider = storedProvider ?? pendingTrigger?.provider ?? 'anthropic';
      setLocalProvider(nextProvider);
      // Re-hydrate the model fields from sessionStorage if a prior run
      // persisted one, else fall back to the provider default.
      const storedKey = readSessionKey();
      const classified = _classifyStoredModel(
        nextProvider,
        storedKey?.llmModel,
      );
      setModelChoice(classified.choice);
      setCustomModel(classified.custom);
    }
  }, [open, storedProvider, pendingTrigger]);

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

  const trimmedKey = apiKey.trim();
  const canSave = trimmedKey.length > 0;

  const selectedProvider = useMemo(
    () => PROVIDER_OPTIONS.find((p) => p.value === provider) ?? PROVIDER_OPTIONS[0],
    [provider],
  );

  // Live (purely informational) format hint — shown as the user types,
  // never blocks the save. This replaces the earlier broken
  // "set warning then save anyway" logic.
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
  // user hasn't explicitly overridden the choice. Without this, a user
  // who pastes an OpenAI key while the dropdown defaults to Anthropic
  // ends up with a mismatched provider/key pair, the Anthropic API
  // returns 401, the orchestrator falls through to the Phase 1
  // deterministic generator output with no LLM customisation, and the
  // user downloads generic FastAPI code instead of the stack they asked
  // for — with no clear error anywhere.
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
    // Storing the default preset's value is fine — it's explicit and
    // makes the user's intent durable across sessions.
    return modelChoice;
  };

  // Model-format sanity check mirrors the backend's
  // ``_LLM_MODEL_NAME_RE`` — lets the user see the problem live,
  // before they click Save.
  const effectiveModel = resolveEffectiveModel();
  const modelFormatInvalid =
    modelChoice === CUSTOM_MODEL_VALUE &&
    effectiveModel.length > 0 &&
    !/^[A-Za-z0-9_.\-/]+$/.test(effectiveModel);
  const modelMissing =
    modelChoice === CUSTOM_MODEL_VALUE && effectiveModel.length === 0;

  const handleSave = () => {
    if (!canSave) return;
    // Hard guard: if the key prefix unambiguously identifies a
    // provider that differs from the selected one, refuse to save
    // until the user either fixes the dropdown or fixes the key.
    // This prevents the silent-partial-success trap where an
    // OpenAI key ends up hitting the Anthropic API, gets 401s, and
    // the user sees a FastAPI ZIP instead of the stack they asked
    // for.
    if (providerMismatch) {
      setSaveError(
        `This key looks like ${_providerLabel(inferredProvider)} but the ` +
          `Provider is set to ${selectedProvider.label}. Change one so ` +
          `they match, or paste a different key.`,
      );
      return;
    }
    if (modelMissing) {
      setSaveError('Custom model ID is empty — pick a preset or type a model name.');
      return;
    }
    if (modelFormatInvalid) {
      setSaveError(
        'Model ID may only contain letters, digits, dashes, dots, underscores, or slashes.',
      );
      return;
    }
    const saved = writeSessionKey(provider, trimmedKey, effectiveModel);
    if (!saved) {
      setSaveError(
        'Could not store the key in this browser tab (sessionStorage is unavailable). ' +
          'Try enabling site storage or use a different browser.',
      );
      return;
    }
    setSaveError(null);
    dispatch(setProvider(provider));
    dispatch(setApiKeyPresent(true));
    dispatch(closeByokDialog());
    onKeySaved?.();
  };

  const handleClear = () => {
    clearSessionKey();
    dispatch(setApiKeyPresent(false));
    setApiKey('');
    setSaveError(null);
  };

  const handleCancel = () => {
    // Cancelling the dialog drops any pending trigger so the user's
    // original request doesn't silently resume later when they reopen
    // the dialog for a different purpose.
    dispatch(clearPendingTrigger());
    dispatch(closeByokDialog());
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Smart Generator — API Key</DialogTitle>
          <DialogDescription>
            The Smart Generator runs an LLM on your behalf to build a
            customised codebase from your model. Paste your own Anthropic
            or OpenAI key to start. <strong>{PRIVACY_COPY}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="smart-gen-provider">Provider</Label>
            <select
              id="smart-gen-provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as SmartGenProvider)}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {inferredProvider !== null && !providerLockedByUser && inferredProvider === provider && trimmedKey.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Provider auto-selected from the key prefix.
              </p>
            )}
          </div>

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
                value={customModel}
                onChange={(e) => {
                  setCustomModel(e.target.value);
                  setSaveError(null);
                }}
                placeholder={provider === 'anthropic' ? 'e.g. claude-opus-4-6' : 'e.g. o1-preview'}
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

          {apiKeyPresent && (
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
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-brand text-brand-foreground hover:bg-brand-dark"
          >
            Save & Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
