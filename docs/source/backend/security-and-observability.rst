Security and observability
==========================

Harden the collaboration server and capture actionable telemetry to keep the
service reliable.

Security controls
-----------------

Authentication
    Deploy behind an authentication proxy or add middleware to
    :file:`packages/server/src/main/routes.ts` to check session tokens before
    accessing APIs.
TLS termination
    Terminate TLS at a reverse proxy (nginx, Traefik) and forward traffic to the
    Node.js server via HTTP. Update ``DEPLOYMENT_URL`` to use ``https`` so the
    webapp generates secure WebSocket URLs.
Token management
    Share tokens are 20-character random strings generated via ``randomString``
    (see :file:`packages/server/src/main/utils.ts`). Rotate ``tokenLength`` if
    your policies require shorter/longer identifiers.
Input validation
    ``DiagramResource`` verifies token format (alphanumeric). Extend validation to
    enforce payload size limits or schema compliance.
Rate limiting
    Introduce middleware such as ``express-rate-limit`` to control API abuse.

Observability
-------------

Logging
    Use a structured logger (pino, Winston) to capture request metadata. By
    default, the server logs to stdout.
Metrics
    Export metrics via Prometheus or StatsD when running in container platforms.
    Capture request counts, latency, and storage adapter performance.
Tracing
    Enable Sentry traces by configuring ``SENTRY_DSN`` and adjusting the sample
    rate in ``server.ts``.
Error reporting
    ``SENTRY_DSN`` initialises server-side error reporting. Combine with client
    instrumentation via PostHog for end-to-end visibility.

Operational runbooks
--------------------

* Document recovery procedures for Redis outages (fail over, warm caches).
* Keep the ``diagrams`` directory on resilient storage (EBS, NFS) when using the
  filesystem adapter.
* Monitor disk usage and prune stale diagrams using the cron job documented in
  :doc:`background-jobs`.

Next steps
----------

Read :doc:`background-jobs` to automate maintenance tasks.
