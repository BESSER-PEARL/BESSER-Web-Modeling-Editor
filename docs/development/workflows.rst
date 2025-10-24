Workflows
=========

Adopt these practices for efficient collaboration and high-quality contributions.

Branching model
---------------

* Fork the repository or create feature branches from ``main``.
* Use descriptive branch names (``feature/share-modal-enhancements``).
* Keep branches focused and short-lived to ease reviews.

Coding workflow
---------------

1. Create or update tests as you implement features.
2. Run ``npm run lint`` and package-specific tests before committing.
3. Use ``npm run build:local`` to validate build output.
4. Commit with meaningful messages (``feat: support Redis TTL``).

Code review
-----------

* Submit pull requests with clear descriptions, screenshots, and testing notes.
* Respond to review feedback promptly and keep commit history clean.
* Update documentation alongside code changes to maintain parity.

Documentation-first approach
----------------------------

* Update the docs in ``docs/`` whenever behaviour changes.
* Use Sphinx directives to cross-link related sections and keep navigation
  intuitive.

Issue tracking
--------------

* Reference GitHub issues in commit messages and pull requests (``Fixes #123``).
* Label issues with ``bug``, ``enhancement``, ``documentation``, etc. to aid triage.

Release cadence
---------------

* Follow semantic versioning for tagged releases.
* Coordinate release notes with the :doc:`release` guide.

Next steps
----------

Review :doc:`coding-standards` for style and linting expectations.
