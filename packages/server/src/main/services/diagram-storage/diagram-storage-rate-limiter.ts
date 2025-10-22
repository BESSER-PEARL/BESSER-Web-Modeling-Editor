import { Operation } from 'fast-json-patch';
import { DiagramDTO } from 'shared';
import { debounceTime, from, groupBy, mergeMap, Observable, Subject, switchMap } from 'rxjs';
import { auditDebounceTime } from 'audit-debounce';

/**
 * Request for saving or patching a diagram.
 */
export interface DiagramPresistenceRequest {
  token: string;
}

/**
 * Request for saving a diagram.
 */
export interface DiagramSaveRequest extends DiagramPresistenceRequest {
  /**
   * The diagram to save.
   */
  diagramDTO: DiagramDTO;
}

/**
 * Request for patching a diagram.
 */
export interface DiagramPatchRequest extends DiagramPresistenceRequest {
  /**
   * The patch to apply to the diagram, in format of [JSONPatch](https://jsonpatch.com).
   */
  patch: Operation[];
}

export type DiagramStorageRequest = DiagramSaveRequest | DiagramPatchRequest;

/**
 * Determines if the given persistence request is a save request.
 */
export function isDiagramSaveRequest(request: DiagramPresistenceRequest): request is DiagramSaveRequest {
  return (request as DiagramSaveRequest).diagramDTO !== undefined;
}

/**
 * Determines if the given persistence request is a patch request.
 */
export function isDiagramPatchRequest(request: DiagramPresistenceRequest): request is DiagramPatchRequest {
  return (request as DiagramPatchRequest).patch !== undefined;
}

/**
 * Configuration for the diagram storage rate limiter.
 */
export interface DiagramStorageRateLimiterConfig {
  /**
   * The interval at which the diagram should be saved, in milliseconds.
   * When changes happen to the diagram, two save (or patch) operations will be a maximum
   * of `saveInterval` milliseconds apart.
   */
  saveInterval: number;

  /**
   * The time to wait after the last save (or patch) request
   * before storing the diagram. This is to prevent overloading the storage system.
   * Diagrams will however be saved every `saveInterval` milliseconds to ensure
   * data is not lost. This value should be less than `saveInterval`.
   */
  saveDebounceTime: number;

  /**
   * The time to keep a request group alive after the last persistence request
   * for the group. Requests for the same diagram are grouped together. It is recommended to
   * set this at a higher value than `saveInterval`.
   */
  saveGroupTTL: number;
}

/**
 * Denotes a function that can save a diagram. Return an observable when each operation
 * can be cancelled, so that the limiter cancels pending operations before initiating a new one.
 */
export type SaveDiagramFunction<T extends DiagramStorageRequest> = (
  request: T & DiagramSaveRequest,
) => Promise<void> | Observable<void>;

/**
 * Denotes a function that can patch a diagram. Return an observable when each operation
 * can be cancelled, so that the limiter cancels pending operations before initiating a new one.
 */
export type PatchDiagramFunction<T extends DiagramStorageRequest> = (
  request: T & DiagramPatchRequest,
) => Promise<void> | Observable<void>;

/**
 * A rate limiter for saving diagrams. This limiter ensures that persistence requests
 * do not overload the storage system.
 */
export class DiagramStorageRateLimiter<T extends DiagramStorageRequest> {
  //
  // this router handles saving of diagrams.
  // requests for saving diagrams can come at any time, and might
  // need some pacing to avoid overloading the file system (which results in corrupted files.
  //
  private router = new Subject<T>();

  /**
   * @param saveDiagram the function to save a diagram. The function should return an observable
   *                     when the operation can be cancelled, so that the limiter cancels pending
   *                    operations before initiating a new one.
   * @param patchDiagram the function to patch a diagram. The function should return an observable
   *                    when the operation can be cancelled, so that the limiter cancels pending
   *                   operations before initiating a new one.
   * @param config the configuration for the rate limiter, determining the rate at which diagrams are
   *              saved or patched.
   */
  constructor(
    saveDiagram: SaveDiagramFunction<T>,
    patchDiagram: PatchDiagramFunction<T>,
    readonly config: DiagramStorageRateLimiterConfig,
  ) {
    //
    // I do realize complex rxjs pipelines are not the easiest to read.
    // so I will try to explain what is going on here.
    //
    this.router
      .pipe(
        //
        // first, we group requests by token, since we don't want
        // save requests for one token to affect requests of another
        // token on the server (each token relates to a different diagram)
        //
        groupBy((request) => request.token, {
          //
          // this duration selector determines how long the "group" stream
          // should be kept alive. without a duration selector, these "groups"
          // will be kept alive indefinitely, clogging up memory.
          //
          duration: (group) =>
            group.pipe(
              //
              // indicates that each group should be kept alive
              // SAVE_GROUP_TTL milliseconds after the last save request for that
              // group. note that the diagram might still be worked on,
              // but we can create a new group for new save requests if they happen.
              //
              debounceTime(config.saveDebounceTime),
            ),
        }),
        //
        // with `mergeMap()`, we will operate on each "group" independently
        // and then merge the results back into a singular stream.
        //
        mergeMap((group) =>
          group.pipe(
            //
            // this will try to wait for SAVE_DEBOUNCE_TIME milliseconds
            // after each incoming save request before saving the diagram.
            // since that can be too long if save requests are incoming frequently,
            // we will also save the diagram every SAVE_INTERVAL milliseconds to ensure
            // we don't lose data (in case the server process stops, for example due to a crash).
            //
            auditDebounceTime(config.saveDebounceTime, config.saveInterval),
            //
            // since saving is an async operation itself, we need to use `switchMap()`
            // to ensure only a single save operation is running at any given time.
            //
            switchMap((request) => {
              if (isDiagramSaveRequest(request)) {
                return from(saveDiagram(request));
              } else if (isDiagramPatchRequest(request)) {
                return from(patchDiagram(request));
              } else {
                return from(Promise.resolve());
              }
            }),
          ),
        ),
      )
      .subscribe();
  }

  /**
   * Request to save or patch a diagram. The limiter will
   * schedule this operation according to previous and subsequent requests,
   * ensuring that the storage system is not overloaded.
   */
  request(request: T) {
    this.router.next(request);
  }
}
