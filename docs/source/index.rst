.. BESSER WME documentation master file

BESSER Web Modeling Editor
==========================

The **BESSER Web Modeling Editor (WME)** is the editor that powers
the BESSER low-code platform. This documentation explains how the monorepo is
organised, how to work with the reusable editor package, and how the bundled
web application embeds, extends, and deploys the editor in production.

The content is organised around the main developer journeys:

* **Overview** introduces the repository layout, prerequisites, and developer
  workflows for installing and running the project locally.
* **Editor package** documents the `packages/editor` module, including the
  `ApollonEditor` API, application architecture, and guidance for adding new
  diagram types or behaviours.
* **Web application** covers the React application under `packages/webapp`,
  its project-centric UX, collaboration hooks, and how to integrate the editor
  into other UIs.
* **Contributing** summarises the expectations for pull requests, code quality,
  and how to collaborate effectively with the maintainers.
* **Reference** lists reusable CLI commands and environment variables that
  shape runtime behaviour across packages.

.. toctree::
   :maxdepth: 2
   :caption: Overview

   overview/index
   overview/getting-started
   overview/project-structure

.. toctree::
   :maxdepth: 2
   :caption: Editor package

   editor/index
   editor/api
   editor/extending-diagrams
   editor/diagram-bridge

.. toctree::
   :maxdepth: 2
   :caption: Web application

   webapp/index
   webapp/local-projects
   webapp/embedding

.. toctree::
   :maxdepth: 1
   :caption: Contributing

   contributing/index
   contributing/development-workflow

.. toctree::
   :maxdepth: 1
   :caption: Reference

   reference/cli
   reference/environment

Project resources
-----------------

* Source: `<https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor>`_
* Online editor: `<https://editor.besser-pearl.org>`_
* BESSER platform: `<https://github.com/BESSER-PEARL/BESSER>`_

Indices and tables
------------------

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
