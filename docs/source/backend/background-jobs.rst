Background jobs
===============

Routine maintenance ensures collaboration data remains healthy. The repository
includes cron job examples and guidance for managing scheduled work.

Deleting stale diagrams
-----------------------

* ``delete-stale-diagrams.cronjob.txt`` defines a cron entry that removes shared
  diagrams older than 12 weeks from the filesystem.
* Update the target path inside the cron file to match your ``diagrams``
  directory.
* Install the cron job under the service user::

    crontab -u besser_wme_standalone delete-stale-diagrams.cronjob.txt

* Logs are written to ``/var/log/cron.log`` by default. Create the file and set
  permissions before scheduling the job.

Redis retention
---------------

* Configure ``APOLLON_REDIS_DIAGRAM_TTL`` to expire diagrams automatically.
* Use Redis keyspace notifications if you want to trigger clean-up workflows when
  diagrams expire.

Other scheduled tasks
---------------------

Consider adding the following automation depending on your deployment:

* **Backups** – scheduled sync of the ``diagrams`` directory or Redis snapshots.
* **Metrics export** – cron jobs that push health metrics to monitoring systems.
* **Dependency updates** – periodic ``npm run update`` executed in CI to keep
  packages fresh.

Operational tips
----------------

* Run background jobs as the dedicated ``besser_wme_standalone`` system user to
  avoid permission issues.
* Document scheduling windows to avoid running maintenance during peak usage.

Next steps
----------

Proceed to the :doc:`../frontend/index` section for front-end implementation
details.
