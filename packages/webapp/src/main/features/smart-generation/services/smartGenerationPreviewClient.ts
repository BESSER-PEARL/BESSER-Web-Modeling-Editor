import { SMART_GEN_PREVIEW_ENDPOINT } from '../../../shared/constants/constant';
import type {
  SmartGenPreviewModelSummaryEntry,
  SmartGenPreviewPlan,
  SmartGenMode,
  SmartGenPrimaryKind,
} from '../types';

const PRIMARY_KINDS: ReadonlySet<SmartGenPrimaryKind> = new Set([
  'class',
  'gui',
  'agent',
  'state_machine',
  'object',
  'quantum',
  'bpmn',
  'nn',
]);

const isPrimaryKind = (value: unknown): value is SmartGenPrimaryKind =>
  typeof value === 'string' && PRIMARY_KINDS.has(value as SmartGenPrimaryKind);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export interface SmartGenPreviewParams {
  project: unknown;
  instructions: string;
  maxCostUsd: number;
  maxRuntimeSeconds: number;
  mode: SmartGenMode;
  baseRunId?: string;
  primaryKindOverride?: SmartGenPrimaryKind;
  signal?: AbortSignal;
}

export class SmartGenPreviewError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SmartGenPreviewError';
    this.status = status;
  }
}

function normalizePreview(raw: unknown): SmartGenPreviewPlan {
  if (!raw || typeof raw !== 'object') {
    throw new SmartGenPreviewError('Preview response was not an object.');
  }
  const data = raw as Record<string, unknown>;
  const modelSummary = data.model_summary as Record<string, unknown> | undefined;
  const primaryKind = data.primary_kind;
  const summaryPrimary = modelSummary?.primary;
  const auxiliaryKinds = data.auxiliary_kinds;
  const present = modelSummary?.present;
  const executionMode = data.execution_mode;

  if (
    !isPrimaryKind(primaryKind) ||
    !isPrimaryKind(summaryPrimary) ||
    !Array.isArray(auxiliaryKinds) ||
    !auxiliaryKinds.every(isPrimaryKind) ||
    !Array.isArray(present) ||
    (executionMode !== 'generate' && executionMode !== 'modify') ||
    typeof data.summary !== 'string' ||
    !isFiniteNumber(data.target_generator_confidence) ||
    !isFiniteNumber(data.estimated_turns) ||
    !isFiniteNumber(data.estimated_cost_usd) ||
    !isFiniteNumber(data.estimated_duration_seconds) ||
    !Array.isArray(data.notes) ||
    !data.notes.every((note) => typeof note === 'string')
  ) {
    throw new SmartGenPreviewError('Preview response had an unexpected shape.');
  }

  const normalizedPresent: SmartGenPreviewModelSummaryEntry[] = present.map((entry) => {
    if (!entry || typeof entry !== 'object' || !isPrimaryKind((entry as Record<string, unknown>).kind)) {
      throw new SmartGenPreviewError('Preview model summary had an unexpected shape.');
    }
    const source = entry as Record<string, unknown>;
    const normalized: SmartGenPreviewModelSummaryEntry = {
      kind: source.kind as SmartGenPrimaryKind,
    };
    for (const metric of ['classes', 'enumerations', 'associations', 'modules', 'screens', 'count'] as const) {
      if (isFiniteNumber(source[metric])) normalized[metric] = source[metric];
    }
    return normalized;
  });

  const targetGenerator = data.target_generator;
  if (targetGenerator !== null && typeof targetGenerator !== 'string') {
    throw new SmartGenPreviewError('Preview target generator was invalid.');
  }

  return {
    primaryKind,
    auxiliaryKinds,
    targetGenerator,
    executionMode,
    targetGeneratorConfidence: data.target_generator_confidence,
    summary: data.summary,
    estimatedTurns: Math.round(data.estimated_turns),
    estimatedCostUsd: data.estimated_cost_usd,
    estimatedDurationSeconds: Math.round(data.estimated_duration_seconds),
    notes: [...data.notes],
    modelSummary: {
      primary: summaryPrimary,
      present: normalizedPresent,
    },
  };
}

export async function fetchSmartGenPreview(
  params: SmartGenPreviewParams,
): Promise<SmartGenPreviewPlan> {
  const body: Record<string, unknown> = {
    project: params.project,
    instructions: params.instructions,
    max_cost_usd: params.maxCostUsd,
    max_runtime_seconds: params.maxRuntimeSeconds,
    mode: params.mode,
  };
  if (params.baseRunId) {
    body.base_run_id = params.baseRunId;
  }
  if (params.primaryKindOverride) {
    body.primary_kind_override = params.primaryKindOverride;
  }

  const response = await fetch(SMART_GEN_PREVIEW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!response.ok) {
    let detail = `Preview request failed (${response.status}).`;
    try {
      const payload = await response.json() as { detail?: unknown };
      if (typeof payload.detail === 'string' && payload.detail.trim()) {
        detail = payload.detail;
      }
    } catch {
      // Keep the status-based fallback.
    }
    throw new SmartGenPreviewError(detail, response.status);
  }

  return normalizePreview(await response.json());
}
