Architecture & Design
=====================

The BESSER Web Modeling Editor is organized as a TypeScript/Node.js monorepo.
This page explains the key design decisions and how the pieces fit together.

Why a Monorepo?
---------------

The editor, web application, and server are maintained in a single repository
to ensure they evolve together. The three packages share TypeScript types,
Redux patterns, and build tooling. Changes that cross package boundaries
(e.g., adding a new diagram type) can be reviewed and tested as a unit.

The Three Packages
------------------

* **Editor engine** (``packages/editor``): The reusable modeling kernel,
  exported as ``@besser/wme`` on npm. It provides the ``ApollonEditor`` class,
  diagram type registries, and Redux stores. External applications embed this
  package without needing the web application.

* **Web application** (``packages/webapp``): A React SPA built with Vite,
  Radix UI, and Tailwind CSS. It wraps the editor with project management,
  code generation, deployment, and collaboration features. This is what runs
  at `editor.besser-pearl.org <https://editor.besser-pearl.org>`_.

* **Server** (``packages/server``): An Express application that serves the
  compiled webapp, stores shared diagrams (filesystem or Redis), and handles
  SVG-to-PDF conversion.

How Data Flows
--------------

1. The user designs a diagram on the canvas (editor package).
2. Changes flow through Redux to the ``workspaceSlice`` (webapp).
3. The workspace slice auto-saves to ``localStorage`` and optionally syncs
   via WebSocket to the Express server for collaboration.
4. When the user clicks **Generate**, the webapp sends the diagram JSON to the
   BESSER backend (``http://localhost:9000/besser_api``), which converts it to
   a B-UML model and runs the selected code generator.
5. Generated code is streamed back as a ZIP download.

For the detailed directory layout, see :doc:`project-structure`.

.. toctree::
   :hidden:

   getting-started
   project-structure
