Frontend testing
================

Adopt a layered testing strategy to maintain confidence in UI changes.

Unit tests
----------

* Use Jest and React Testing Library to test component rendering and interaction.
* Co-locate tests within ``__tests__`` directories or alongside components.
* Mock ``@besser/wme`` dependencies when isolating UI behaviour.

Integration tests
-----------------

* Spin up the development server (``npm run start:webapp``) and interact with the
  UI using Playwright or Cypress.
* Verify collaboration flows by mocking WebSocket responses or running the server
  in parallel.

Snapshot tests
--------------

* Capture critical layouts (application bar, share modal) using testing-library's
  snapshot utilities. Update intentionally when visual changes occur.

Linting and formatting
----------------------

* Run ``npm run lint`` to enforce ESLint and Stylelint rules across the webapp.
* Use ``npm run prettier:check`` to ensure consistent formatting.

Accessibility tests
-------------------

* Integrate tools like Axe or Lighthouse to detect accessibility regressions.
* Focus on keyboard navigation, ARIA labels, and contrast when updating themes or
  modal flows.

Continuous integration
----------------------

* Configure CI pipelines to run linting, unit tests, and production builds.
* Cache ``node_modules`` between runs for faster feedback.

Next steps
----------

Continue to :doc:`../deployment/index` to move from local development to
production deployments.
