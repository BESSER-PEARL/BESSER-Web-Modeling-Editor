import { describe, expect, it } from 'vitest';
import { indexedDbTraceStorage } from '../traceDatabase';
import { emptyTraceFile } from '../../types/traceability';

/**
 * An IndexedDB whose `put` fails over the quota the way browsers report it: the request's error event bubbles to
 * the transaction's `onerror` while `transaction.error` is still null, and the abort that follows carries it.
 */
function fullDatabase(): IDBFactory {
  const later = (fn: () => void) => setTimeout(fn, 0);
  const transaction = () => {
    const tx = { error: null as DOMException | null } as unknown as IDBTransaction & { error: DOMException | null };
    const store = {
      get: () => {
        const request = { result: undefined } as unknown as IDBRequest;
        later(() => request.onsuccess?.call(request, new Event('success')));
        return request;
      },
      put: () => {
        const request = { error: new DOMException('full', 'QuotaExceededError') } as unknown as IDBRequest;
        later(() => {
          tx.onerror?.call(tx, { target: request } as unknown as Event);
          tx.error = request.error;
          tx.onabort?.call(tx, { target: tx } as unknown as Event);
        });
        return request;
      },
    };
    tx.objectStore = () => store as unknown as IDBObjectStore;
    tx.abort = () => undefined;
    return tx;
  };
  return {
    open: () => {
      const request = { result: { transaction } } as unknown as IDBOpenDBRequest;
      later(() => request.onsuccess?.call(request, new Event('success')));
      return request;
    },
  } as unknown as IDBFactory;
}

describe('the IndexedDB trace storage', () => {
  it('rejects a write over the quota with the quota error, not null', async () => {
    // Before: it rejected with the transaction's error, still null when the request's error arrives, so the
    // store's prune-and-retry never saw a QuotaExceededError.
    const storage = indexedDbTraceStorage(fullDatabase());
    await expect(storage.write('p1', emptyTraceFile('p1'))).rejects.toMatchObject({ name: 'QuotaExceededError' });
  });
});
