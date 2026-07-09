/**
 * AssistantByokDialog — bring-your-own-key (BYOK) entry dialog for the AI
 * modeling assistant.
 *
 * Mirrors the Spec-Driven Agent's SmartGenByokDialog UX (same three
 * providers, password input, key-format hints, privacy reassurance) but is
 * fully self-contained: it does NOT import from the smart-generation feature
 * (feature isolation). The assistant keeps its own independent key.
 *
 * On save, the raw key is written to sessionStorage ONLY (this-tab-only,
 * never localStorage, never Redux) and pushed to the agent over the existing
 * WebSocket via `AssistantClient.setUserApiKey`. On remove, the key is cleared
 * from sessionStorage and a `{ user_api_key: '' }` clear is sent to the agent.
 *
 * The raw key NEVER enters Redux and is NEVER logged.
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

import type { AssistantClient } from '../services';
import {
  clearAssistantApiKey,
  readAssistantApiKey,
  writeAssistantApiKey,
  type AssistantApiProvider,
} from '../services/byokStorage';

export interface AssistantByokDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shared assistant client — used to push/clear the key on the agent side. */
  client: AssistantClient;
  /** Optional callback fired after the user saves a key. */
  onKeySaved?: () => void;
}

interface ProviderOption {
  value: AssistantApiProvider;
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

interface ModelPreset {
  value: string;
  label: string;
}

/**
 * Curated preset models per provider. The first entry is the default shown
 * when the provider is picked for the first time. ``CUSTOM_MODEL_VALUE`` is a
 * sentinel — selecting it reveals a free-text input so users can type any
 * model ID the backend accepts.
 */
const CUSTOM_MODEL_VALUE = '__custom__';

const MODEL_PRESETS: Record<AssistantApiProvider, readonly ModelPreset[]> = {
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

/** Default preset for a provider — used when no prior choice is stored. */
function _defaultModelForProvider(provider: AssistantApiProvider): string {
  return MODEL_PRESETS[provider][0].value;
}

/** Placeholder shown in the Custom model ID input, per provider. */
const CUSTOM_MODEL_PLACEHOLDER: Record<AssistantApiProvider, string> = {
  anthropic: 'e.g. claude-opus-4-6',
  openai: 'e.g. gpt-4.1',
  mistral: 'e.g. mistral-medium-latest',
} as const;

/**
 * Classify a stored/resolved model value: either one of the presets
 * (dropdown value = that preset's value, custom input empty) or a custom
 * value (dropdown = CUSTOM_MODEL_VALUE, custom input = the actual string).
 */
function _classifyStoredModel(
  provider: AssistantApiProvider,
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
  'Your key stays in this browser tab only and is sent to the BESSER ' +
  'modeling assistant to power your conversation. It is never stored on our ' +
  'servers and it is cleared when you close the tab.';

/**
 * Infer the provider from the key prefix. Returns ``null`` when the prefix is
 * ambiguous or unrecognised (user must pick manually).
 *
 *   ``sk-ant-…``              → anthropic
 *   ``sk-`` (but not sk-ant-) → openai
 */
function _inferProviderFromKey(trimmedKey: string): AssistantApiProvider | null {
  if (!trimmedKey) return null;
  if (trimmedKey.startsWith('sk-ant-')) return 'anthropic';
  if (trimmedKey.startsWith('sk-')) return 'openai';
  return null;
}

function _providerLabel(provider: AssistantApiProvider | null): string {
  const found = PROVIDER_OPTIONS.find((p) => p.value === provider);
  return found ? found.label : 'the other provider';
}

export const AssistantByokDialog: React.FC<AssistantByokDialogProps> = ({
  open,
  onOpenChange,
  client,
  onKeySaved,
}) => {
  const [provider, setProvider] = useState<AssistantApiProvider>('anthropic');
  const [apiKey, setApiKey] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean>(false);
  // True once the user manually picks a provider — after that we stop
  // auto-detecting from the key prefix and respect the explicit choice.
  const [providerLockedByUser, setProviderLockedByUser] = useState<boolean>(false);

  // Model selector state. ``modelChoice`` is the dropdown value (a preset ID
  // or CUSTOM_MODEL_VALUE). ``customModel`` is the free-text input shown when
  // Custom is picked.
  const [modelChoice, setModelChoice] = useState<string>(() =>
    _defaultModelForProvider('anthropic'),
  );
  const [customModel, setCustomModel] = useState<string>('');

  // Re-hydrate from sessionStorage each time the dialog opens. The key field
  // itself is intentionally left empty (we never round-trip the secret back
  // into a visible field) — only the provider/model preferences are restored.
  useEffect(() => {
    if (!open) return;
    setApiKey('');
    setSaveError(null);
    setProviderLockedByUser(false);
    const stored = readAssistantApiKey();
    const nextProvider = stored?.provider ?? 'anthropic';
    setProvider(nextProvider);
    setKeyPresent(stored !== null);
    const classified = _classifyStoredModel(nextProvider, stored?.model);
    setModelChoice(classified.choice);
    setCustomModel(classified.custom);
  }, [open]);

  // When the provider changes, reset the model choice to that provider's
  // default unless the current choice already belongs to it. Prevents a stale
  // selection (e.g. a Claude model) leaking into an OpenAI request.
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

  // Live, purely-informational format hint — shown as the user types, never
  // blocks the save.
  const formatLooksWrong =
    trimmedKey.length > 0 && !trimmedKey.startsWith(selectedProvider.expectedPrefix);

  // Auto-detected provider from the key prefix. Drives the auto-switch and the
  // strong "this key belongs to the OTHER provider" warning.
  const inferredProvider = _inferProviderFromKey(trimmedKey);
  const providerMismatch = inferredProvider !== null && inferredProvider !== provider;

  // Auto-switch the dropdown when the pasted key's prefix unambiguously
  // identifies the provider — unless the user has explicitly overridden it.
  useEffect(() => {
    if (providerLockedByUser) return;
    if (inferredProvider === null) return;
    if (inferredProvider === provider) return;
    setProvider(inferredProvider);
  }, [inferredProvider, provider, providerLockedByUser]);

  const handleProviderChange = (next: AssistantApiProvider) => {
    setProvider(next);
    setProviderLockedByUser(true);
  };

  /** Resolve the effective model string to persist (empty = backend default). */
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
    // Hard guard: a key whose prefix unambiguously identifies another provider
    // is almost certainly a provider/key mismatch — refuse to save until the
    // user fixes one, otherwise the API rejects the key downstream.
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
    const saved = writeAssistantApiKey(provider, trimmedKey, effectiveModel);
    if (!saved) {
      setSaveError(
        'Could not store the key in this browser tab (sessionStorage is unavailable). ' +
          'Try enabling site storage or use a different browser.',
      );
      return;
    }
    // Push the key to the agent immediately. If the socket is momentarily down
    // this returns 'error' but the key is in sessionStorage, so the next
    // (re)connect re-arms it automatically (AssistantClient.rearmUserApiKey).
    client.setUserApiKey({
      apiKey: trimmedKey,
      provider,
      model: effectiveModel || undefined,
    });
    setSaveError(null);
    setKeyPresent(true);
    onKeySaved?.();
    onOpenChange(false);
  };

  const handleRemove = () => {
    clearAssistantApiKey();
    // Tell the agent to drop the key too (best-effort — bare clear payload).
    client.setUserApiKey({ apiKey: '' });
    setKeyPresent(false);
    setApiKey('');
    setSaveError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Use your own API key
          </DialogTitle>
          <DialogDescription>
            Bring your own Anthropic, OpenAI, or Mistral key to power the
            modeling assistant with your own model and avoid shared rate
            limits. <strong>{PRIVACY_COPY}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-byok-provider">Provider</Label>
            <select
              id="assistant-byok-provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AssistantApiProvider)}
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
                <p className="text-xs text-muted-foreground">
                  Provider auto-selected from the key prefix.
                </p>
              )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assistant-byok-api-key">API Key</Label>
            <Input
              id="assistant-byok-api-key"
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
                This key looks like a {_providerLabel(inferredProvider)} key, but
                Provider is set to {selectedProvider.label}. Change one so they
                match — otherwise the API will reject the key.
              </p>
            )}
            {!providerMismatch && formatLooksWrong && (
              <p className="text-xs text-amber-600">
                That doesn&rsquo;t look like a {selectedProvider.label} key, but
                the prefix is unusual enough that we can&rsquo;t tell for sure.
                Save will still proceed.
              </p>
            )}
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assistant-byok-model">Model (optional)</Label>
            <select
              id="assistant-byok-model"
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
                id="assistant-byok-model-custom"
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
              Defaults to a balanced model for your provider. Pick a stronger
              model for complex modeling, or Custom for any model ID your
              account can access.
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
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
