import { afterEach, describe, expect, it, vi } from 'vitest';

import { SMART_GEN_PREVIEW_ENDPOINT } from '../../../../shared/constants/constant';
import {
  fetchSmartGenPreview,
  SmartGenPreviewError,
} from '../smartGenerationPreviewClient';

const RESPONSE = {
  primary_kind: 'class',
  auxiliary_kinds: ['gui'],
  execution_mode: 'generate',
  target_generator: 'generate_web_app',
  target_generator_confidence: 0.8,
  summary: 'Generate a web app from the class and GUI models.',
  estimated_turns: 12,
  estimated_cost_usd: 0.42,
  estimated_duration_seconds: 125,
  notes: ['The deterministic generator runs before customization.'],
  model_summary: {
    primary: 'class',
    present: [
      { kind: 'class', classes: 3 },
      { kind: 'gui', screens: 2 },
    ],
  },
};

afterEach(() => vi.restoreAllMocks());

describe('fetchSmartGenPreview', () => {
  it('posts the keyless preview request and normalizes the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    const plan = await fetchSmartGenPreview({
      project: { id: 'p1' },
      instructions: 'Build a web app',
      maxCostUsd: 1,
      maxRuntimeSeconds: 600,
      mode: 'generate',
      primaryKindOverride: 'class',
    });

    expect(plan.primaryKind).toBe('class');
    expect(plan.targetGenerator).toBe('generate_web_app');
    expect(fetchMock).toHaveBeenCalledWith(
      SMART_GEN_PREVIEW_ENDPOINT,
      expect.objectContaining({ method: 'POST' }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request).toEqual({
      project: { id: 'p1' },
      instructions: 'Build a web app',
      max_cost_usd: 1,
      max_runtime_seconds: 600,
      mode: 'generate',
      primary_kind_override: 'class',
    });
    expect(request.api_key).toBeUndefined();
  });

  it('serializes and normalizes an incremental modify preview', async () => {
    const baseRunId = 'd'.repeat(32);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        ...RESPONSE,
        execution_mode: 'modify',
      }), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const plan = await fetchSmartGenPreview({
      project: { id: 'p1' },
      instructions: 'Add authentication',
      maxCostUsd: 1,
      maxRuntimeSeconds: 600,
      mode: 'modify',
      baseRunId,
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.mode).toBe('modify');
    expect(request.base_run_id).toBe(baseRunId);
    expect(plan.executionMode).toBe('modify');
  });

  it.each([
    ['bpmn', 'nn'],
    ['nn', 'bpmn'],
  ] as const)('accepts %s and %s model kinds from the preview', async (primary, auxiliary) => {
    const response = {
      ...RESPONSE,
      primary_kind: primary,
      auxiliary_kinds: [auxiliary],
      model_summary: {
        primary,
        present: [
          { kind: primary, count: 2 },
          { kind: auxiliary, count: 1 },
        ],
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    const plan = await fetchSmartGenPreview({
      project: {}, instructions: 'x', maxCostUsd: 1, maxRuntimeSeconds: 60,
      mode: 'generate',
    });

    expect(plan.primaryKind).toBe(primary);
    expect(plan.auxiliaryKinds).toEqual([auxiliary]);
    expect(plan.modelSummary.present.map((entry) => entry.kind)).toEqual([
      primary,
      auxiliary,
    ]);
  });

  it('surfaces backend detail on an HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'No usable model' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(fetchSmartGenPreview({
      project: {}, instructions: 'x', maxCostUsd: 1, maxRuntimeSeconds: 60,
      mode: 'generate',
    })).rejects.toEqual(expect.objectContaining({
      name: 'SmartGenPreviewError', status: 400, message: 'No usable model',
    } satisfies Partial<SmartGenPreviewError>));
  });

  it('rejects a malformed success payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ summary: 'missing fields' }), { status: 200 }),
    );
    await expect(fetchSmartGenPreview({
      project: {}, instructions: 'x', maxCostUsd: 1, maxRuntimeSeconds: 60,
      mode: 'generate',
    })).rejects.toBeInstanceOf(SmartGenPreviewError);
  });
});
