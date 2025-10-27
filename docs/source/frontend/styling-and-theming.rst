Styling and theming
===================

Styling is handled via global CSS, component-specific styles, and theme
configuration files.

Global styles
-------------

* :file:`packages/webapp/src/main/styles.css` defines base styles, typography,
  layout primitives, and CSS variables.
* Webpack processes CSS via ``style-loader`` and ``css-loader`` (see
  :file:`packages/webapp/webpack/webpack.common.js`).

Theme configuration
-------------------

* ``themings.json`` stores palette definitions and editor theme overrides.
* ``localStorageUserThemePreference`` and ``localStorageSystemThemePreference``
  determine the active theme at runtime.
* The application bar exposes a toggle to switch between light and dark modes.

Component styles
----------------

* Many components import CSS modules or styled utilities alongside their
  TypeScript files. Keep styles colocated to simplify maintenance.
* Use CSS variables for colours and spacing to ensure theme compatibility.

Custom theming
--------------

* Extend ``themings.json`` with additional entries for corporate branding.
* Inject environment-specific CSS via host applications by loading extra
  stylesheets in :file:`index.html` before building.
* When integrating with design systems, consider wrapping components with your
  own style providers to override default tokens.

Responsive design
-----------------

* Layout components use flexbox to adapt to different resolutions.
* Ensure new components respect responsive breakpoints and test across common
  screen sizes.

Accessibility
-------------

* Maintain sufficient colour contrast when customising themes.
* Provide focus states for interactive elements and ensure they remain visible in
  both light and dark modes.

Next steps
----------

Continue with :doc:`external-integrations` to learn how the webapp interacts with
external services.
