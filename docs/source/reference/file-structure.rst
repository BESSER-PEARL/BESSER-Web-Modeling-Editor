File structure
==============

A high-level overview of important directories and files.

Root
----

``package.json``
    Workspace configuration, scripts, and dependency versions.
``docker-compose.yml``
    Development compose file for server + Redis.
``Dockerfile`` / ``Dockerfile.redis``
    Container build definitions.
``docs/``
    Sphinx documentation source.
``packages/``
    Workspace packages (editor, server, shared, webapp).
``BESSER_WME_Standalone.service``
    Example systemd service file for Linux deployments.
``delete-stale-diagrams.cronjob.txt``
    Cron job definition for cleaning old diagrams.

Packages
--------

``packages/editor``
    Shared editor modules.
``packages/server``
    Express server source, services, and build configuration.
``packages/shared``
    DTOs and shared utilities.
``packages/webapp``
    React web application source and build scripts.

Build output
------------

``build/webapp``
    Compiled static assets for the webapp.
``build/server``
    Compiled Express server ready for deployment.

Miscellaneous
-------------

``entrypoint.sh``
    Container entrypoint script.
``root_config.ts``
    Configuration entry for Nx or tooling integrations (if used).

Next steps
----------

Review the :doc:`../appendix/index` for FAQs, glossary, and troubleshooting.
