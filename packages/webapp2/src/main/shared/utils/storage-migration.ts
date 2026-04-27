import { LocalStorageRepository } from '../services/storage/local-storage-repository';

const STORAGE_VERSION_KEY = 'besser_storage_version';
const CURRENT_VERSION = 3;

interface Migration {
  version: number;
  migrate: () => void;
}

/**
 * ── Migration architecture ───────────────────────────────────────────────
 *
 * There are TWO separate migration systems in this codebase:
 *
 * 1. **Per-project schema migrations** (types/project.ts)
 *    - `migrateProjectToV2` — converts single-diagram-per-type to arrays.
 *    - `migrateReferencesToIds` — converts index-based cross-references to
 *      stable UUID-based references.
 *    - Orchestrated by `ensureProjectMigrated()`, which is called every time
 *      a project is loaded from localStorage (lazy, per-project).
 *    - Version tracked per project via `BesserProject.schemaVersion`.
 *
 * 2. **Global localStorage structure migrations** (this file)
 *    - Runs once on application startup via `runStorageMigrations()`.
 *    - Intended for renaming/removing top-level localStorage keys, cleaning
 *      up orphaned data, or restructuring global (non-project) entries.
 *    - Version tracked globally via the `besser_storage_version` key.
 *
 * When adding a new migration, decide which system it belongs to:
 * - Changing the shape of a BesserProject? -> types/project.ts
 * - Changing global localStorage keys or cleaning up legacy data? -> here
 */
const migrations: Migration[] = [
  // v2: Clear incompatible data left by the legacy Apollon-based webapp (pre-v7).
  // The old webapp stored diagrams under besser_diagram_*, besser_diagrams, besser_latest,
  // and other keys whose data structures are incompatible with webapp2's project-based
  // storage. Users upgrading see "Something went wrong" until they clear localStorage.
  {
    version: 2,
    migrate: () => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('besser_diagram_')) {
          keysToRemove.push(key);
        }
      }
      // Old webapp top-level keys
      keysToRemove.push(
        'besser_diagrams',
        'besser_latest',
        'besser_collaborationName',
        'besser_collaborationColor',
        // Legacy non-prefixed keys
        'latestDiagram',
        'agentConfig',
        'agentPersonalization',
        'github_session',
        'github_username',
        'last_published_token',
        'last_published_type',
        'umlAgentRateLimiterState',
      );
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      console.info('[storage-migration] v2: Cleared legacy webapp data');
    },
  },
  // v3: Seed `besser_systemConfig` so existing v2 users get the new system-config
  // surface (default LLM model, intent-recognition technology, …) on next launch
  // instead of the missing-key fallbacks that were defaulting to `gpt-5` (which is
  // not a real OpenAI model id; the v7.3.0 release flips the default to `gpt-5.5`).
  // Idempotent: skips if `besser_systemConfig` is already present.
  {
    version: 3,
    migrate: () => {
      LocalStorageRepository.migrateToV3();
      console.info('[storage-migration] v3: Seeded besser_systemConfig with defaults');
    },
  },
];

export function runStorageMigrations(): void {
  const current = parseInt(localStorage.getItem(STORAGE_VERSION_KEY) || '0');
  for (const m of migrations) {
    if (m.version > current) {
      try {
        m.migrate();
      } catch (error) {
        console.error(`[storage-migration] Migration v${m.version} failed:`, error);
      }
    }
  }
  localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
}
