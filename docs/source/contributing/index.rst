Contributing
============

Thank you for your interest in contributing to the BESSER Web Modeling Editor!
This section covers everything you need: from setting up your environment to
submitting a pull request.

.. tip::
   Not sure where to start? Browse
   `open issues <https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/issues>`_
   labeled ``good first issue``, or pick an area below.

Quick Links
-----------

- :doc:`codebase-guide` — Understand the code: editor, webapp2, server internals
- :doc:`development-workflow` — Install, run, test, and submit
- :doc:`new-diagram-guide/index` — Add a new diagram type (editor + webapp + backend)
- `CONTRIBUTING.md <https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/blob/main/CONTRIBUTING.md>`_ — Repository-level policy
- `Code of Conduct <https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/blob/main/CODE_OF_CONDUCT.md>`_

Where to Contribute
-------------------

**Editor package** (``packages/editor``)
   The reusable modeling engine. Add diagram types, element renderers, palette
   previews, property popups, or improve the ``ApollonEditor`` API.

**Web application** (``packages/webapp2``)
   The React SPA. Improve project management, code generation integration,
   deployment flows, collaboration, or the UI.

**Server** (``packages/server``)
   The Express server. Improve diagram persistence, SVG-to-PDF export, or
   collaboration WebSocket handling.

**Documentation** (``docs/``)
   Fix errors, expand thin pages, add tutorials, or improve the Sphinx build.

Code Style
----------

- **Language**: TypeScript (strict mode), React with functional components.
- **Linting**: ESLint configured per package. Run before every commit:

  .. code-block:: bash

     npm run lint

- **Formatting**: Prettier configured at root. Check with:

  .. code-block:: bash

     npm run prettier:check

- **Naming**: ``camelCase`` for variables and functions, ``PascalCase`` for
  components and types, ``UPPER_SNAKE_CASE`` for constants.
- **Commits**: Use clear, descriptive messages. Prefer imperative mood
  (e.g., "Add state machine palette preview" not "Added...").

Branching and PR Workflow
-------------------------

1. Fork the repository and clone locally.
2. Create a feature branch from ``main`` (e.g., ``feature/add-sequence-diagram``).
3. Make focused, incremental commits.
4. Run the full check suite:

   .. code-block:: bash

      npm run lint
      npm run test --workspace=webapp2
      npm run build

5. Push and open a pull request against ``main``.
6. In the PR description, explain: what changed, why, how to test.
7. Respond to review feedback — reviews are collaborative.

.. note::
   The WME repository uses ``main`` as its default branch (not ``master``).
   The parent BESSER repository uses ``master``.
