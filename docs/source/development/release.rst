Release management
==================

Plan and execute releases using the following checklist.

Pre-release checklist
---------------------

* Ensure ``main`` is green in CI and documentation is up to date.
* Review dependency updates and address security advisories.
* Verify translation and template assets are bundled correctly.

Versioning
----------

* Follow semantic versioning (MAJOR.MINOR.PATCH).
* Update the version in :file:`package.json` and any relevant package manifests.
* Tag releases using ``git tag vX.Y.Z`` and push tags to origin.

Release artifacts
-----------------

* Build the workspace::

    npm run build

* Package Docker images if applicable::

    docker build -t besser-wme-standalone:vX.Y.Z .

* Publish documentation updates to Read the Docs or your hosting provider.

Changelog
---------

* Summarise user-visible changes, bug fixes, and migration steps.
* Link to relevant GitHub issues and pull requests.

Post-release
------------

* Monitor error reporting and analytics dashboards for regressions.
* Respond to community feedback and document known issues.
* Begin planning the next iteration based on backlog priorities.

Next steps
----------

Refer to :doc:`contributing` for guidance on community engagement and support.
