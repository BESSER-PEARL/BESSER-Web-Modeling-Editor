Upgrading
========

Keep your installation in sync with upstream releases to benefit from bug fixes
and new modelling capabilities. This guide explains how to update both the code
and persistent state.

Updating source code
--------------------

#. Stash or commit local changes to avoid merge conflicts.
#. Pull the latest changes::

     git fetch origin
     git checkout main
     git pull --ff-only origin main

#. Re-install dependencies to pick up updated workspace lockfiles::

     npm install

#. Rebuild the packages::

     npm run build

Migrating stored diagrams
-------------------------

File-based storage
    Diagrams stored under :file:`diagrams/` remain compatible across versions
    because they persist JSON representations created by ``DiagramService``.
    Back up the directory before upgrading.
Redis storage
    When switching from filesystem to Redis, export existing diagrams by
    enabling the ``APOLLON_REDIS_MIGRATE_FROM_FILE`` variable for a single server
    start. The `MigratingStorageService` copies diagrams from disk to Redis and
    then disables itself.

Database schema
    The collaboration server does not manage a relational database. No schema
    migrations are required between releases.

Revisiting configuration
------------------------

New releases may introduce additional environment variables or templates. Review
:doc:`configuration` after upgrading and update any infrastructure automation
(such as ``docker-compose`` files or Kubernetes manifests).

Regression testing
------------------

After an upgrade, run the local verification suite::

  npm run lint
  npm run prettier:check
  npm run build

Optionally smoke test the server::

  npm run start:server

Open ``http://localhost:8080`` to ensure diagrams load, share links resolve, and
export actions succeed.
