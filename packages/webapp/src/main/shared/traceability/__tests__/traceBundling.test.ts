import { beforeEach, describe, expect, it } from 'vitest';
import { getProjectTrace, importProjectTrace, replaceProjectTrace } from '../traceStore';
import { buildProjectExportEnvelope, buildProjectPayloadForBackend } from '../../utils/projectExportUtils';
import { emptyTraceFile } from '../../types/traceability';
import type { BesserProject } from '../../types/project';

const project = { id: 'p1', name: 'Library', diagrams: {}, currentDiagramIndices: {} } as unknown as BesserProject;

const recorded = () => ({
  ...emptyTraceFile('p1'),
  actors: [{ id: 'a1', type: 'Person' as const, name: 'Ada', timestamp: '2026-10-29T10:00:00.000Z' }],
});

describe('project trace in project exports', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceProjectTrace('p1', recorded());
  });

  it('is bundled only when asked for', () => {
    expect(buildProjectExportEnvelope(project).trace).toBeUndefined();
    expect(buildProjectExportEnvelope(project, undefined, { includeTrace: true }).trace).toEqual(recorded());
    expect(buildProjectPayloadForBackend(project).trace).toBeUndefined();
    expect(buildProjectPayloadForBackend(project, undefined, { includeTrace: true }).trace).toEqual(recorded());
  });

  it('is stored under the id of the imported project', () => {
    expect(importProjectTrace('p2', recorded())).toBe(true);
    expect(getProjectTrace('p2')).toEqual({ ...recorded(), projectId: 'p2' });
  });

  it('is left out when unusable', () => {
    expect(importProjectTrace('p3', { ...recorded(), schemaVersion: 99 })).toBe(false);
    expect(getProjectTrace('p3').actors).toEqual([]);
  });
});
