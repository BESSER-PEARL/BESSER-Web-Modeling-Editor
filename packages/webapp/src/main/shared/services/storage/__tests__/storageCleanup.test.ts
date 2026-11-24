import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectStorageRepository } from '../ProjectStorageRepository';
import { deleteStoredProjects, listStoredProjects } from '../storageCleanup';
import {
  STORAGE_QUOTA_WARNING_EVENT,
  checkLocalStorageQuota,
  getLocalStorageUsageBytes,
} from '../localStorageQuota';
import { writeStoredConversation, readStoredConversation } from '../assistantStorage';
import { createDefaultProject, type BesserProject } from '../../../types/project';
import { localStorageLatestProject, localStorageProjectPrefix, localStorageProjectsList } from '../../../constants/constant';

function save(name: string, editedAt: string, padding = 0): BesserProject {
  const project = createDefaultProject(name, 'x'.repeat(padding), 'me');
  project.createdAt = '2020-01-01T00:00:00.000Z';
  for (const diagrams of Object.values(project.diagrams)) {
    for (const diagram of diagrams) diagram.lastUpdate = editedAt;
  }
  ProjectStorageRepository.saveProject(project);
  return project;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('listStoredProjects', () => {
  it('lists every saved project, least recently edited first, with its size and last edit', () => {
    // Saved last, so it is also the project the next load opens.
    const old = save('Old', '2021-03-01T00:00:00.000Z', 5000);
    const middle = save('Middle', '2022-01-01T00:00:00.000Z');
    const recent = save('Recent', '2024-06-01T00:00:00.000Z');

    const listed = listStoredProjects(recent.id);

    expect(listed.map((p) => p.name)).toEqual(['Old', 'Middle', 'Recent']);
    expect(listed[0].lastModified).toBe('2021-03-01T00:00:00.000Z');
    const key = `${localStorageProjectPrefix}${old.id}`;
    expect(listed[0].sizeBytes).toBe((key.length + localStorage.getItem(key)!.length) * 2);
    expect(listed[0].sizeBytes).toBeGreaterThan(listed[1].sizeBytes);
    expect(listed.find((p) => p.id === middle.id)?.isProtected).toBe(false);
  });

  it('marks the open project and the one the next load opens as protected', () => {
    const open = save('Open', '2021-01-01T00:00:00.000Z');
    const latest = save('Latest', '2021-01-01T00:00:00.000Z');
    const other = save('Other', '2021-01-01T00:00:00.000Z');
    localStorage.setItem(localStorageLatestProject, latest.id);

    const byId = new Map(listStoredProjects(open.id).map((p) => [p.id, p]));
    expect(byId.get(open.id)?.isProtected).toBe(true);
    expect(byId.get(latest.id)?.isProtected).toBe(true);
    expect(byId.get(other.id)?.isProtected).toBe(false);
  });

  it('falls back to the creation date when no diagram has a valid edit time', () => {
    const project = createDefaultProject('Fresh', '', 'me');
    project.createdAt = '2023-05-05T00:00:00.000Z';
    for (const diagrams of Object.values(project.diagrams)) {
      for (const diagram of diagrams) diagram.lastUpdate = '';
    }
    ProjectStorageRepository.saveProject(project);
    expect(listStoredProjects(null)[0].lastModified).toBe('2023-05-05T00:00:00.000Z');
  });
});

describe('deleteStoredProjects', () => {
  it('deletes the picked projects, frees their keys and reports the space freed', () => {
    const a = save('A', '2021-01-01T00:00:00.000Z', 2000);
    const b = save('B', '2021-02-01T00:00:00.000Z');
    const keep = save('Keep', '2024-01-01T00:00:00.000Z');
    writeStoredConversation(a.id, '{"messages":[]}');
    const before = getLocalStorageUsageBytes();

    const result = deleteStoredProjects([a.id, b.id], keep.id);

    expect(result.deleted).toEqual([a.id, b.id]);
    expect(result.skipped).toEqual([]);
    expect(localStorage.getItem(`${localStorageProjectPrefix}${a.id}`)).toBeNull();
    expect(localStorage.getItem(`${localStorageProjectPrefix}${b.id}`)).toBeNull();
    expect(JSON.parse(localStorage.getItem(localStorageProjectsList)!)).toEqual([keep.id]);
    expect(readStoredConversation(a.id)).toBeNull();
    expect(result.freedBytes).toBe(before - getLocalStorageUsageBytes());
    expect(result.freedBytes).toBeGreaterThan(4000);
    expect(ProjectStorageRepository.loadProject(keep.id)?.name).toBe('Keep');
  });

  it('never deletes the open project, even when asked to', () => {
    const other = save('Other', '2021-01-01T00:00:00.000Z');
    const open = save('Open', '2021-01-01T00:00:00.000Z');
    const deleteSpy = vi.spyOn(ProjectStorageRepository, 'deleteProject');

    const result = deleteStoredProjects([open.id, other.id], open.id);

    expect(result.deleted).toEqual([other.id]);
    expect(result.skipped).toEqual([open.id]);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(other.id);
    expect(ProjectStorageRepository.loadProject(open.id)).not.toBeNull();
  });

  it('protects the last opened project when no project is open', () => {
    const first = save('First', '2021-01-01T00:00:00.000Z');
    const last = save('Last', '2021-01-01T00:00:00.000Z');

    const result = deleteStoredProjects([first.id, last.id], null);

    expect(result.deleted).toEqual([first.id]);
    expect(result.skipped).toEqual([last.id]);
    expect(localStorage.getItem(localStorageLatestProject)).toBe(last.id);
  });

  it('skips ids that are not stored projects', () => {
    const open = save('Open', '2021-01-01T00:00:00.000Z');
    const result = deleteStoredProjects(['missing'], open.id);
    expect(result).toEqual({ deleted: [], skipped: ['missing'], freedBytes: 0 });
  });
});

describe('checkLocalStorageQuota', () => {
  it('announces the warning with the usage once storage passes 4 MB', () => {
    const listener = vi.fn();
    window.addEventListener(STORAGE_QUOTA_WARNING_EVENT, listener);
    try {
      checkLocalStorageQuota();
      expect(listener).not.toHaveBeenCalled();

      localStorage.setItem('besser_big', 'x'.repeat(2.2 * 1024 * 1024));
      checkLocalStorageQuota();
      expect(listener).toHaveBeenCalledTimes(1);
      const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.usageBytes).toBeGreaterThanOrEqual(4 * 1024 * 1024);
      expect(detail.limitBytes).toBe(5 * 1024 * 1024);

      // Rate-limited: a second save right after does not repeat it.
      checkLocalStorageQuota();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(STORAGE_QUOTA_WARNING_EVENT, listener);
    }
  });
});
