Automation and shortcuts
========================

Speed up your modelling sessions by mastering keyboard shortcuts, automation
hooks, and reusable configurations.

Keyboard shortcuts
------------------

Global
    ``Ctrl+N`` create new diagram, ``Ctrl+S`` save, ``Ctrl+Shift+S`` publish a new
    version, ``Ctrl+P`` open the export dialog.
Navigation
    ``Ctrl+Mouse Wheel`` zoom, ``Space+Drag`` pan, ``Ctrl+0`` reset zoom.
Editing
    ``Ctrl+D`` duplicate selection, ``Alt+Drag`` clone, ``Shift+Arrow`` nudge,
    ``Ctrl+G`` group, ``Ctrl+Shift+G`` ungroup.
Collaboration
    ``Ctrl+Shift+C`` copy share link, ``Ctrl+Alt+F`` toggle feedback view.

Command palette
---------------

Use ``Ctrl+Shift+P`` (``Cmd+Shift+P`` on macOS) to open the command palette for
searchable access to actions such as diagram conversion, template switching, and
preference toggles.

Automating repetitive work
--------------------------

Templates
    Save frequently used diagram structures as templates (:doc:`templates-and-assets`).
Workflows
    Use ``LocalStorageRepository`` to pre-populate default projects on startup.
Scripting
    Export diagrams as JSON and feed them into scripts that validate naming
    conventions, generate documentation, or trigger downstream builds.

Analytics and instrumentation
-----------------------------

* Enable PostHog by setting ``POSTHOG_HOST`` and ``POSTHOG_KEY``. The analytics
  provider measures shortcut usage and identifies opportunities for custom
  automations.
* Configure ``SENTRY_DSN`` to capture client-side errors and performance metrics
  relevant to automation features.

Custom keyboard mappings
------------------------

Advanced users can extend shortcuts by editing the React components under
:file:`packages/webapp/src/main/components`. Follow the existing pattern in the
application bar to register new listeners.

Troubleshooting
---------------

* If shortcuts stop responding, confirm the canvas has focus and that browser
  extensions are not intercepting key combinations.
* In non-US keyboard layouts, re-map shortcuts via browser-level overrides or
  update the key handlers in the source.

Next steps
----------

Wrap up with :doc:`customization-and-accessibility` to tailor the editor to your
team's preferences.
