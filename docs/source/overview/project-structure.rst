Project Structure
=================

The repository is an npm workspace with three first-class packages and a handful
of supporting directories. The layout below assumes the current working
directory is the WME repo root (or ``besser/utilities/web_modeling_editor/frontend``
when used as a submodule inside the BESSER repo).

Top-level directories
---------------------

``docs/``
   Sphinx project used to build this documentation set.

``packages/``
   Workspace root containing the editor engine, the React web application, and
   the Express server.

``build/``
   Output folder populated by the ``build:*`` scripts. Static web assets live
   under ``build/webapp`` and the server bundle under ``build/server``.

``node_modules/``
   Root-level dependencies shared by the workspaces.

``Dockerfile`` and ``docker-compose*.yml``
   Artefacts used to assemble container images when deploying the standalone
   experience.

Workspace packages
------------------

``packages/editor/``
   The reusable UML engine exported on npm as ``@besser/wme``. It exposes the
   ``ApollonEditor`` class, diagram type registries, Redux stores, and
   supporting services used by both the standalone webapp and external
   integrations.

``packages/webapp/``
   The React single-page application that embeds the editor, manages local
   projects, handles import/export, code generation requests, and orchestrates
   collaboration flows.

``packages/server/``
   Express server that serves the compiled webapp, proxies diagram actions and
   persistence to either the filesystem or Redis, and exposes utilities such as
   SVG-to-PDF conversion.

Cross-package conventions
-------------------------

* TypeScript sources are nested under ``src/main``; tests (where present) live
  in ``src/tests``.
* Redux slices in the webapp follow the ``services/<domain>/<name>Slice.ts``
  naming convention.
* The editor package uses the ``packages/<diagram family>`` hierarchy to group
  element models, React renderers, previews, and pop-ups for each diagram type.
* Build artefacts never live inside ``src``. Scripts clean the ``build/``
  folder before producing new outputs.

Use :doc:`../editor/index` for a deeper look at the editor package and
:doc:`../webapp/index` for the runtime wiring of the React application.
