.. BESSER WME documentation master file

BESSER Web Modeling Editor
==========================

The **BESSER Web Modeling Editor (WME)** is the visual editor that powers
the `BESSER low-code platform <https://github.com/BESSER-PEARL/BESSER>`_.
Design UML models, generate code, and deploy applications -- all from your browser.

You can draw a diagram by hand, or describe what you want in plain language and
let the built-in :doc:`AI assistant <user-guide/ai-assistant>` build and edit it
on the canvas for you. The assistant talks to the separate
`modeling agent <https://github.com/BESSER-PEARL/modeling-agent>`_ service over
a WebSocket and applies the structured actions it returns. The same conversation
can hand a finished model to a BESSER generator, or to the
:doc:`Spec-Driven Agent <user-guide/spec-driven-agent>`, which assembles a whole
application. Both can run on a keyless free tier or on your own API key — see
:doc:`user-guide/ai-keys`.

.. tip::
   Try it now at `editor.besser-pearl.org <https://editor.besser-pearl.org>`_
   -- no installation needed.

.. toctree::
   :maxdepth: 2
   :caption: Tutorials

   tutorials/first-project

.. toctree::
   :maxdepth: 2
   :caption: How-to Guides

   overview/getting-started
   user-guide/ai-assistant
   user-guide/spec-driven-agent
   user-guide/ai-keys
   user-guide/deploy_locally
   user-guide/deploy_to_render
   user-guide/projects
   user-guide/diagrams/index
   user-guide/agent-components
   user-guide/agent-runtime
   user-guide/agent-simulation
   contributing/new-diagram-guide/index

.. toctree::
   :maxdepth: 2
   :caption: Reference

   user-guide/use_the_wme
   editor/index
   webapp/index
   webapp/local-projects
   webapp/embedding
   reference/cli
   reference/environment

.. toctree::
   :maxdepth: 1
   :caption: Explanation

   overview/index
   overview/project-structure

.. toctree::
   :maxdepth: 1
   :caption: Contributing

   contributing/index
   contributing/codebase-guide
   contributing/development-workflow

Project resources
-----------------

* Source: `<https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor>`_
* Online editor: `<https://editor.besser-pearl.org>`_
* BESSER platform: `<https://github.com/BESSER-PEARL/BESSER>`_
* Modeling agent (the AI assistant's backend): `<https://github.com/BESSER-PEARL/modeling-agent>`_
