const STORAGE_VERSION_KEY = 'besser_storage_version';
const CURRENT_VERSION = 1;

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
  // Global localStorage structure migrations run once on startup.
  // Per-project schema migrations (v1->v2->v3) live in types/project.ts.
  //
  // Example: { version: 2, migrate: () => { /* rename old keys, clean up orphans */ } },
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
