import type { TraceFile } from '../types/traceability';

/**
 * Where project traces are kept: the browser's IndexedDB, which allows far more than the ~5 MB of
 * `localStorage` (a share of the free disk) and is written asynchronously, so saving a large trace
 * does not block the page. Traces are stored as objects, one per project, keyed by project id.
 *
 * Several tabs may have the same project open, each with the trace in memory: every stored trace carries a
 * revision ({@link STORE_REVISION_FIELD}, counted up by each write), and a write that names the revision it was
 * made from is refused with a {@link TraceRevisionConflict} when another tab wrote in between, so the writer
 * re-reads the stored trace and applies its own changes on top of it instead of overwriting the other tab's.
 */
export interface TraceStorage {
  /** The stored trace of a project, as stored (not yet checked or migrated, with its revision field), or undefined. */
  read(projectId: string): Promise<unknown>;
  /**
   * Store `trace` (or what `trace()` returns when the write happens) and resolve to its new revision. With
   * `expectedRevision`, the write is made only when the stored revision is still that one (0: nothing stored or
   * stored without a revision); otherwise it rejects with a {@link TraceRevisionConflict} and nothing is written.
   */
  write(projectId: string, trace: TraceFile | (() => TraceFile), expectedRevision?: number): Promise<number>;
  remove(projectId: string): Promise<void>;
}

/** The field of a stored trace holding its revision: storage bookkeeping, not part of the trace file format. */
export const STORE_REVISION_FIELD = 'storeRevision';

/** The revision of a stored trace (0 for one stored before revisions, or none). */
export function storedRevisionOf(stored: unknown): number {
  const value = stored && typeof stored === 'object' ? (stored as Record<string, unknown>)[STORE_REVISION_FIELD] : undefined;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** A stored trace as a trace file: without the storage's revision field. */
export function withoutStoreRevision(stored: unknown): unknown {
  if (!stored || typeof stored !== 'object' || !(STORE_REVISION_FIELD in stored)) return stored;
  const trace = { ...(stored as Record<string, unknown>) };
  delete trace[STORE_REVISION_FIELD];
  return trace;
}

/** A write refused because another tab stored the trace since it was read. */
export class TraceRevisionConflict extends Error {
  constructor(readonly projectId: string, readonly expected: number, readonly found: number) {
    super(`The trace of project ${projectId} was saved elsewhere (revision ${found}, expected ${expected}).`);
    this.name = 'TraceRevisionConflict';
  }
}

/** Whether `error` is a {@link TraceRevisionConflict} (by name: it may come from another copy of this module). */
export const isRevisionConflict = (error: unknown): error is TraceRevisionConflict =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'TraceRevisionConflict';

const DATABASE = 'besser_traces';
const STORE = 'traces';
const VERSION = 1;

const traceOf = (trace: TraceFile | (() => TraceFile)): TraceFile => (typeof trace === 'function' ? trace() : trace);

export function indexedDbTraceStorage(factory: IDBFactory = indexedDB): TraceStorage {
  let database: Promise<IDBDatabase> | null = null;
  const open = () =>
    (database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DATABASE, VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading the database, or the browser closing the connection (storage cleared, disk
        // trouble): the next call opens a new connection instead of failing on this one.
        db.onversionchange = () => {
          db.close();
          database = null;
        };
        db.onclose = () => {
          database = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        database = null; // the next call tries again
        reject(request.error);
      };
    }));

  const run = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, fail: (error: Error) => void) => IDBRequest<T> | void, result: () => T): Promise<T> =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          let failure: Error | null = null;
          let transaction: IDBTransaction;
          try {
            transaction = db.transaction(STORE, mode);
          } catch (error) {
            database = null; // a closed connection: open a new one next time
            reject(error);
            return;
          }
          operation(transaction.objectStore(STORE), (error) => {
            failure = error;
            transaction.abort();
          });
          transaction.oncomplete = () => resolve(result());
          // A failed request (a put over the quota) reaches `onerror` before the transaction has its error:
          // take the request's, so the caller can tell a full storage from other failures.
          transaction.onerror = transaction.onabort = (event) =>
            reject(
              failure ??
                transaction.error ??
                (event.target as IDBRequest | null)?.error ??
                new DOMException('The trace storage transaction failed.', 'AbortError'),
            );
        }),
    );

  return {
    read: (projectId) => {
      let request: IDBRequest | undefined;
      return run('readonly', (store) => (request = store.get(projectId)), () => request?.result);
    },
    write: (projectId, trace, expectedRevision) => {
      let revision = 0;
      return run(
        'readwrite',
        (store, fail) => {
          // Read and write in one transaction, so no other tab writes in between.
          const current = store.get(projectId);
          current.onsuccess = () => {
            const found = storedRevisionOf(current.result);
            if (expectedRevision !== undefined && found !== expectedRevision) {
              fail(new TraceRevisionConflict(projectId, expectedRevision, found));
              return;
            }
            revision = found + 1;
            store.put({ ...traceOf(trace), [STORE_REVISION_FIELD]: revision }, projectId);
          };
        },
        () => revision,
      );
    },
    remove: (projectId) => run('readwrite', (store) => store.delete(projectId), () => undefined),
  };
}

/** Traces kept in memory only: for tests, and for a browser without IndexedDB (nothing survives a reload). */
export function memoryTraceStorage(): TraceStorage {
  const traces = new Map<string, unknown>();
  return {
    read: async (projectId) => (traces.has(projectId) ? structuredClone(traces.get(projectId)) : undefined),
    write: async (projectId, trace, expectedRevision) => {
      const found = storedRevisionOf(traces.get(projectId));
      if (expectedRevision !== undefined && found !== expectedRevision) throw new TraceRevisionConflict(projectId, expectedRevision, found);
      traces.set(projectId, structuredClone({ ...traceOf(trace), [STORE_REVISION_FIELD]: found + 1 }));
      return found + 1;
    },
    remove: async (projectId) => {
      traces.delete(projectId);
    },
  };
}
