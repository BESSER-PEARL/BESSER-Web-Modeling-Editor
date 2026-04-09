Editors
=======

The BESSER Web Modeling Editor ships three specialized editors, each tailored to a
different modeling domain. All editors share a common architecture based on the
``ApollonEditor`` class and Redux state management.

**UML Editor**
   The core editor for structural modeling. Supports class diagrams, object diagrams,
   state machine diagrams, and agent diagrams. This is the most feature-rich editor
   and the foundation for most code generators.

**Quantum Circuit Editor**
   A visual editor for designing quantum circuits. Supports standard, controlled, and
   custom gates with real-time circuit visualization. Generates Qiskit code.

**GUI Editor**
   A drag-and-drop editor for designing user interfaces. Built on GrapesJS, it
   produces GUI No-Code diagrams used by the Full Web App, React, and Flutter generators.

Shared services like the :doc:`diagram-bridge` enable cross-diagram data sharing
(e.g., object diagrams referencing class diagram types). The :doc:`api` documents
the public ``ApollonEditor`` interface available to all editors.

.. toctree::
   :maxdepth: 2
   :caption: Available Editors

   uml_editor
   quantum_editor
   gui_editor

.. toctree::
   :maxdepth: 1
   :caption: Architecture & Services

   api
   diagram-bridge
   extending-diagrams
