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
import { ChevronDown, KeyRound } from 'lucide-react';
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
  readLlmBudget,
  readLlmKey,
  writeLlmBudget,
  writeLlmKey,
  type LlmProvider,
} from '../../services/llmKeyStorage';

// Static caps for the Spec-Driven run budget. The server ALSO enforces these
// (LLM_MAX_COST_USD_HARD_CAP=$5 / runtime hard cap 900s), so this is UX only.
const RUN_BUDGET = {
  defaultCostUsd: 1,
  maxCostUsd: 5,
  defaultRuntimeMin: 10,
  maxRuntimeMin: 15,
} as const;

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
  /** Show the collapsible "Spec-Driven Agent settings" (run budget). Default true. */
  showRunBudget?: boolean;
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

// Sentinel for "no explicit model" — the backend then picks its default for the
// provider. This is the DEFAULT selection so nothing specific is pre-chosen.
export const DEFAULT_MODEL_VALUE = '';

export const MODEL_PRESETS: Record<LlmProvider, readonly ModelPreset[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 — most capable' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
  openai: [
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol — most capable' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra — balanced (recommended)' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna — fast & cheap' },
    { value: 'gpt-5.5', label: 'GPT-5.5 — previous flagship' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini — fast & cheap' },
    { value: 'gpt-4o', label: 'GPT-4o — legacy' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large — most capable' },
    { value: 'mistral-small-latest', label: 'Mistral Small — fast & cheap' },
    { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' },
  ],
} as const;

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
    // No stored model → the "…" default option (backend picks the default).
    return { choice: DEFAULT_MODEL_VALUE, custom: '' };
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
  showRunBudget = true,
}) => {
  const [provider, setProvider] = useState<LlmProvider>('anthropic');
  const [apiKey, setApiKey] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean>(false);
  const [providerLockedByUser, setProviderLockedByUser] = useState<boolean>(false);
  const [modelChoice, setModelChoice] = useState<string>(DEFAULT_MODEL_VALUE);
  const [customModel, setCustomModel] = useState<string>('');
  const [budgetOpen, setBudgetOpen] = useState<boolean>(false);
  const [maxCostInput, setMaxCostInput] = useState<string>(String(RUN_BUDGET.defaultCostUsd));
  const [maxRuntimeMinInput, setMaxRuntimeMinInput] = useState<string>(String(RUN_BUDGET.defaultRuntimeMin));

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
    const budget = readLlmBudget();
    setMaxCostInput(String(budget?.maxCostUsd ?? RUN_BUDGET.defaultCostUsd));
    setMaxRuntimeMinInput(
      String(Math.round((budget?.maxRuntimeSeconds ?? RUN_BUDGET.defaultRuntimeMin * 60) / 60)),
    );
    setBudgetOpen(false);
  }, [open]);

  useEffect(() => {
    const presetValues = new Set(MODEL_PRESETS[provider].map((p) => p.value));
    if (
      modelChoice !== DEFAULT_MODEL_VALUE &&
      modelChoice !== CUSTOM_MODEL_VALUE &&
      !presetValues.has(modelChoice)
    ) {
      setModelChoice(DEFAULT_MODEL_VALUE); // fall back to "…" when switching providers
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
    // Persist the Spec-Driven run budget alongside the key (clamped; the server
    // enforces the real hard caps regardless).
    if (showRunBudget) {
      const clampNum = (raw: string, def: number, max: number): number => {
        const n = Number.parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0) return def;
        return Math.min(n, max);
      };
      writeLlmBudget({
        maxCostUsd: clampNum(maxCostInput, RUN_BUDGET.defaultCostUsd, RUN_BUDGET.maxCostUsd),
        maxRuntimeSeconds:
          clampNum(maxRuntimeMinInput, RUN_BUDGET.defaultRuntimeMin, RUN_BUDGET.maxRuntimeMin) * 60,
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
              <option value={DEFAULT_MODEL_VALUE}>… — use the recommended default</option>
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
              Leave on “…” to let the backend pick a sensible default for your provider. Pick a stronger model
              for complex modeling, or Custom for any model ID your account can access.
            </p>
          </div>

          {showRunBudget && (
            <div className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setBudgetOpen((v) => !v)}
                aria-expanded={budgetOpen}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Spec-Driven Agent settings
                <ChevronDown
                  className={`size-4 transition-transform ${budgetOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {budgetOpen && (
                <div className="space-y-3 border-t border-border px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Limits for a single Spec-Driven generation run (billed to your key). The server
                    enforces these caps too.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="llm-budget-cost">Max spend / run (USD)</Label>
                      <Input
                        id="llm-budget-cost"
                        type="number"
                        min={0.1}
                        step={0.1}
                        max={RUN_BUDGET.maxCostUsd}
                        value={maxCostInput}
                        onChange={(e) => setMaxCostInput(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="llm-budget-runtime">Max time / run (min)</Label>
                      <Input
                        id="llm-budget-runtime"
                        type="number"
                        min={1}
                        step={1}
                        max={RUN_BUDGET.maxRuntimeMin}
                        value={maxRuntimeMinInput}
                        onChange={(e) => setMaxRuntimeMinInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Up to ${RUN_BUDGET.maxCostUsd} and {RUN_BUDGET.maxRuntimeMin} min per run.
                  </p>
                </div>
              )}
            </div>
          )}

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
