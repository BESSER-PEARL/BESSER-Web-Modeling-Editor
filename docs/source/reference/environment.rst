Environment Variables
=====================

The web application has **no runtime configuration**: every variable is baked
into the JavaScript bundle when the webapp is built. There is therefore no
``.env`` file in the repository and no configuration endpoint the browser can
call — changing any of these values requires a rebuild.

How the values reach the bundle
-------------------------------

``packages/webapp/vite.config.ts`` calls ``loadEnv(mode, process.cwd(), '')``
(empty prefix, so *all* variables are read, not just ``VITE_``-prefixed ones)
and passes a fixed list of names to Vite's ``define``. Vite then replaces the
static text ``process.env.<NAME>`` in the sources with a string literal.

``packages/webapp/src/main/shared/constants/constant.ts`` is the only module
that reads them. Its ``_env()`` helper takes the Vite-injected value first and
falls back to ``import.meta.env.VITE_<NAME>``.

.. important::
   Because Vite substitutes *static* text, a dynamic lookup such as
   ``process.env[name]`` is **not** replaced. Every variable must be referenced
   by its full name, and adding a new variable means editing both
   ``vite.config.ts`` (the ``define`` block) and ``constant.ts``.

You can supply the values either as process environment variables:

.. code-block:: bash

   DEPLOYMENT_URL=https://editor.example.com \
   BACKEND_URL=https://api.example.com/besser_api \
   UML_BOT_WS_URL=wss://agent.example.com \
   npm run build

or in ``packages/webapp/.env`` (git-ignored, not committed):

.. code-block:: text

   DEPLOYMENT_URL=http://localhost:8080
   BACKEND_URL=http://localhost:9000/besser_api

Web application (build time)
----------------------------

These are exactly the seven names in the ``define`` block.

``BACKEND_URL``
   Base URL of the BESSER Python backend, including the ``/besser_api`` path.
   Every HTTP call the webapp makes — model validation, B-UML conversion, code
   generation, the Spec-Driven Agent's ``/spec-driven/*`` endpoints and the
   GitHub OAuth endpoints — is built from it.

   In a **development** build the value is ignored and hardcoded to
   ``http://localhost:9000/besser_api``. In a production build it must be set
   explicitly; if it is missing the derived endpoint URLs become
   ``undefined/...`` and every backend call fails.

``DEPLOYMENT_URL``
   Public origin of the deployment (e.g. ``https://editor.besser-pearl.org``).
   It is used to derive ``WS_PROTOCOL`` (``wss`` when the origin is HTTPS,
   otherwise ``ws``) and the **default** modeling-agent WebSocket URL when
   ``UML_BOT_WS_URL`` is not set. The standalone Express server also uses it at
   start-up to rewrite any literal ``http://localhost:8080`` left inside the
   built JavaScript.

``UML_BOT_WS_URL``
   WebSocket endpoint of the :doc:`modeling agent <../user-guide/ai-assistant>`
   service that powers the AI assistant. Resolution order:

   #. the explicit value, if set;
   #. ``ws://localhost:8765`` in a development build;
   #. ``<ws|wss>://<DEPLOYMENT_URL host>`` when ``DEPLOYMENT_URL`` is set;
   #. ``ws://localhost:8765`` otherwise.

   The assistant is optional — when nothing is listening the chat panel simply
   reports that it is disconnected and the rest of the editor works normally.

``SENTRY_DSN``
   Optional DSN for Sentry browser error reporting. Leave unset to disable.

``POSTHOG_KEY`` / ``POSTHOG_HOST``
   Optional PostHog product analytics. Leave unset to disable.

``APPLICATION_SERVER_VERSION``
   Defined and exported, but **not currently read by any component**. Setting it
   has no observable effect in the UI today.

Server (runtime)
----------------

``packages/server`` is a thin Express app that serves the built webapp and two
small endpoints (``POST /api/uml-agent/rate-limit/check`` and ``POST /api/svg``).
It reads only two variables at runtime:

``DEPLOYMENT_URL``
   Rewrites literal ``http://localhost:8080`` occurrences inside
   ``build/webapp/*.js`` on start-up, and tags the Sentry environment.

``SENTRY_DSN``
   Optional DSN for server-side error reporting.

The listening port is hardcoded to ``8080`` in ``packages/server/src/main/server.ts``.

.. note::
   Earlier versions of this page documented ``APOLLON_REDIS_URL``,
   ``APOLLON_REDIS_DIAGRAM_TTL`` and ``APOLLON_REDIS_MIGRATE_FROM_FILE``. The
   shared-diagram storage and real-time collaboration features those variables
   configured are no longer part of the server package, and the variables have
   no effect.

Docker build arguments
----------------------

The ``Dockerfile`` exposes the same names as build args so they can be passed
with ``docker build --build-arg``:

.. code-block:: bash

   docker build \
     --build-arg DEPLOYMENT_URL=https://editor.example.com \
     --build-arg BACKEND_URL=https://api.example.com/besser_api \
     --build-arg UML_BOT_WS_URL=wss://agent.example.com \
     -t besser-wme .

.. warning::
   The ``Dockerfile`` also declares ``GITHUB_CLIENT_ID`` as an ``ARG``/``ENV``.
   It is **dead**: it is not in the Vite ``define`` block, nothing in the webapp
   or the Express server reads it, and it therefore never reaches the browser
   bundle. Passing it changes nothing. See :ref:`github-oauth-config` below.

.. _github-oauth-config:

GitHub OAuth configuration (backend, not frontend)
--------------------------------------------------

The editor never holds a GitHub OAuth client id. The whole OAuth exchange is
performed by the **BESSER Python backend**:

#. The webapp sends the browser to ``<BACKEND_URL>/github/auth/login``.
#. The backend builds the ``https://github.com/login/oauth/authorize`` URL from
   its own ``GITHUB_CLIENT_ID`` and redirects there.
#. GitHub calls back to ``<GITHUB_REDIRECT_URI>``, which must point at the
   backend's ``/github/auth/callback`` route.
#. The backend exchanges the code for an access token using
   ``GITHUB_CLIENT_SECRET``, stores the token server-side, and redirects the
   browser back to ``<DEPLOYMENT_URL>?github_session=<id>&username=<login>``.
#. The webapp keeps only that opaque session id (in ``sessionStorage``); the
   access token never reaches the browser.

The variables below therefore belong to the **backend's** environment, not this
repository's build:

``GITHUB_CLIENT_ID`` / ``GITHUB_CLIENT_SECRET``
   Credentials of the GitHub OAuth App. Without them the backend answers
   ``/github/auth/login`` with HTTP 500 and GitHub sign-in is unavailable.

``GITHUB_REDIRECT_URI``
   Must exactly match the callback URL registered on the GitHub OAuth App, and
   must point at the **backend** (default
   ``http://localhost:9000/besser_api/github/auth/callback``).

``DEPLOYMENT_URL``
   Where the backend sends the browser after a successful (or failed) callback.
   It must be the editor's public origin.

Common
------

``NODE_ENV`` / Vite mode
   ``npm run dev`` runs Vite in development mode, which forces ``BACKEND_URL``
   to ``http://localhost:9000/besser_api`` and defaults the assistant socket to
   ``ws://localhost:8765``. ``npm run build`` runs in production mode, where the
   explicit values are used.
