Extending Diagram Types
=======================

The editor ships with a rich catalogue of UML, BPMN, flowchart, and agent
diagram types. When you introduce a new diagram family, follow the steps below
to ensure the palette, renderers, exports, and integrations remain in sync.

1. Register the diagram type
----------------------------

* Add a new entry to ``UMLDiagramType`` in
  ``packages/editor/src/main/packages/diagram-type.ts``.
* If the diagram introduces new element or relationship kinds, add them to
  ``UMLElementType`` (``uml-element-type.ts``) and/or
  ``UMLRelationshipType`` (``uml-relationship-type.ts``).

2. Create the package scaffold
------------------------------

Create a folder under ``packages/editor/src/main/packages`` that mirrors the
existing naming conventions (for example ``uml-state-diagram``). Typical files
include:

* ``<diagram>-element.ts`` classes extending ``UMLElement`` or
  ``UMLRelationship`` with default bounds and metadata.
* ``<diagram>-component.tsx`` React renderers.
* ``<diagram>-preview.ts`` functions returning ``PreviewElement`` instances for
  the palette.
* Optional popups under ``<diagram>-popup`` when the element needs inline
  editors.

3. Wire the palette and components
----------------------------------

Update the central registries so the editor can render and edit the new types:

* ``packages/editor/src/main/packages/components.ts``  
  Maps element/relationship types to React components.
* ``packages/editor/src/main/packages/uml-elements.ts``  
  Describes default properties per element (resizability, stereotype support,
  etc.).
* ``packages/editor/src/main/packages/uml-relationships.ts``  
  Registers relationship metadata (cardinality, routing style).
* ``packages/editor/src/main/packages/popups.ts``  
  Links element types to popup components when inline editing is needed.
* ``packages/editor/src/main/packages/compose-preview.ts`` and the switch
  statement inside ``components/create-pane/create-pane.tsx``  
  Add a ``compose<Diagram>Preview`` factory so the palette shows the new
  elements.

4. Provide translations
-----------------------

Add user-facing strings (palette labels, pop-up titles, validation errors) to
each locale in ``packages/editor/src/main/i18n/*.json``. Reuse the nested
structure already used by other diagram families.

5. Update persistence helpers
-----------------------------

If your diagram type participates in cross-diagram scenarios, consider the
following:

* For object-like diagrams that rely on class diagrams, extend the
  ``diagramBridge`` service so new metadata travels across diagrams. See
  :doc:`diagram-bridge` for details.
* Add the diagram type to the project store in the web application by updating
  ``packages/webapp/src/main/types/project.ts`` and the associated reducers.

6. Document and test
--------------------

* Extend ``docs`` or package-level README files with usage notes for the new
  diagram type.
* Add automated coverage under ``src/tests`` when practical, especially for
  utility functions, reducers, or serializers.

Validation checklist
--------------------

* The palette lists the new elements under the expected diagram type.
* Creating elements results in well-formed entries within ``editor.model``.
* Exported SVG/PNG/PDF render the new shapes correctly.
* Collaboration and JSON Patch flows include the new element types.
* Translations fall back gracefully when switching locales.

Once a diagram type ticks all the boxes, it is ready to be consumed by the
webapp or by external integrators using the ``@besser/wme`` package.
