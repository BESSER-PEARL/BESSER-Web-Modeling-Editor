import { LocalStorageRepository } from '../services/storage/local-storage-repository';

const STORAGE_VERSION_KEY = 'besser_storage_version';
const CURRENT_VERSION = 5;

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
  // v2: Clear incompatible data left by the legacy webapp (pre-v7).
  // The old webapp stored diagrams under besser_diagram_*, besser_diagrams, besser_latest,
  // and other keys whose data structures are incompatible with the current project-based
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
  // v3: Deletes the deprecated `besser_systemConfig` top-level key — agent
  // runtime config now lives on the agent diagram itself
  // (`AgentDiagram.config`) with hardcoded defaults at agent-creation time.
  // The previous global-default-vs-per-agent split caused the v7.3.0
  // stuck-`gpt-5` migration mess; collapsing to a single source of truth
  // eliminates that class of bug. Idempotent: no-op when the key is absent.
  {
    version: 3,
    migrate: () => {
      LocalStorageRepository.migrateToV3();
      console.info('[storage-migration] v3: Removed deprecated besser_systemConfig key');
    },
  },
  // v4: Production (the old-editor app) already shipped a step 4 that
  // normalized agent base models to the nested transition shape; installs
  // coming from it have `besser_storage_version = 4` recorded and will NOT
  // run this entry again. Kept for installs below 4 (it performs a superset
  // of production's step: the full v4 lift below).
  {
    version: 4,
    migrate: () => {
      LocalStorageRepository.migrateToV4();
      console.info('[storage-migration] v4: Lifted personalization snapshots to the v4 model shape');
    },
  },
  // v5: Lift stored personalization snapshots (`besser_agentBaseModels`,
  // `besser_userProfiles`, `besser_agentConfigs`) to the canonical React
  // Flow v4 model shape (`nodes`/`edges`). Numbered 5 — not 4 — because
  // production already consumed 4 for its own migration, so every real user
  // upgrading from it would skip a step 4. Idempotent: canonical v4
  // snapshots round-trip unchanged and empty stores are a no-op, so it is
  // also safe for installs that already ran this build's step 4 (they run
  // it once more, harmlessly). Readers additionally lift v3 snapshots on
  // read (`LocalStorageRepository`), so nothing stale reaches the backend
  // even if this step failed.
  {
    version: 5,
    migrate: () => {
      LocalStorageRepository.migrateSnapshotsToV4Shape();
      console.info('[storage-migration] v5: Lifted personalization snapshots to the v4 model shape');
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
  // Never downgrade a version recorded by a newer build.
  localStorage.setItem(STORAGE_VERSION_KEY, String(Math.max(current || 0, CURRENT_VERSION)));
}
