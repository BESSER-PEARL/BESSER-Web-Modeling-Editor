/**
 * The trace digest (`context.traceDigest`, cross-repo traceability contract section 3): sent with a user
 * message when the project records traces and has recorded something, built from the message (its focus), kept
 * by the client's context whitelist (`mergeContexts`), and left out otherwise. `show_trace` is a known action
 * that is not a side effect.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantClient } from '../AssistantClient';
import { buildAssistantTraceDigest } from '../traceDigestContext';
import { memoryTraceStorage } from '../../../../shared/traceability/traceDatabase';
import { replaceProjectTrace, setTraceStorage, loadProjectTrace } from '../../../../shared/traceability/traceStore';
import { emptyTraceFile } from '../../../../shared/types/traceability';
import type { BesserProject } from '../../../../shared/types/project';
import type { TraceDigest } from '../../../../shared/traceability/traceDigest';

const recording = { id: 'p-digest', name: 'Library', settings: { traceabilityEnabled: true } } as unknown as BesserProject;
const notRecording = { ...recording, settings: {} } as unknown as BesserProject;

const at = '2026-10-29T10:00:00.000Z';
const withOperation = () => ({
  ...emptyTraceFile('p-digest'),
  actors: [{ id: 'ada', type: 'Person' as const, name: 'Ada', timestamp: at }],
  artifacts: [
    { id: 'book', type: 'ModelArtifact' as const, name: 'Book', elementId: 'e-book', elementType: 'Class', timestamp: at },
  ],
  operations: [{
    id: 'm', type: 'ModelingSession' as const, status: 'SUCCEEDED' as const, startedAt: at, performedBy: ['ada'], toolCalls: [], reads: [], writes: [],
    changes: [{ id: 'c', kind: 'CREATED' as const, artifactId: 'book', newValue: 'Book', timestamp: at }],
  }],
});

beforeEach(() => setTraceStorage(memoryTraceStorage()));

describe('buildAssistantTraceDigest: when a digest is sent', () => {
  it('sends one for a recording project with a recorded operation, with the message\'s focus and English summaries', async () => {
    await replaceProjectTrace(recording.id, withOperation());
    const digest = buildAssistantTraceDigest(recording, 'Who created Book?')!;
    expect(digest.recording).toBe(true);
    expect(digest.recentOperations![0]).toMatchObject({ type: 'ModelingSession', by: ['Person:Ada'], summary: expect.stringContaining('Created class Book') });
    expect(digest.focus!.map((f) => f.name)).toEqual(['Book']);
  });

  it('has an empty focus without a message (a voice message)', async () => {
    await replaceProjectTrace(recording.id, withOperation());
    expect(buildAssistantTraceDigest(recording)!.focus).toBeUndefined();
  });

  it('is left out when recording is off, when no trace is loaded, or when nothing is recorded', async () => {
    await replaceProjectTrace(recording.id, withOperation());
    expect(buildAssistantTraceDigest(notRecording, 'Book')).toBeUndefined();
    expect(buildAssistantTraceDigest(null, 'Book')).toBeUndefined();
    expect(buildAssistantTraceDigest({ ...recording, id: 'not-loaded' } as BesserProject, 'Book')).toBeUndefined();
    const empty = { ...recording, id: 'p-empty' } as BesserProject;
    await loadProjectTrace(empty.id);
    expect(buildAssistantTraceDigest(empty, 'Book')).toBeUndefined();
  });
});

describe('AssistantClient sends the digest', () => {
  const digest: TraceDigest = { schemaVersion: 1, recording: true, counts: { artifacts: 1, links: 0, outOfDateLinks: 0, operations: { ModelingSession: 1, CodeGeneration: 0, RequirementExtraction: 0, Conversation: 0 } } };

  it('gives the context provider the message and keeps traceDigest in the merged context (the whitelist)', () => {
    const provider = vi.fn(() => ({ activeDiagramType: 'ClassDiagram', traceDigest: digest }));
    const client = new AssistantClient('ws://never-connect.invalid', { contextProvider: provider });
    const payload = (client as any).buildUserPayload('why Book?', 'ClassDiagram');
    expect(provider).toHaveBeenCalledWith('why Book?');
    expect(payload.context.traceDigest).toEqual(digest);
  });

  it('lets a digest in the override win, and omits the field when there is none', () => {
    const client = new AssistantClient('ws://never-connect.invalid', { contextProvider: () => ({ activeDiagramType: 'ClassDiagram' }) });
    expect('traceDigest' in (client as any).buildUserPayload('hi', 'ClassDiagram').context && (client as any).buildUserPayload('hi', 'ClassDiagram').context.traceDigest).toBeFalsy();
    const withOverride = (client as any).buildUserPayload('hi', 'ClassDiagram', { traceDigest: digest });
    expect(withOverride.context.traceDigest).toEqual(digest);
    expect(JSON.stringify((client as any).buildUserPayload('hi', 'ClassDiagram'))).not.toContain('traceDigest');
  });

  it('includes it in the voice context too, asked for without a message', () => {
    const provider = vi.fn(() => ({ activeDiagramType: 'ClassDiagram', traceDigest: digest }));
    const client = new AssistantClient('ws://never-connect.invalid', { contextProvider: provider });
    const payload = (client as any).buildVoicePayload('AAAA', 'audio/webm', 'ClassDiagram');
    expect(provider).toHaveBeenCalledWith();
    expect(payload.context.traceDigest).toEqual(digest);
  });
});

describe('AssistantClient sends whether the project records traces', () => {
  it('keeps traceabilityEnabled through the context whitelist, off as well as on', () => {
    // The agent extracts a request's requirements only for a recording project; a dropped flag reads as off.
    for (const enabled of [true, false]) {
      const client = new AssistantClient('ws://never-connect.invalid', {
        contextProvider: () => ({ activeDiagramType: 'ClassDiagram', traceabilityEnabled: enabled }),
      });
      expect((client as any).buildUserPayload('a library', 'ClassDiagram').context.traceabilityEnabled).toBe(enabled);
    }
  });
});

describe('show_trace', () => {
  it('is a known action and not a side effect', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    const payload = { action: 'show_trace', view: 'lineage', artifactId: 'book', message: 'Open the lineage of Book' };
    expect((client as any).extractActionPayload(payload)).toMatchObject({ action: 'show_trace', view: 'lineage' });
    const source = readFileSync(resolve(__dirname, '..', 'AssistantClient.ts'), 'utf-8');
    expect(source.match(/SIDE_EFFECT_ACTIONS = new Set\(\[[\s\S]*?\]\)/)![0]).not.toContain('show_trace');
    expect(source).toMatch(/KNOWN_ACTIONS = new Set\(\[[\s\S]*?'show_trace'[\s\S]*?\]\)/);
  });
});
