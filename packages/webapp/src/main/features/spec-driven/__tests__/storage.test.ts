import { beforeEach, describe, expect, it } from 'vitest';

import {
  localStorageSpecDrivenActiveRunV1,
  localStorageSpecDrivenActiveRunV2Prefix,
} from '../../../shared/constants/constant';
import {
  clearActiveSpecDrivenRun,
  readActiveSpecDrivenRun,
  writeActiveSpecDrivenRun,
} from '../storage';

describe('active durable run storage', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, String(value));
      },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
  });

  it('keeps independent pointers for concurrent projects', () => {
    const firstRunId = 'a'.repeat(32);
    const secondRunId = 'b'.repeat(32);
    writeActiveSpecDrivenRun({
      runId: firstRunId,
      projectId: 'project-a',
      lastSequence: 3,
      startedAt: 100,
    });
    writeActiveSpecDrivenRun({
      runId: secondRunId,
      projectId: 'project-b',
      lastSequence: 7,
      startedAt: 200,
    });

    expect(readActiveSpecDrivenRun('project-a')?.runId).toBe(firstRunId);
    expect(readActiveSpecDrivenRun('project-b')?.runId).toBe(secondRunId);

    clearActiveSpecDrivenRun(secondRunId);
    expect(readActiveSpecDrivenRun('project-b')).toBeNull();
    expect(readActiveSpecDrivenRun('project-a')?.runId).toBe(firstRunId);
  });

  it('reads a legacy v1 pointer and migrates it on the next write', () => {
    const runId = 'c'.repeat(32);
    window.localStorage.setItem(
      localStorageSpecDrivenActiveRunV1,
      JSON.stringify({
        version: 1,
        runId,
        projectId: 'legacy-project',
        lastSequence: 2,
        startedAt: 100,
      }),
    );

    expect(readActiveSpecDrivenRun('legacy-project')?.runId).toBe(runId);
    writeActiveSpecDrivenRun({
      runId,
      projectId: 'legacy-project',
      lastSequence: 3,
      startedAt: 100,
    });

    expect(window.localStorage.getItem(localStorageSpecDrivenActiveRunV1)).toBeNull();
    expect(
      window.localStorage.getItem(`${localStorageSpecDrivenActiveRunV2Prefix}${runId}`),
    ).not.toBeNull();
    expect(readActiveSpecDrivenRun('legacy-project')?.lastSequence).toBe(3);
  });
});
