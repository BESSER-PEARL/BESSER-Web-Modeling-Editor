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

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  readFreeTierModel,
  readFreeTierSelected,
  readLlmBudget,
  readLlmKey,
  writeFreeTierModel,
  writeFreeTierSelected,
  writeLlmBudget,
  writeLlmKey,
  type LlmProvider,
} from '../../services/llmKeyStorage';
import { isPilotSession } from '@/main/shared/services/telemetry/pilotTelemetry';
import {
  defaultFreeModelId,
  preferredFreeModelId,
  FALLBACK_SMART_GEN_CONFIG,
  freeModelLabel,
  getSpecDrivenConfig,
  peekSpecDrivenConfig,
  type SpecDrivenCatalogProvider,
  type SpecDrivenFreeTier,
} from '../../services/specDrivenConfig';

const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';

// Last-resort bounds for the Spec-Driven run budget, used ONLY until the
// server's real caps arrive from GET /spec-driven/config (and if that call
// fails). Not the source of truth: a stale hardcoded mirror silently becomes
// the binding limit and kills runs the backend would allow.
const RUN_BUDGET_FALLBACK = {
  defaultCostUsd: 5,
  maxCostUsd: 5,
  defaultRuntimeMin: 20,
  maxRuntimeMin: 40,
} as const;

/** Minimal shape of an agent client we can arm — avoids importing a feature. */
export interface LlmKeyArmableClient {
  setUserApiKey: (key: {
    apiKey: string;
    provider?: string;
    model?: string;
    baseUrl?: string;
  }) => void;
}

export interface LlmKeySavedDetail {
  provider: LlmProvider;
  apiKey: string;
  /** Effective model override, or empty string for "use backend default". */
  model: string;
  /** The user's OpenAI-compatible base URL for 'local', or undefined. */
  baseUrl?: string;
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
  /**
   * Open with the key-entry flow even when the free tier is the user's
   * current selection. For surfaces whose affordance is explicitly about
   * entering a key (the chat's "use your own API key" link, the assistant's
   * add-key buttons) — the Free option stays available in the dropdown, it
   * just is not preselected. Default false (neutral settings surfaces
   * reflect the current selection).
   */
  preferKeyEntry?: boolean;
  /**
   * Provider preselected on open, ahead of the stored key's provider. For
   * surfaces that cannot use the saved one (e.g. Knowledge Graph refinement
   * accepts Anthropic, OpenAI, Mistral or Nebius keys, not PIA or local, so it
   * passes `anthropic` when the saved key is unusable there): the user lands on
   * a provider that works instead of whatever was saved last. The saved model
   * is only carried over when it belongs to the preselected provider. The user
   * can still pick another; saving replaces the single shared key either way.
   */
  preferProvider?: LlmProvider;
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
  {
    value: 'nebius',
    label: 'Nebius Token Factory',
    placeholder: 'Your Nebius Token Factory API key',
    hint:
      'Open-weight models on Nebius. Powers the Spec-Driven generator; the ' +
      'modeling assistant keeps using its default model. No fixed key prefix.',
    expectedPrefix: '',
  },
  // A gateway whose endpoint, models and wording come from the server's model
  // catalog; offered only where the server lists it.
  {
    value: 'pia',
    label: 'PIA (LIST)',
    placeholder: 'sk-...',
    hint: 'Your personal gateway key.',
    expectedPrefix: '',
  },
  {
    value: 'local',
    label: 'Local (self-hosted)',
    placeholder: 'ollama (any value)',
    hint: 'A local OpenAI-compatible server (Ollama, llama.cpp, vLLM, LM Studio…). Most need no key — leave it as "ollama".',
    expectedPrefix: '',
  },
] as const;

/**
 * The keyless free tier. Offered in the dropdown only when the backend
 * advertises it (GET /spec-driven/config → free_tier.available), so a deploy
 * without the hosted endpoint never shows an option that cannot run. Selecting
 * it hides the API-key input; the model comes from the server's free-model
 * list. Applies to the Spec-Driven generator — the assistant keeps using the
 * stored BYOK key (or its server default) unchanged.
 */
const FREE_PROVIDER_OPTION: ProviderOption = {
  value: 'free',
  label: 'Free — included, no key required',
  placeholder: '',
  hint: 'Runs on the server-hosted free models. No API key required.',
  expectedPrefix: '',
};

/**
 * 'local' sends the user's own base URL, which the BACKEND must reach — so it
 * only works when the WME backend runs locally. A short note is shown under
 * the dropdown. On the hosted deploy the backend rejects it (see
 * BESSER_LLM_ALLOW_CUSTOM_BASE_URL) — it degrades to a clear error.
 */
const LOCAL_BACKEND_NOTE: Partial<Record<LlmProvider, string>> = {
  local: 'The BESSER backend opens this URL, not your browser — so run the full WME locally, on the same machine/network as your model server.',
};

/**
 * pia/local are OpenAI-compatible endpoints with no server-side default model
 * and keys of any shape. pia's endpoint is resolved by the server from its
 * model catalog; local's is the user's.
 */
function _isCustomEndpoint(provider: LlmProvider): boolean {
  return provider === 'pia' || provider === 'local';
}

/**
 * Whether the modeling assistant can actually use a key for this provider.
 * Mirrors the agent's own allowlist (modeling-agent `src/byok.py`
 * SUPPORTED_PROVIDERS) plus the two gateway labels it accepts as 'openai'.
 * A provider outside it is Spec-Driven-only.
 */
function _assistantSupportsProvider(provider: LlmProvider): boolean {
  return (
    provider === 'anthropic' ||
    provider === 'openai' ||
    provider === 'mistral' ||
    provider === 'nebius' ||
    provider === 'pia' ||
    provider === 'local'
  );
}

/**
 * 'local' only works when the WME BACKEND runs locally (it opens the URL, not
 * the browser), so it is offered only on a localhost deployment.
 */
function _isLocalDeployment(): boolean {
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
}

interface ModelPreset {
  value: string;
  label: string;
}

export const CUSTOM_MODEL_VALUE = '__custom__';

// Sentinel for "no explicit model" — the backend then picks its default for the
// provider. This is the DEFAULT selection so nothing specific is pre-chosen.
export const DEFAULT_MODEL_VALUE = '';

const CUSTOM_MODEL_PRESET: ModelPreset = { value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' };

// The model lists come from the server's model catalog (GET /spec-driven/config
// → providers). These are the last resort when it cannot be read: vendors keep
// "Recommended default" and Custom, local keeps one real model to preselect.
// 'free' renders its own block from free_tier.models; its entry only keeps the
// record total over LlmProvider.
const FALLBACK_MODEL_PRESETS: Record<LlmProvider, readonly ModelPreset[]> = {
  anthropic: [],
  openai: [],
  mistral: [],
  nebius: [],
  pia: [],
  local: [{ value: 'qwen2.5-coder:7b', label: 'qwen2.5-coder:7b' }],
  free: [{ value: DEFAULT_MODEL_VALUE, label: 'Server default (no key required)' }],
};

type ModelPresets = Record<LlmProvider, readonly ModelPreset[]>;

/** Each provider's model choices: the catalog's when it lists the provider. */
function _modelPresets(catalog: readonly SpecDrivenCatalogProvider[]): ModelPresets {
  const presets: ModelPresets = { ...FALLBACK_MODEL_PRESETS };
  for (const entry of catalog) {
    if (entry.id in presets && entry.id !== 'free') {
      // The default-flagged model first, so pia/local preselect it.
      const models = [...entry.models].sort((a, b) => Number(b.default) - Number(a.default));
      presets[entry.id as LlmProvider] = models.map((m) => ({ value: m.id, label: m.label }));
    }
  }
  for (const provider of Object.keys(presets) as LlmProvider[]) {
    if (provider !== 'free') presets[provider] = [...presets[provider], CUSTOM_MODEL_PRESET];
  }
  return presets;
}

/**
 * The providers to offer: the catalog's, in its order and with its wording;
 * the built-in vendors when there is no catalog. 'local' needs a local backend.
 */
function _providerOptions(catalog: readonly SpecDrivenCatalogProvider[]): ProviderOption[] {
  const builtIn = new Map(PROVIDER_OPTIONS.map((p) => [p.value, p]));
  const options: ProviderOption[] = catalog.length
    ? catalog.flatMap((entry) => {
        const known = builtIn.get(entry.id as LlmProvider);
        if (!known) return [];
        return [{
          ...known,
          label: entry.label,
          hint: entry.hint ?? known.hint,
          expectedPrefix: entry.key_prefix ?? known.expectedPrefix,
        }];
      })
    : PROVIDER_OPTIONS.filter((p) => p.value !== 'pia');
  return _isLocalDeployment() ? options : options.filter((p) => p.value !== 'local');
}

const CUSTOM_MODEL_PLACEHOLDER: Record<LlmProvider, string> = {
  anthropic: 'e.g. claude-opus-4-8',
  openai: 'e.g. gpt-4.1',
  mistral: 'e.g. mistral-medium-latest',
  nebius: 'e.g. Qwen/Qwen3-235B-A22B-Instruct-2507',
  pia: 'e.g. claude-opus-4-8',
  local: 'e.g. qwen2.5-coder:14b',
  free: '',
} as const;

// Stored ids that were presets before and now have a preset under another
// name. The dated Haiku snapshot still works, but the alias is the preset.
const LEGACY_MODEL_ALIASES: Partial<Record<LlmProvider, Record<string, string>>> = {
  anthropic: { 'claude-haiku-4-5-20251001': 'claude-haiku-4-5' },
};

function _classifyStoredModel(
  provider: LlmProvider,
  storedRaw: string | undefined,
  presets: ModelPresets,
): { choice: string; custom: string } {
  const stored = (storedRaw && LEGACY_MODEL_ALIASES[provider]?.[storedRaw]) || storedRaw;
  if (!stored) {
    // pia/local have no server-side "default" that maps to a real model, so
    // pre-select their first preset. anthropic/openai/mistral use the "Recommended default"
    // sentinel (the backend picks a sensible default for those).
    if (_isCustomEndpoint(provider)) {
      return { choice: presets[provider][0].value, custom: '' };
    }
    // No stored model → the "Recommended default" option (backend picks the default).
    return { choice: DEFAULT_MODEL_VALUE, custom: '' };
  }
  const matchesPreset = presets[provider].some(
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

function _providerLabel(
  provider: LlmProvider | null,
  options: readonly ProviderOption[],
): string {
  const found = options.find((p) => p.value === provider);
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
  preferKeyEntry = false,
  preferProvider,
}) => {
  const [provider, setProvider] = useState<LlmProvider>('anthropic');
  const [apiKey, setApiKey] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean>(false);
  // "Remove key" is staged and only committed on Save, so Cancel keeps the key.
  const [removePending, setRemovePending] = useState<boolean>(false);
  const [providerLockedByUser, setProviderLockedByUser] = useState<boolean>(false);
  const [modelChoice, setModelChoice] = useState<string>(DEFAULT_MODEL_VALUE);
  const [customModel, setCustomModel] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [budgetOpen, setBudgetOpen] = useState<boolean>(false);
  const [maxCostInput, setMaxCostInput] = useState<string>(
    String(RUN_BUDGET_FALLBACK.defaultCostUsd),
  );
  const [maxRuntimeMinInput, setMaxRuntimeMinInput] = useState<string>(
    String(RUN_BUDGET_FALLBACK.defaultRuntimeMin),
  );
  // Server-published run-budget caps. The config service already validates
  // that all four values are finite numbers, so they are safe to use directly.
  const [caps, setCaps] = useState(FALLBACK_SMART_GEN_CONFIG.caps);
  const budgetBounds = useMemo(
    () => ({
      defaultCostUsd: caps.default_max_cost_usd,
      maxCostUsd: caps.max_cost_usd_hard_cap,
      defaultRuntimeMin: Math.max(1, Math.round(caps.default_max_runtime_seconds / 60)),
      maxRuntimeMin: Math.max(1, Math.round(caps.max_runtime_seconds_hard_cap / 60)),
    }),
    [caps],
  );
  // Free-tier advertisement from GET /spec-driven/config (cached module-level).
  // Starts at the fallback (unavailable) so an old backend never shows a Free
  // option that cannot run.
  const [freeTier, setFreeTier] = useState<SpecDrivenFreeTier>(
    FALLBACK_SMART_GEN_CONFIG.free_tier,
  );
  const [freeModelChoice, setFreeModelChoice] = useState<string>('');
  // Ref mirror of providerLockedByUser for the async config callback below —
  // a manual provider pick made while the config is still loading must not be
  // overridden by the free-tier preselect.
  const providerLockedRef = useRef(false);
  // The same for a model pick: the catalog arriving late must not undo it.
  const modelTouchedRef = useRef(false);
  // The server's model catalog. Starts from the last loaded config, so a
  // dialog opened after the first load renders the server's lists at once.
  const [catalog, setCatalog] = useState<readonly SpecDrivenCatalogProvider[]>(
    () => peekSpecDrivenConfig()?.providers ?? [],
  );
  const modelPresets = useMemo(() => _modelPresets(catalog), [catalog]);
  const providerOptions = useMemo(() => _providerOptions(catalog), [catalog]);

  // The keyless Free tier is offered first whenever the backend advertises it.
  const visibleProviderOptions = useMemo(
    () => (freeTier.available ? [FREE_PROVIDER_OPTION, ...providerOptions] : providerOptions),
    [freeTier.available, providerOptions],
  );

  // Provider, model and base URL from the stored key, for the providers this
  // catalog offers.
  const applyStoredSelection = (providers: readonly SpecDrivenCatalogProvider[]) => {
    const offered = _providerOptions(providers);
    const presets = _modelPresets(providers);
    const stored = readLlmKey();
    let nextProvider = preferProvider ?? stored?.provider ?? 'anthropic';
    // A stored provider this server does not offer (a pia key on a server
    // without the gateway, a local key on the hosted editor) would otherwise
    // render a provider that isn't in the list.
    if (nextProvider !== 'free' && !offered.some((p) => p.value === nextProvider)) {
      nextProvider = 'anthropic';
    }
    setProvider(nextProvider);
    // A saved model belongs to the saved provider: when another provider is
    // preselected (preferProvider, or an unoffered one), its id would land in
    // the custom-model box of the wrong provider.
    const classified = _classifyStoredModel(
      nextProvider,
      stored?.provider === nextProvider ? stored?.model : undefined,
      presets,
    );
    setModelChoice(classified.choice);
    setCustomModel(classified.custom);
    // Only 'local' has a base URL field (default Ollama); pia's endpoint is the
    // server's.
    const storedBase = stored?.provider === 'local' ? stored.baseUrl ?? '' : '';
    setBaseUrl(nextProvider === 'local' ? storedBase || DEFAULT_LOCAL_BASE_URL : '');
  };

  // Fetch the free-tier advertisement when the dialog opens; hydrate the
  // free-model choice (stored id wins only while the server still advertises
  // it) and preselect the Free provider when the free tier is the user's
  // latest recorded choice and no manual pick has happened meanwhile.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const openedWithCatalog = peekSpecDrivenConfig() !== null;
    void getSpecDrivenConfig().then((cfg) => {
      if (cancelled) return;
      setFreeTier(cfg.free_tier);
      setCaps(cfg.caps);
      setCatalog(cfg.providers);
      // Opened before any config had loaded: the form was filled from the
      // fallback lists. Fill it again from the catalog unless the user has
      // already picked something.
      if (!openedWithCatalog && !providerLockedRef.current && !modelTouchedRef.current) {
        applyStoredSelection(cfg.providers);
      }
      const storedFreeModel = readFreeTierModel();
      const freeModels = cfg.free_tier.models;
      // An explicit stored choice always wins. Otherwise a telemetry session
      // gets the server's pilot_model and everyone else the ordinary default.
      setFreeModelChoice(
        storedFreeModel && freeModels.some((m) => m.id === storedFreeModel)
          ? storedFreeModel
          : preferredFreeModelId(cfg.free_tier, isPilotSession()),
      );
      // Preselect Free only when it is unambiguously the user's current
      // setup: opted in AND no BYOK key stored. A user who has a stored key
      // usually opens this dialog to manage that key — keep their provider
      // selected so the key flow is immediately usable (Free stays one pick
      // away in the dropdown). Surfaces whose affordance is explicitly
      // key entry opt out entirely via `preferKeyEntry`.
      if (
        cfg.free_tier.available &&
        !preferKeyEntry &&
        readFreeTierSelected() &&
        readLlmKey() === null &&
        !providerLockedRef.current
      ) {
        setProvider('free');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, preferKeyEntry]);

  useEffect(() => {
    if (!open) return;
    setApiKey('');
    setSaveError(null);
    setRemovePending(false);
    setProviderLockedByUser(false);
    providerLockedRef.current = false;
    modelTouchedRef.current = false;
    setKeyPresent(readLlmKey() !== null);
    applyStoredSelection(catalog);
    const budget = readLlmBudget();
    setMaxCostInput(String(budget?.maxCostUsd ?? budgetBounds.defaultCostUsd));
    setMaxRuntimeMinInput(
      String(
        Math.round((budget?.maxRuntimeSeconds ?? budgetBounds.defaultRuntimeMin * 60) / 60),
      ),
    );
    setBudgetOpen(false);
  }, [open, preferProvider]);

  useEffect(() => {
    const presetValues = new Set(modelPresets[provider].map((p) => p.value));
    if (
      modelChoice !== DEFAULT_MODEL_VALUE &&
      modelChoice !== CUSTOM_MODEL_VALUE &&
      !presetValues.has(modelChoice)
    ) {
      setModelChoice(DEFAULT_MODEL_VALUE); // fall back to the default when switching providers
      setCustomModel('');
    }
  }, [provider, modelChoice, modelPresets]);

  const isFreeProvider = provider === 'free';
  // The server's free-model allowlist. A choice is offered only when it holds
  // more than one entry (primary + configured fallback).
  const freeModels = freeTier.models;

  const trimmedKey = apiKey.trim();
  // The free tier needs no key, so it is always saveable when selected.
  const canSave = isFreeProvider || trimmedKey.length > 0 || removePending;

  const selectedProvider = useMemo(
    () =>
      providerOptions.find((p) => p.value === provider) ??
      PROVIDER_OPTIONS.find((p) => p.value === provider) ??
      PROVIDER_OPTIONS[0],
    [provider, providerOptions],
  );

  const formatLooksWrong =
    trimmedKey.length > 0 && !trimmedKey.startsWith(selectedProvider.expectedPrefix);

  const inferredProvider = _inferProviderFromKey(trimmedKey);
  // Don't second-guess pia/local: a PIA key legitimately starts with sk- (which
  // would otherwise infer 'openai'), and 'local' keys are arbitrary. 'free'
  // has no key at all, so there is nothing to infer against.
  const providerMismatch =
    !isFreeProvider &&
    !_isCustomEndpoint(provider) &&
    inferredProvider !== null &&
    inferredProvider !== provider;

  useEffect(() => {
    if (providerLockedByUser) return;
    if (isFreeProvider) return; // never auto-switch away from the free tier
    if (_isCustomEndpoint(provider)) return; // never auto-switch away from pia/local
    if (inferredProvider === null) return;
    if (inferredProvider === provider) return;
    setProvider(inferredProvider);
  }, [inferredProvider, provider, providerLockedByUser, isFreeProvider]);

  const handleProviderChange = (next: LlmProvider) => {
    setProvider(next);
    setProviderLockedByUser(true);
    providerLockedRef.current = true;
    if (next === 'local' && baseUrl.trim() === '') {
      setBaseUrl(DEFAULT_LOCAL_BASE_URL);
    }
    // pia/local have no server-side default model (see _classifyStoredModel),
    // so preselect their first preset instead of "Recommended default".
    if (
      _isCustomEndpoint(next) &&
      modelChoice !== CUSTOM_MODEL_VALUE &&
      !modelPresets[next].some((p) => p.value === modelChoice)
    ) {
      setModelChoice(modelPresets[next][0].value);
    }
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

  // Persist the Spec-Driven run budget (clamped; the server enforces the real
  // hard caps regardless). Shared by the BYOK and free-tier save paths.
  const persistRunBudget = () => {
    if (!showRunBudget) return;
    const clampNum = (raw: string, def: number, max: number): number => {
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n) || n <= 0) return def;
      return Math.min(n, max);
    };
    writeLlmBudget({
      maxCostUsd: clampNum(
        maxCostInput, budgetBounds.defaultCostUsd, budgetBounds.maxCostUsd,
      ),
      maxRuntimeSeconds:
        clampNum(
          maxRuntimeMinInput, budgetBounds.defaultRuntimeMin, budgetBounds.maxRuntimeMin,
        ) * 60,
    });
  };

  const commitRemoval = () => {
    clearLlmKey();
    if (client) {
      client.setUserApiKey({ apiKey: '' });
    }
    setKeyPresent(false);
    setRemovePending(false);
    onRemoved?.();
  };

  const handleSave = () => {
    if (!canSave) return;
    if (removePending && !isFreeProvider && trimmedKey.length === 0) {
      commitRemoval();
      setSaveError(null);
      onOpenChange(false);
      return;
    }
    // Free tier: no key to store and no agent socket to arm — record the
    // opt-in on its dedicated flag plus the (non-default) model choice. The
    // stored BYOK key, if any, is left untouched so the assistant keeps
    // working with it; the spec-driven trigger prefers the free flag
    // ("last action wins" — saving a key later clears the flag again in
    // writeLlmKey).
    if (isFreeProvider) {
      if (removePending) commitRemoval();
      writeFreeTierSelected(true);
      // null means "use the server default", which for a telemetry session is
      // the server's pilot_model — so there the pick is always stored
      // explicitly, or choosing it would collapse to the public default.
      const collapsible =
        !isPilotSession() && freeModelChoice === defaultFreeModelId(freeModels);
      writeFreeTierModel(
        freeModels.length > 1 && !collapsible ? freeModelChoice : null,
      );
      persistRunBudget();
      setSaveError(null);
      onSaved?.({
        provider: 'free',
        apiKey: '',
        model: readFreeTierModel() ?? '',
      });
      onOpenChange(false);
      return;
    }
    if (providerMismatch) {
      setSaveError(
        `This key looks like ${_providerLabel(inferredProvider, providerOptions)} but the ` +
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
    // Only 'local' carries a base URL (the user's server); the server resolves
    // pia's from its model catalog. Validate the local URL shape.
    let effectiveBaseUrl: string | undefined;
    if (provider === 'local') {
      effectiveBaseUrl = baseUrl.trim();
      if (!effectiveBaseUrl) {
        setSaveError('Enter your local server URL, e.g. http://localhost:11434/v1');
        return;
      }
      if (!/^https?:\/\//i.test(effectiveBaseUrl)) {
        setSaveError('Local server URL must start with http:// or https://');
        return;
      }
    }
    const saved = writeLlmKey(provider, trimmedKey, effectiveModel, effectiveBaseUrl);
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
    //
    // Skipped for providers the modeling agent's own BYOK layer does not
    // support (it allowlists anthropic/openai/mistral/nebius and discards the rest).
    // Sending the key anyway would hand a secret to a service that will only
    // log "unsupported provider" and drop it. The assistant then runs on the
    // server's default model — which is exactly what its own re-arm path does,
    // since readAssistantApiKey() rejects the stored provider too.
    if (client && _assistantSupportsProvider(provider)) {
      client.setUserApiKey({
        apiKey: trimmedKey,
        provider,
        model: effectiveModel || undefined,
        baseUrl: effectiveBaseUrl,
      });
    }
    // Persist the Spec-Driven run budget alongside the key (clamped; the server
    // enforces the real hard caps regardless).
    persistRunBudget();
    setSaveError(null);
    setKeyPresent(true);
    onSaved?.({ provider, apiKey: trimmedKey, model: effectiveModel, baseUrl: effectiveBaseUrl });
    onOpenChange(false);
  };

  const handleRemove = () => {
    setRemovePending(true);
    setApiKey('');
    setSaveError(null);
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
                Bring your own Anthropic, OpenAI, Mistral, or Nebius key to power the
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
              {visibleProviderOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {inferredProvider !== null &&
              !providerLockedByUser &&
              inferredProvider === provider &&
              trimmedKey.length > 0 &&
              !_isCustomEndpoint(provider) && (
                <p className="text-xs text-muted-foreground">Provider auto-selected from the key prefix.</p>
              )}
            {isFreeProvider && (
              <p className="text-xs text-muted-foreground">
                No API key required — runs on the server-hosted free models.
                Applies to the Spec-Driven generator; quality is lower than the
                paid providers.
              </p>
            )}
            {LOCAL_BACKEND_NOTE[provider] && (
              <p className="text-xs text-warning">{LOCAL_BACKEND_NOTE[provider]}</p>
            )}
          </div>

          {/* Free-tier model choice — shown only when the server advertises
              more than one free model. The list is rendered verbatim from the
              config endpoint (any number of entries: the default, any extra
              models on the same endpoint, a self-hosted fallback), so the
              server can add a free model without a frontend change. Reads and
              writes the same stored choice as the Spec-Driven run dialog. */}
          {isFreeProvider && freeModels.length > 1 && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium leading-none">Model</legend>
              <div className="space-y-1" role="radiogroup" aria-label="Free model">
                {freeModels.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground has-[:checked]:border-brand"
                  >
                    <input
                      type="radio"
                      name="llm-key-free-model"
                      value={m.id}
                      checked={freeModelChoice === m.id}
                      onChange={() => setFreeModelChoice(m.id)}
                      className="accent-current"
                    />
                    <span>{freeModelLabel(m)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Every option is free. The self-hosted model runs on BESSER
                infrastructure; if it is unavailable your run reports an error
                instead of switching models.
              </p>
            </fieldset>
          )}

          {provider === 'local' && (
            <div className="space-y-1.5">
              <Label htmlFor="llm-key-base-url">Local server URL</Label>
              <Input
                id="llm-key-base-url"
                type="text"
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setSaveError(null);
                }}
                placeholder={DEFAULT_LOCAL_BASE_URL}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Your OpenAI-compatible endpoint. For Ollama use{' '}
                <code>{DEFAULT_LOCAL_BASE_URL}</code>.
              </p>
            </div>
          )}

          {!isFreeProvider && (
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
              aria-invalid={saveError || providerMismatch ? true : undefined}
              aria-describedby={
                [
                  providerMismatch && 'llm-key-mismatch',
                  saveError && 'llm-key-error',
                ].filter(Boolean).join(' ') || undefined
              }
            />
            <p className="text-xs text-muted-foreground">{selectedProvider.hint}</p>
            {providerMismatch && (
              <p id="llm-key-mismatch" role="alert" className="text-xs font-medium text-destructive">
                This key looks like a {_providerLabel(inferredProvider, providerOptions)} key, but Provider is set to{' '}
                {selectedProvider.label}. Change one so they match — otherwise the API will reject the key.
              </p>
            )}
            {!providerMismatch && formatLooksWrong && (
              <p className="text-xs text-warning">
                That doesn&rsquo;t look like a {selectedProvider.label} key, but the prefix is unusual enough
                that we can&rsquo;t tell for sure. Save will still proceed.
              </p>
            )}
            {saveError && (
              <p id="llm-key-error" role="alert" className="text-xs text-destructive">
                {saveError}
              </p>
            )}
          </div>
          )}

          {!isFreeProvider && (
          <div className="space-y-1.5">
            <Label htmlFor="llm-key-model">Model (optional)</Label>
            <select
              id="llm-key-model"
              value={modelChoice}
              onChange={(e) => {
                const next = e.target.value;
                modelTouchedRef.current = true;
                setModelChoice(next);
                if (next !== CUSTOM_MODEL_VALUE) {
                  setCustomModel('');
                }
                setSaveError(null);
              }}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value={DEFAULT_MODEL_VALUE}>Recommended default</option>
              {modelPresets[provider].map((p) => (
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
              Each option is labelled with its trade-off: “most capable” models give the
              best results but cost more and run slower, while “fast &amp; cheap” models are
              quicker and lower-cost. Leave on “Recommended default” to let the backend pick a
              sensible default for your provider, or choose Custom for any model ID your account can access.
            </p>
          </div>
          )}

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
                        max={budgetBounds.maxCostUsd}
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
                        max={budgetBounds.maxRuntimeMin}
                        value={maxRuntimeMinInput}
                        onChange={(e) => setMaxRuntimeMinInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Up to ${budgetBounds.maxCostUsd} and {budgetBounds.maxRuntimeMin} min per run.
                  </p>
                </div>
              )}
            </div>
          )}

          {keyPresent && !removePending && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Remove key
            </button>
          )}
          {removePending && (
            <p role="status" className="text-xs text-muted-foreground">
              Your key will be removed when you save.{' '}
              <button
                type="button"
                onClick={() => setRemovePending(false)}
                className="font-medium text-foreground underline"
              >
                Undo
              </button>
            </p>
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
