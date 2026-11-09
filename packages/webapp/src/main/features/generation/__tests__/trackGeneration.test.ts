/**
 * Every generator run is reported once: `generator_used` after a real success,
 * `generator_failed` with why (and the error's kind, never its message) for
 * every failure. A surface that unmounted mid-run is not a failure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));

import { trackGeneration } from '../useGeneratorExecution';
import { ApiError } from '../../../shared/api/api-client';
import type { BesserProject } from '../../../shared/types/project';

const project = {
  id: 'p1',
  name: 'Acme Shop',
  currentDiagramType: 'ClassDiagram',
  currentDiagramIndices: { ClassDiagram: 0 },
  diagrams: {
    ClassDiagram: [
      {
        id: 'd1',
        title: 'Acme',
        model: {
          type: 'ClassDiagram',
          version: '4.0.0',
          nodes: [{ id: 'a', type: 'class', data: { attributes: [{ id: 'b' }] } }],
          edges: [{ id: 'r' }],
        },
      },
    ],
  },
} as unknown as BesserProject;

const context = { project, source: 'menu' as const, durationMs: 42 };

beforeEach(() => captureEvent.mockClear());

describe('trackGeneration', () => {
  it('reports a success with its source, duration and model size', () => {
    trackGeneration('django', { ok: true }, context);
    expect(captureEvent).toHaveBeenCalledWith(
      'generator_used',
      expect.objectContaining({
        generator_type: 'django',
        diagram_type: 'ClassDiagram',
        source: 'menu',
        duration_ms: 42,
        classes_count: 1,
        attributes_count: 1,
        relationships_count: 1,
      }),
    );
  });

  it('marks a run from the stored class diagram', () => {
    trackGeneration('sql', { ok: true, fromStoredModel: true }, { ...context, source: 'assistant' });
    expect(captureEvent).toHaveBeenCalledWith(
      'generator_used',
      expect.objectContaining({ diagram_type: 'ClassDiagram', from_stored_model: true, source: 'assistant' }),
    );
  });

  it('reports a failed request with its HTTP status, never the message', () => {
    trackGeneration(
      'web_app',
      { ok: false, error: 'Class "Acme Order" has no id', cause: new ApiError(500, 'Class "Acme Order" has no id') },
      context,
    );
    expect(captureEvent).toHaveBeenCalledWith('generator_failed', {
      generator_type: 'web_app',
      diagram_type: 'ClassDiagram',
      source: 'menu',
      duration_ms: 42,
      reason: 'request',
      error_type: 'ApiError',
      http_status: 500,
      network_error: false,
    });
    expect(JSON.stringify(captureEvent.mock.calls)).not.toMatch(/acme/i);
  });

  it('reports a failure that never reached the server with its reason', () => {
    trackGeneration('qiskit', { ok: false, error: 'Open the Quantum editor', reason: 'wrong_context' }, context);
    expect(captureEvent).toHaveBeenCalledWith(
      'generator_failed',
      expect.objectContaining({ generator_type: 'qiskit', reason: 'wrong_context' }),
    );
  });

  it('reports nothing when the surface unmounted mid-run', () => {
    trackGeneration('django', { ok: false, error: 'Component unmounted', reason: 'unmounted' }, context);
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it('counts a run declined over validation warnings as blocked, not failed', () => {
    trackGeneration('sql', { ok: false, error: 'declined', reason: 'warnings_declined' }, context);
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith('generator_blocked', {
      generator_type: 'sql',
      diagram_type: 'ClassDiagram',
      source: 'menu',
      reason: 'warnings_declined',
    });
  });
});
