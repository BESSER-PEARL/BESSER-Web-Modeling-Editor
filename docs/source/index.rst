.. BESSER WME documentation master file

BESSER Web Modeling Editor documentation
=========================================

The **BESSER Web Modeling Editor (WME) ** is a complete toolkit for
modelling BESSER-compliant diagrams in the browser.

This documentation set is organised into thematic collections so that readers
can quickly deep-dive into the area that matters most:

* **Getting started** walks through installation, configuration, and a guided
  tour of the editor.
* **User guides** cover everyday modelling tasks, keyboard shortcuts, sharing
  flows, and ways to extend the workspace.
* **Platform internals** describe how packages in this repository compose the
  standalone experience and how data flows through the system.
* **Frontend** documentation details the React application, store management,
  theming approach, and integration with the modelling engine.
* **Backend** documentation explains the Express-based collaboration server,
  REST APIs, storage adapters, and operational tooling.
* **BESSER Backend** coverage highlights how the WME leverages the BESSER
  low-code platform for rapid development, extensibility, and maintainability.
* **Deployment** topics outline reference topologies for static hosting,
  multi-service setups, and observability.
* **Development** guides provide contributor onboarding, coding standards,
  release management, and quality gates.
* **Operations and Reference** sections cover CLI scripts, environment
  variables, and day-two responsibilities.
* **Appendix** gathers FAQs, glossaries, and troubleshooting recipes.

.. toctree::
   :maxdepth: 2
   :caption: Getting started

   getting-started/index

.. toctree::
   :maxdepth: 2
   :caption: User guides

   user-guide/index

.. toctree::
   :maxdepth: 2
   :caption: Platform internals

   platform/index
   backend/index
   frontend/index

.. toctree::
   :maxdepth: 2
   :caption: Deploy, operate, and contribute

   deployment/index
   development/index
   operations/index
   reference/index
   appendix/index

Project resources
-----------------

* Source code: `<https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR>`_
* Online editor: `<https://editor.besser-pearl.org>`_
* BESSER low-code platform: `<https://github.com/BESSER-PEARL/BESSER>`_

Indices and tables
------------------

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
