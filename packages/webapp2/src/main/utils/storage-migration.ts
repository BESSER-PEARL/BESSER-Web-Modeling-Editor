const STORAGE_VERSION_KEY = 'besser_storage_version';
const CURRENT_VERSION = 1;

interface Migration {
  version: number;
  migrate: () => void;
}

const migrations: Migration[] = [
  // Add migrations here as the schema evolves
  // { version: 1, migrate: () => { /* transform old data */ } },
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
