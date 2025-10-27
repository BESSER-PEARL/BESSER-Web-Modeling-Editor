Customization and accessibility
===============================

Tailor the editor to your preferences and ensure an inclusive experience for all
team members.

Themes and appearance
---------------------

* Toggle dark/light mode from the application bar. Preferences are stored in
  local storage under ``localStorageUserThemePreference``.
* Override colours using custom CSS loaded via the deployment host. Inject
  additional stylesheets in the HTML template located at
  :file:`packages/webapp/src/main/index.html` before building.
* Replace the favicon or branding assets in :file:`packages/webapp/src/main/assets`.

Localization
------------

* The UI copies strings from the ``@besser/wme`` engine. Extend localisation
  bundles by editing translation files under :file:`packages/editor`.
* Expose ``DEPLOYMENT_URL``-specific configuration to toggle languages via query
  parameters or user profiles.

Accessibility features
----------------------

Keyboard navigation
    Primary actions are accessible via keyboard shortcuts and the command
    palette. Focus states are visible and follow WCAG contrast guidelines.
Screen readers
    Toolbar buttons, menus, and modals include ``aria-label`` attributes. Test in
    NVDA, VoiceOver, or JAWS to verify your customisations.
High contrast
    Combine the dark theme with custom CSS to increase contrast for low-vision
    users. Ensure iconography remains legible.

Assistive integrations
----------------------

* Configure ``UML_BOT_WS_URL`` to enable conversational assistance that generates
  diagram scaffolds or narrates changes.
* Use the feedback share mode to allow reviewers to leave textual or audio notes
  without editing the diagram.

Performance tuning
------------------

* Enable ``POSTHOG_KEY`` to capture performance metrics and identify accessibility
  regressions.
* Lazy-load optional panels by adjusting React routes when serving audiences with
  limited connectivity.

Testing your customisations
---------------------------

* Use browser accessibility inspectors (Lighthouse, Axe) to audit contrast,
  keyboard navigation, and ARIA labelling.
* Run ``npm run build:webapp`` after updating assets to ensure they are bundled
  correctly.

Next steps
----------

Proceed to the :doc:`../platform/index` section to understand how the webapp,
server, and shared packages work together.
