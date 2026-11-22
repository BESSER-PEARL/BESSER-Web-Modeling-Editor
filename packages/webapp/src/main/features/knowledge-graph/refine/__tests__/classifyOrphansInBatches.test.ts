import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  classifyOrphansWithLlm: vi.fn(),
  getKgConfig: vi.fn(),
}));
vi.mock('../../../../shared/api/knowledgeGraph', () => api);

import type { KgIssue, KgPreflightReport } from '../../../../shared/api/knowledgeGraph';
import {
  classifyOrphansInBatches,
  InvalidOrphanReportError,
  mergeOrphanReports,
} from '../classifyOrphansInBatches';

const diagram = {
  id: 'd1',
  title: 'People',
  model: { type: 'KnowledgeGraphDiagram' as const, version: '1.0.0', nodes: [], edges: [] },
};
const credentials = { provider: 'anthropic', apiKey: 'sk-key' } as const;

const issue = (id: string, nodeId: string): KgIssue => ({
  id,
  code: 'ORPHAN_NODE_NO_CLASS_LINK',
  description: '',
  affectedNodeIds: [nodeId],
  affectedEdgeIds: [],
  recommendedAction: null,
  skipAction: null,
});
const report = (issues: KgIssue[], kgSignature = 'sig'): KgPreflightReport => ({
  kgSignature,
  diagramType: 'OrphanClassification',
  issueCount: issues.length,
  issues,
});

const request = (nodeIds: string[], extra: object = {}) => ({
  diagram,
  credentials,
  nodeIds,
  kgSignature: 'sig',
  ...extra,
});

/** The node ids of every request sent so far. */
const sentBatches = () => api.classifyOrphansWithLlm.mock.calls.map((c) => c[0].nodeIds);

beforeEach(() => {
  api.classifyOrphansWithLlm.mockReset();
  api.getKgConfig.mockReset().mockResolvedValue({ llmRequestTimeoutSeconds: 200, maxOrphanClassifyNodes: 2 });
});

describe('classifyOrphansInBatches', () => {
  it('sends batches of maxOrphanClassifyNodes, one after the other, and merges the reports', async () => {
    api.classifyOrphansWithLlm
      .mockResolvedValueOnce(report([issue('i1', 'n1'), issue('i2', 'n2')]))
      .mockResolvedValueOnce(report([issue('i3', 'n3'), issue('i4', 'n4')]))
      .mockResolvedValueOnce(report([issue('i5', 'n5')]));
    const progress: Array<{ done: number; total: number }> = [];

    const merged = await classifyOrphansInBatches(
      request(['n1', 'n2', 'n3', 'n4', 'n5', 'n1'], { onProgress: (p: { done: number; total: number }) => progress.push(p) }),
    );

    expect(sentBatches()).toEqual([['n1', 'n2'], ['n3', 'n4'], ['n5']]);
    for (const [sent] of api.classifyOrphansWithLlm.mock.calls) {
      expect(sent).toMatchObject({ diagram, credentials, kgSignature: 'sig' });
      expect(sent).not.toHaveProperty('onProgress');
    }
    expect(merged).toEqual(report(['i1', 'i2', 'i3', 'i4', 'i5'].map((id, i) => issue(id, `n${i + 1}`))));
    expect(progress).toEqual([
      { done: 0, total: 3 },
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ]);
  });

  it('fails the whole classification when one batch fails, and sends no batch after it', async () => {
    api.classifyOrphansWithLlm.mockResolvedValueOnce(report([issue('i1', 'n1')])).mockRejectedValueOnce(new Error('502'));

    await expect(classifyOrphansInBatches(request(['n1', 'n2', 'n3', 'n4', 'n5']))).rejects.toThrow('502');
    expect(sentBatches()).toEqual([['n1', 'n2'], ['n3', 'n4']]);
  });

  it('rejects a malformed answer instead of passing it on', async () => {
    api.classifyOrphansWithLlm.mockResolvedValueOnce(report([issue('i1', 'n1')])).mockResolvedValueOnce({ detail: 'x' });

    await expect(classifyOrphansInBatches(request(['n1', 'n2', 'n3']))).rejects.toBeInstanceOf(InvalidOrphanReportError);
  });

  it('stops after the running batch when the signal aborts, and rejects with its reason', async () => {
    const controller = new AbortController();
    api.classifyOrphansWithLlm.mockImplementationOnce(async () => {
      controller.abort();
      return report([issue('i1', 'n1')]);
    });

    const error = (await classifyOrphansInBatches(request(['n1', 'n2', 'n3', 'n4'], { signal: controller.signal })).catch(
      (e: unknown) => e,
    )) as Error;

    expect(error.name).toBe('AbortError');
    expect(sentBatches()).toEqual([['n1', 'n2']]);
    expect(api.classifyOrphansWithLlm.mock.calls[0][0].signal).toBe(controller.signal);
  });
});

describe('mergeOrphanReports', () => {
  it('keeps an issue id once', () => {
    expect(mergeOrphanReports([report([issue('a', 'n1')]), report([issue('a', 'n1'), issue('b', 'n2')])])).toEqual(
      report([issue('a', 'n1'), issue('b', 'n2')]),
    );
  });
});
