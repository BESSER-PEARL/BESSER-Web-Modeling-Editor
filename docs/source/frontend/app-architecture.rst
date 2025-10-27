Application architecture
========================

``packages/webapp`` hosts the React single-page application. Build configuration
lives under ``webpack/`` while TypeScript source code is organised in
``src/main``.

Entry points
------------

:index:`index.tsx`
    Bootstraps React, wraps the application in providers (PostHog, routing), and
    mounts ``RoutedApplication``.
:index:`application.tsx`
    Defines the primary layout, registers routes, and orchestrates modals,
    sidebars, and the editor component.
:index:`application-constants.ts`
    Exposes constants shared across the application (menus, environment
    configuration).

Routing
-------

* ``BrowserRouter`` provides client-side routing.
* ``Routes`` include the main canvas, project settings, team page, and future
  collaboration routes keyed by token.
* ``SidebarLayout`` wraps routes to ensure consistent UI chrome around the
  editor.

Providers and context
---------------------

* ``ApollonEditorProvider`` supplies the ``ApollonEditor`` instance and setter to
  child components.
* ``ApplicationStore`` coordinates global state such as current project, active
  diagram, and notifications.
* ``PostHogProvider`` enables analytics when ``POSTHOG_KEY`` is defined.

Supporting infrastructure
-------------------------

* ``hooks/`` – custom hooks (``useProject``, etc.) encapsulate data fetching and
  state synchronisation.
* ``services/`` – modules for API communication, local storage, and helper
  utilities.
* ``utils/`` – shared helper functions, formatting utilities, and constants.

Build targets
-------------

* ``webpack.common.js`` defines shared configuration, including environment
  variable injection via ``DefinePlugin``.
* ``webpack.dev.js`` configures the webpack dev server with hot module replacement
  and API proxying.
* ``webpack.prod.js`` optimises bundles for production, minifies assets, and
  outputs to ``build/webapp``.

Testing
-------

* Unit tests can be colocated next to components under ``__tests__`` directories.
* Use React Testing Library or Jest to validate UI behaviour. See
  :doc:`frontend-testing` for patterns.

Next steps
----------

Continue with :doc:`state-management` to understand data flow within the
application.
