External integrations
=====================

Several services can be plugged into the webapp to provide analytics, telemetry,
and intelligent assistance.

Analytics
---------

PostHog
    Configure ``POSTHOG_HOST`` and ``POSTHOG_KEY`` to enable event capture.
    ``PostHogProvider`` in :file:`application.tsx` wraps the app when keys are
    provided. Use PostHog dashboards to understand feature adoption.

Error tracking
--------------

Sentry
    Configure ``SENTRY_DSN`` to instrument server-side and optionally client-side
    errors. Pair with ``@sentry/react`` if you plan to extend client telemetry.

Intelligent assistance
----------------------

UML Bot
    ``UMLBotWidget`` connects to ``UML_BOT_WS_URL`` (defaulting to the deployment
    origin). Provide your own WebSocket endpoint to generate diagrams from
    natural language prompts or to offer tutoring features.

Backend APIs
------------

* The webapp communicates with the collaboration server via ``BASE_URL`` derived
  from ``DEPLOYMENT_URL``.
* ``BACKEND_URL`` can point to the BESSER Backend services when running in development.
* Use ``LocalStorageRepository`` and ``ProjectStorageRepository`` to bridge with
  other systems through background sync jobs.

Embedding contexts
------------------

* Integrate the webapp inside other applications via iframes. Provide
  ``DEPLOYMENT_URL`` that matches the host origin to avoid mixed content issues.
* Expose configuration via query parameters or local storage seeds to tailor the
  experience per host application.

Next steps
----------

Check :doc:`frontend-testing` to verify integrations continue to work across
releases.
