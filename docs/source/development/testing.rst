Testing strategy
================

Quality assurance combines automated checks and manual verification.

Automated checks
----------------

* ``npm run lint`` – runs ESLint and Stylelint across webapp and server.
* ``npm run prettier:check`` – validates formatting.
* Package-specific test suites (Jest, integration tests) live under each package
  and can be executed via ``npm test --workspace=<package>``.

Backend tests
-------------

* Add unit tests for services under ``packages/server/src/main/services`` to
  validate storage adapters, conversion pipelines, and resource controllers.
* Use supertest to exercise Express routes in isolation.
* Mock Redis or file storage for deterministic behaviour.

Frontend tests
--------------

* See :doc:`../frontend/frontend-testing` for component and integration testing
  guidelines.

Manual verification
-------------------

* Smoke test collaboration flows: create a diagram, share it, edit from another
  browser, and verify version history updates.
* Validate export formats (PNG, SVG, PDF) after major rendering changes.
* Test on multiple browsers (Chrome, Firefox, Safari) and devices.

Continuous integration
----------------------

* Configure CI pipelines (GitHub Actions, GitLab CI) to run linting, testing, and
  production builds on pull requests.
* Cache dependencies to speed up builds and add job matrices for multiple Node
  versions if required.

Next steps
----------

Proceed to :doc:`release` for guidance on packaging and publishing updates.
