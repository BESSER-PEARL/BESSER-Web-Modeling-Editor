Exporting and integration
=========================

BESSER WME Standalone provides multiple export formats and automation hooks so
you can embed diagrams in other systems or pipelines.

Export formats
--------------

Use ``File → Export`` to download the active diagram in the following formats:

``PNG``
    Choose between transparent or white backgrounds. Suitable for slide decks and
    documents.
``SVG``
    Vector exports that preserve layers and text for downstream editing.
``PDF``
    High-fidelity format ideal for documentation packages.
``JSON``
    Serialises the diagram model for re-importing or processing with custom
    scripts.

Programmatic exports
--------------------

* The collaboration server exposes REST endpoints under ``/api/diagrams`` for
  retrieving diagrams as JSON or SVG. Use these endpoints in CI pipelines to
  capture artefacts automatically.
* Use ``LocalStorageRepository`` helpers to pull the latest published token when
  constructing automated export URLs.
* Pair the webapp with the ``@besser/wme`` CLI to transform diagram JSON into
  code generators in your build steps.

Embedding diagrams
------------------

The ``Embed`` sharing mode produces URLs that can be embedded in markdown, wikis,
or dashboards. The embed renders the latest version and respects read-only
constraints. Combine with iframes or image proxies depending on your host.

Third-party integrations
------------------------

* **Issue trackers** – Link to ``Give Feedback`` share URLs in GitHub or GitLab
  issues to collect contextual reviews.
* **Documentation portals** – Export SVGs or use embed links for living
  diagrams.
* **Low-code platform** – Synchronise diagrams with the broader BESSER platform
  by consuming the JSON representation.

Automation tips
---------------

* Expose ``DEPLOYMENT_URL`` as an environment variable in CI jobs so scripts can
  build the correct export URLs.
* Combine exports with static site generators to publish diagram collections.
* Use the ``POSTHOG_KEY`` analytics integration to measure export usage and
  adoption.

Next steps
----------

Continue with :doc:`automation-and-shortcuts` to streamline repetitive actions
inside the editor.
