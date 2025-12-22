Extending Diagram Types
=======================

The editor ships with a rich catalogue of UML, BPMN, flowchart, and agent
diagram types.

.. note::
   
   **Moved to Contributing Guide**

   The comprehensive guide for adding new diagram types (covering frontend,
   sidebar integration, and backend processing) has been moved to the
   Contributing section.

   Please see :doc:`../contributing/new-diagram-guide/index` for the full
   walkthrough.

Concepts
--------

While the step-by-step guide is in the Contributing section, it is helpful to
understand the core concepts:

*   **Metamodel**: Defined in ``uml-element-type.ts`` and ``diagram-type.ts``.
*   **Rendering**: React components that take an element model and render SVG.
*   **Palette**: The sidebar is composed dynamically based on the active diagram type.
