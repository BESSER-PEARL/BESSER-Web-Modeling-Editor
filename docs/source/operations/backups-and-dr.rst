Backups and disaster recovery
=============================

Protect critical assets and recover quickly from failures.

What to back up
---------------

* Filesystem diagrams stored under ``diagrams/``.
* Redis data (AOF/RDB snapshots) when using Redis storage.
* Configuration files (``.env``, systemd units, reverse proxy configs).
* Documentation build artefacts if hosting docs statically.

Backup schedule
---------------

* Nightly incremental backups with weekly full backups for diagrams or Redis
  dumps.
* Store backups in off-site or cloud storage with encryption.
* Test restoration quarterly to validate procedures.

Recovery steps
--------------

1. Provision replacement infrastructure (VM, container, Redis instance).
2. Restore backups to the target environment.
3. Update DNS or load balancer entries to point to the restored service.
4. Monitor for errors and confirm collaboration features operate normally.

Documentation
-------------

* Record backup locations, retention policies, and contact points in operational
  runbooks.
* Update stakeholders when backup policies change.

Next steps
----------

Head to the :doc:`../appendix/index` for reference materials and FAQs.
