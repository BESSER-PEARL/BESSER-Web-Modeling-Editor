Coding standards
================

Consistent code style improves readability and maintainability. The project
adheres to the following standards.

TypeScript and JavaScript
-------------------------

* Use ES2022+ features supported by the configured TypeScript target.
* Prefer ``const`` and ``let`` over ``var``.
* Avoid default exports when named exports are clearer.
* Provide explicit return types for exported functions.
* Handle asynchronous code with ``async``/``await`` and propagate errors
  meaningfully.

React
-----

* Functional components with hooks are preferred over class components.
* Co-locate component-specific styles and tests.
* Break down large components into smaller, reusable pieces.
* Use ``PropTypes`` or TypeScript interfaces for component props.

Server code
-----------

* Follow Express best practices: middleware ordering, error handling, and
  security headers.
* Avoid blocking operations on the event loop; use async I/O for file and Redis
  interactions.
* Centralise configuration in environment variables and constants.

Linting and formatting
----------------------

* ``npm run lint`` runs ESLint/Stylelint across the workspace.
* ``npm run prettier:check`` enforces formatting. Use ``npm run prettier:write``
  to auto-format.
* Configure your editor to respect ``.editorconfig`` (if present) and TypeScript
  formatting settings.

Documentation
-------------

* Update Sphinx docs alongside code changes.
* Use ``.. note::`` and ``.. warning::`` directives for important caveats.
* Ensure tables and code blocks render correctly in both HTML and Read the Docs.

Commit conventions
------------------

* Use imperative tense (``add support for...``).
* Prefix commits with scope when helpful (``server:``, ``webapp:``).

Next steps
----------

Read :doc:`testing` for verification strategies.
