/**
 * Freeing localStorage by deleting saved projects (the storage-full warning's
 * "Free up space" dialog). Deletion goes through
 * `ProjectStorageRepository.deleteProject`, so a project's side keys (GitHub
 * links, assistant chat, run records, trace) go with it. The project that is
 * open, or that the next page load would open, is never deleted.
 */
import { ALL_DIAGRAM_TYPES, BesserProject } from '../../types/project';
import { localStorageProjectPrefix } from '../../constants/constant';
import { ProjectStorageRepository } from './ProjectStorageRepository';
import { getLocalStorageUsageBytes } from './localStorageQuota';

export interface StoredProjectSummary {
  id: string;
  name: string;
  /** Bytes the project's own entry takes in localStorage (UTF-16). */
  sizeBytes: number;
  /** ISO date of the latest diagram edit, else the creation date. */
  lastModified: string;
  /** The open project (or the one the next load opens): never deletable here. */
  isProtected: boolean;
}

export interface StorageCleanupResult {
  deleted: string[];
  /** Ids that were asked for but kept: protected, or no longer stored. */
  skipped: string[];
  freedBytes: number;
}

function protectedIds(currentProjectId: string | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (currentProjectId) ids.add(currentProjectId);
  const latest = ProjectStorageRepository.getLatestProjectId();
  if (latest) ids.add(latest);
  return ids;
}

function storedSizeBytes(projectId: string): number {
  const key = `${localStorageProjectPrefix}${projectId}`;
  const value = localStorage.getItem(key);
  return value === null ? 0 : (key.length + value.length) * 2;
}

function lastModifiedOf(project: BesserProject): string {
  let latest = project.createdAt;
  let latestTime = new Date(latest).getTime() || 0;
  for (const type of ALL_DIAGRAM_TYPES) {
    for (const diagram of project.diagrams[type] ?? []) {
      const time = new Date(diagram.lastUpdate).getTime();
      if (time > latestTime) {
        latestTime = time;
        latest = diagram.lastUpdate;
      }
    }
  }
  return latest;
}

/** Every saved project, least recently modified first. */
export function listStoredProjects(currentProjectId?: string | null): StoredProjectSummary[] {
  const keep = protectedIds(currentProjectId);
  const summaries: StoredProjectSummary[] = [];
  for (const { id } of ProjectStorageRepository.getAllProjects()) {
    const project = ProjectStorageRepository.loadProject(id);
    if (!project) continue;
    summaries.push({
      id,
      name: project.name,
      sizeBytes: storedSizeBytes(id),
      lastModified: lastModifiedOf(project),
      isProtected: keep.has(id),
    });
  }
  return summaries.sort((a, b) => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime());
}

/**
 * Delete the given projects, skipping the protected one. Callers must have had
 * the user confirm the list first.
 */
export function deleteStoredProjects(
  projectIds: string[],
  currentProjectId?: string | null,
): StorageCleanupResult {
  const keep = protectedIds(currentProjectId);
  const stored = new Set(ProjectStorageRepository.getAllProjects().map((p) => p.id));
  const before = getLocalStorageUsageBytes();
  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const id of new Set(projectIds)) {
    if (keep.has(id) || !stored.has(id)) {
      skipped.push(id);
      continue;
    }
    ProjectStorageRepository.deleteProject(id);
    deleted.push(id);
  }
  return { deleted, skipped, freedBytes: Math.max(0, before - getLocalStorageUsageBytes()) };
}
