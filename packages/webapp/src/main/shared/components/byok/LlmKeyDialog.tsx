/**
 * LlmKeyDialog — the ONE shared bring-your-own-key (BYOK) dialog for the app.
 *
 * Reachable from every surface that needs the user's LLM key (the assistant
 * popup, the assistant drawer, and the Settings page), all backed by a single
 * unified sessionStorage key (`shared/services/llmKeyStorage`). Enter the key
 * once → it powers BOTH the modeling assistant AND the Spec-Driven generator.
 *
 * Presentational + storage only: on save it writes the unified key, optionally
 * arms a live agent socket (via the minimal `client` prop), and calls
 * `onSaved` so each caller can run its own follow-up (e.g. flip a Redux
 * "key present" flag). The raw key NEVER enters Redux and is NEVER logged.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
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
import {
  clearLlmKey,
  readLlmKey,
  writeLlmKey,
  type LlmProvider,
} from '../../services/llmKeyStorage';

/** Minimal shape of an agent client we can arm — avoids importing a feature. */
export interface LlmKeyArmableClient {
  setUserApiKey: (key: { apiKey: string; provider?: string; model?: string }) => void;
}

export interface LlmKeySavedDetail {
  provider: LlmProvider;
  apiKey: string;
  /** Effective model override, or empty string for "use backend default". */
  model: string;
}

export interface LlmKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional live agent client — armed immediately on save when provided. */
  client?: LlmKeyArmableClient;
  /** Fired after a successful save (write + optional arm). */
  onSaved?: (detail: LlmKeySavedDetail) => void;
  /** Fired after the key is removed. */
  onRemoved?: () => void;
  title?: string;
  description?: React.ReactNode;
  /** Label for the primary button. Defaults to "Save". */
  saveLabel?: string;
}

interface ProviderOption {
  value: LlmProvider;
  label: string;
  placeholder: string;
  hint: string;
  expectedPrefix: string;
}

export const PROVIDER_OPTIONS: readonly ProviderOption[] = [
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
    hint: 'Paste your Mistral API key (no fixed prefix)',
    expectedPrefix: '',
  },
] as const;

interface ModelPreset {
  value: string;
  label: string;
}

export const CUSTOM_MODEL_VALUE = '__custom__';

export const MODEL_PRESETS: Record<LlmProvider, readonly ModelPreset[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced (default)' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 — most capable' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
  openai: [
    { value: 'gpt-5.5', label: 'GPT-5.5 — flagship, strongest for code' },
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-4o', label: 'GPT-4o — balanced (default)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large — most capable (default)' },
    { value: 'mistral-small-latest', label: 'Mistral Small — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
} as const;

function _defaultModelForProvider(provider: LlmProvider): string {
  return MODEL_PRESETS[provider][0].value;
}

const CUSTOM_MODEL_PLACEHOLDER: Record<LlmProvider, string> = {
  anthropic: 'e.g. claude-opus-4-6',
  openai: 'e.g. gpt-4.1',
  mistral: 'e.g. mistral-medium-latest',
} as const;

function _classifyStoredModel(
  provider: LlmProvider,
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

const DEFAULT_PRIVACY_COPY =
  'Your key stays in this browser tab only and is used to power your modeling ' +
  'assistant and the Spec-Driven generator with your own model. It is never ' +
  'stored on our servers and it is cleared when you close the tab.';

/** Infer the provider from the key prefix; null when ambiguous. */
function _inferProviderFromKey(trimmedKey: string): LlmProvider | null {
  if (!trimmedKey) return null;
  if (trimmedKey.startsWith('sk-ant-')) return 'anthropic';
  if (trimmedKey.startsWith('sk-')) return 'openai';
  return null;
}

function _providerLabel(provider: LlmProvider | null): string {
  const found = PROVIDER_OPTIONS.find((p) => p.value === provider);
  return found ? found.label : 'the other provider';
}

export const LlmKeyDialog: React.FC<LlmKeyDialogProps> = ({
  open,
  onOpenChange,
  client,
  onSaved,
  onRemoved,
  title,
  description,
  saveLabel,
}) => {
  const [provider, setProvider] = useState<LlmProvider>('anthropic');
  const [apiKey, setApiKey] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean>(false);
  const [providerLockedByUser, setProviderLockedByUser] = useState<boolean>(false);
  const [modelChoice, setModelChoice] = useState<string>(() => _defaultModelForProvider('anthropic'));
  const [customModel, setCustomModel] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setApiKey('');
    setSaveError(null);
    setProviderLockedByUser(false);
    const stored = readLlmKey();
    const nextProvider = stored?.provider ?? 'anthropic';
    setProvider(nextProvider);
    setKeyPresent(stored !== null);
    const classified = _classifyStoredModel(nextProvider, stored?.model);
    setModelChoice(classified.choice);
    setCustomModel(classified.custom);
  }, [open]);

  useEffect(() => {
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

  const formatLooksWrong =
    trimmedKey.length > 0 && !trimmedKey.startsWith(selectedProvider.expectedPrefix);

  const inferredProvider = _inferProviderFromKey(trimmedKey);
  const providerMismatch = inferredProvider !== null && inferredProvider !== provider;

  useEffect(() => {
    if (providerLockedByUser) return;
    if (inferredProvider === null) return;
    if (inferredProvider === provider) return;
    setProvider(inferredProvider);
  }, [inferredProvider, provider, providerLockedByUser]);

  const handleProviderChange = (next: LlmProvider) => {
    setProvider(next);
    setProviderLockedByUser(true);
  };

  const resolveEffectiveModel = (): string => {
    if (modelChoice === CUSTOM_MODEL_VALUE) {
      return customModel.trim();
    }
    return modelChoice;
  };

  const effectiveModel = resolveEffectiveModel();
  const modelFormatInvalid =
    modelChoice === CUSTOM_MODEL_VALUE &&
    effectiveModel.length > 0 &&
    !/^[A-Za-z0-9_.\-/]+$/.test(effectiveModel);
  const modelMissing = modelChoice === CUSTOM_MODEL_VALUE && effectiveModel.length === 0;

  const handleSave = () => {
    if (!canSave) return;
    if (providerMismatch) {
      setSaveError(
        `This key looks like ${_providerLabel(inferredProvider)} but the ` +
          `Provider is set to ${selectedProvider.label}. Change one so they ` +
          `match, or paste a different key.`,
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
    const saved = writeLlmKey(provider, trimmedKey, effectiveModel);
    if (!saved) {
      setSaveError(
        'Could not store the key in this browser tab (sessionStorage is unavailable). ' +
          'Try enabling site storage or use a different browser.',
      );
      return;
    }
    // Arm the live agent socket immediately when a client is provided. If the
    // socket is momentarily down this is a no-op — the key is in sessionStorage
    // so the next (re)connect re-arms it automatically.
    if (client) {
      client.setUserApiKey({
        apiKey: trimmedKey,
        provider,
        model: effectiveModel || undefined,
      });
    }
    setSaveError(null);
    setKeyPresent(true);
    onSaved?.({ provider, apiKey: trimmedKey, model: effectiveModel });
    onOpenChange(false);
  };

  const handleRemove = () => {
    clearLlmKey();
    if (client) {
      client.setUserApiKey({ apiKey: '' });
    }
    setKeyPresent(false);
    setApiKey('');
    setSaveError(null);
    onRemoved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            {title ?? 'Use your own API key'}
          </DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Bring your own Anthropic, OpenAI, or Mistral key to power the
                modeling assistant and the Spec-Driven generator with your own
                model and avoid shared rate limits. <strong>{DEFAULT_PRIVACY_COPY}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="llm-key-provider">Provider</Label>
            <select
              id="llm-key-provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {inferredProvider !== null &&
              !providerLockedByUser &&
              inferredProvider === provider &&
              trimmedKey.length > 0 && (
                <p className="text-xs text-muted-foreground">Provider auto-selected from the key prefix.</p>
              )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="llm-key-api-key">API Key</Label>
            <Input
              id="llm-key-api-key"
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
                This key looks like a {_providerLabel(inferredProvider)} key, but Provider is set to{' '}
                {selectedProvider.label}. Change one so they match — otherwise the API will reject the key.
              </p>
            )}
            {!providerMismatch && formatLooksWrong && (
              <p className="text-xs text-amber-600">
                That doesn&rsquo;t look like a {selectedProvider.label} key, but the prefix is unusual enough
                that we can&rsquo;t tell for sure. Save will still proceed.
              </p>
            )}
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="llm-key-model">Model (optional)</Label>
            <select
              id="llm-key-model"
              value={modelChoice}
              onChange={(e) => {
                const next = e.target.value;
                setModelChoice(next);
                if (next !== CUSTOM_MODEL_VALUE) {
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
                id="llm-key-model-custom"
                type="text"
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
              Defaults to a balanced model for your provider. Pick a stronger model for complex modeling, or
              Custom for any model ID your account can access.
            </p>
          </div>

          {keyPresent && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Remove key
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-brand text-brand-foreground hover:bg-brand-dark"
          >
            {saveLabel ?? 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
