import type { TraceFile } from '../types/traceability';

/**
 * Where project traces are kept: the browser's IndexedDB, which allows far more than the ~5 MB of
 * `localStorage` (a share of the free disk) and is written asynchronously, so saving a large trace
 * does not block the page. Traces are stored as objects, one per project, keyed by project id.
 */
export interface TraceStorage {
  /** The stored trace of a project, as stored (not yet checked or migrated), or undefined. */
  read(projectId: string): Promise<unknown>;
  write(projectId: string, trace: TraceFile): Promise<void>;
  remove(projectId: string): Promise<void>;
}

const DATABASE = 'besser_traces';
const STORE = 'traces';
const VERSION = 1;

export function indexedDbTraceStorage(factory: IDBFactory = indexedDB): TraceStorage {
  let database: Promise<IDBDatabase> | null = null;
  const open = () =>
    (database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DATABASE, VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = null; // the next call tries again
        reject(request.error);
      };
    }));

  const run = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(STORE, mode);
          const request = operation(transaction.objectStore(STORE));
          transaction.oncomplete = () => resolve(request.result);
          transaction.onerror = transaction.onabort = () => reject(transaction.error ?? request.error);
        }),
    );

  return {
    read: (projectId) => run('readonly', (store) => store.get(projectId)),
    write: (projectId, trace) => run('readwrite', (store) => store.put(trace, projectId)).then(() => undefined),
    remove: (projectId) => run('readwrite', (store) => store.delete(projectId)).then(() => undefined),
  };
}

/** Traces kept in memory only: for tests, and for a browser without IndexedDB (nothing survives a reload). */
export function memoryTraceStorage(): TraceStorage {
  const traces = new Map<string, TraceFile>();
  return {
    read: async (projectId) => (traces.has(projectId) ? structuredClone(traces.get(projectId)) : undefined),
    write: async (projectId, trace) => {
      traces.set(projectId, structuredClone(trace));
    },
    remove: async (projectId) => {
      traces.delete(projectId);
    },
  };
}
