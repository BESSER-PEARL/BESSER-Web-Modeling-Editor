Storage
=======

Diagram persistence is abstracted behind ``DiagramStorageService`` with swappable
adapters for filesystem and Redis backends. The ``DiagramStorageFactory`` selects
the appropriate implementation based on environment variables.

Filesystem storage
------------------

Implementation: ``DiagramFileStorageService`` (:file:`packages/server/src/main/services/diagram-storage/diagram-file-storage-service.ts`)

* Persists JSON blobs to ``diagrams/<token>.json``.
* Uses ``DiagramStorageRateLimiter`` to debounce save operations and batch patch
  requests. Configurable intervals ensure data is flushed at least every
  3 seconds.
* Requires the ``diagrams`` directory to exist and be writable by the server
  process.

Redis storage
-------------

Implementation: ``DiagramRedisStorageService`` (:file:`packages/server/src/main/services/diagram-storage/diagram-redis-storage-service.ts`)

* Stores diagrams using RedisJSON at keys ``apollon_diagram:<token>``.
* Supports TTL via ``APOLLON_REDIS_DIAGRAM_TTL`` using the ``ms`` package.
* Debounces save operations for high-frequency collaboration scenarios (interval
  100 ms).
* Lazily connects to Redis using ``createClient`` and caches the connection.

Migration support
-----------------

``MigratingStorageService`` composes two storage adapters. When
``APOLLON_REDIS_MIGRATE_FROM_FILE`` is set, it reads diagrams from disk on first
access and writes them to Redis. Use this during one-time migrations.

Rate limiting internals
-----------------------

``DiagramStorageRateLimiter`` groups operations per diagram token to avoid race
conditions. It supports:

* Debouncing multiple requests within ``SAVE_DEBOUNCE_TIME``.
* Maximum save interval ``SAVE_INTERVAL`` to guarantee eventual persistence.
* Group TTL ``SAVE_GROUP_TTL`` after which idle tokens are released.

Error handling
--------------

* File storage throws if a non-shared token already exists during creation.
* Redis storage logs failures to load or save diagrams. Check server logs for
  connectivity issues.
* All adapters return promises, allowing ``DiagramService`` to surface meaningful
  HTTP responses.

Backups and retention
---------------------

* For filesystem storage, schedule regular backups of the ``diagrams`` directory
  and prune outdated files manually or via cron (see
  :doc:`background-jobs`).
* For Redis, use built-in persistence (AOF/RDB) or managed snapshots depending on
  your hosting provider.

Next steps
----------

Read :doc:`collaboration-services` to understand how storage interacts with
WebSocket sessions.
