.. _editor-extending-diagrams:

Extending Diagram Types
=======================

The editor ships with a catalogue of UML and domain-specific diagram types (class, object, state machine, agent, GUI, quantum circuit).

.. note::
   
   **Moved to Contributing Guide**

   The comprehensive guide for adding new diagram types (covering frontend,
   sidebar integration, and backend processing) has been moved to the
   Contributing section.

   Please see :doc:`../contributing/new-diagram-guide/index` for the full
   walkthrough.

Key Concepts
------------

Before following the contributing guide, understand these core ideas:

*   **Metamodel**: Each diagram type defines its element and relationship types in
    ``diagram-type.ts`` and ``uml-element-type.ts``. These drive palette composition
    and serialization.
*   **Rendering**: Every element type has a React component that receives the element
    model and renders SVG on the canvas.
*   **Palette**: The sidebar is composed dynamically from ``compose-preview.ts`` based
    on the active diagram type. Each element gets a preview thumbnail.
*   **Property panels**: Double-click popups are registered in ``popups.ts`` and let
    users edit element attributes, relationships, and styling.
