Product overview
================

BESSER WME Standalone is the browser-based edition of the BESSER modelling
experience. It packages the reusable `@besser/wme` modelling engine together
with an opinionated user interface, template gallery, import/export tooling, and
optional collaboration backend.

Edition highlights
------------------

* **No mandatory sign-up** – users can model diagrams immediately after loading
the web application.
* **Rich editor surface** – drag-and-drop placement, keyboard shortcuts, theme
switching, auto-layout, and inline styling controls provide a familiar diagram
editing experience.
* **Template and asset management** – curated diagram templates, custom assets,
and palette management are available out of the box.
* **Multiple deployment models** – run the editor as static assets, serve it via
Node.js, or host both editor and server via Docker or container orchestration.

Platform building blocks
------------------------

The repository is organised as a multi-package workspace:

``packages/editor``
    Contains reusable UI primitives, domain models, and shared utilities that
    are consumed by both the standalone web application and the server.
``packages/webapp``
    Hosts the React single-page application that renders the modelling
    workspace, integrates template assets, and orchestrates session state.
``packages/server``
    Implements the Express-based collaboration server. It serves the static
    webapp bundle, exposes REST APIs for diagram persistence, and manages live
    collaboration via websockets.
``packages/shared``
    Provides TypeScript DTOs and helpers that are shared between front-end and
    backend packages to keep transport contracts in sync.

Core capabilities at a glance
-----------------------------

* **Diagram editing** with UML, and domain-specific notation palettes.
* **File management** via local browser storage, downloadable exports (PNG,
  SVG, PDF, JSON), and template imports.
* **Generation** transform your  diagrams into B-UML models or code snippets using
  built-in generators.
* **Customisation** including dark/light mode, custom CSS overrides, and
  optional analytics hooks.
* **Automation hooks** for build pipelines through the exposed npm scripts and
  CLI utilities documented later in this guide.


What's next
-----------

* Visit :doc:`installation <installation>` to install dependencies and fetch the
  workspace.
* Jump to :doc:`quickstart <quickstart>` for a guided walkthrough of running the
  editor locally.
* Continue with :doc:`configuration <configuration>` when you are ready to tune
  environment variables and integration endpoints.
