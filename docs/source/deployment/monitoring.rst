Monitoring
==========

Reliable deployments require monitoring across infrastructure, application, and
user experience layers.

Logs
----

* Capture container logs with ``docker logs`` or systemd's ``journalctl``.
* Forward logs to aggregators (ELK, Loki) and index on token, request path, and
  error type.

Metrics
-------

* Expose Node.js metrics via Prometheus exporters or integrate with cloud
  monitoring agents.
* Track request latency, error rate, WebSocket connections, and Redis command
  timings.
* Monitor disk usage of the ``diagrams`` directory or Redis memory footprint.

Tracing
-------

* Configure Sentry or OpenTelemetry to trace API requests and background jobs.
* Sample WebSocket message flows to identify bottlenecks during collaborative
  sessions.

User experience
---------------

* Use PostHog dashboards to measure session counts, export frequency, and share
  link usage.
* Collect user feedback via the built-in share modes and triage it alongside
  telemetry data.

Alerting
--------

* Define alerts for high error rates, CPU spikes, or storage exhaustion.
* Route alerts to on-call channels (email, Slack, PagerDuty) with runbook links.

Synthetic checks
----------------

* Schedule health checks that load the editor, create a diagram, and publish a
  share link to validate end-to-end functionality.
* Use automated tests to exercise PDF export and Redis-backed persistence.

Next steps
----------

Move on to the :doc:`../development/index` section for contributor workflows.
