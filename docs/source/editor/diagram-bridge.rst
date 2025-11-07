Diagram Bridge Service
======================

Object diagrams, agent diagrams, and other consumers often need structural
information defined in class diagrams. The diagram bridge service provides a
shared channel for exchanging that data without tightly coupling diagram
implementations.

Location
--------

``packages/editor/src/main/services/diagram-bridge/diagram-bridge-service.ts``
exports:

* The ``DiagramBridgeService`` class (implementation).
* The singleton ``diagramBridge`` instance used across the editor and webapp.
* Type definitions (``IClassDiagramData``, ``IClassInfo``, ``IAssociationInfo``).

Data flow
---------

1. When a class diagram becomes the active diagram, the webapp (see
   ``packages/webapp/src/main/services/project/projectSlice.ts``) pushes the
   current model into ``diagramBridge.setClassDiagramData``.
2. Consumers (object diagrams, agent diagrams, validation routines) query the
   bridge for classes, attributes, associations, or related classes whenever
   they need to populate dropdowns or validate references.
3. Data is cached in memory and persisted in ``localStorage`` under the key
   ``besser-class-diagram-bridge-data`` to survive reloads.

Key capabilities
----------------

``setClassDiagramData(data)``
   Stores the raw ``UMLModel`` snapshot (elements + relationships) for later
   queries. Automatically persists to ``localStorage`` as a backup.

``getClassDiagramData()``
   Returns the latest stored data or ``null`` when none is available. Falls
   back to ``localStorage`` if memory has been cleared.

``getAvailableClasses()``
   Produces a collection of ``IClassInfo`` objects enriched with inherited
   attributes. The service walks ``ClassInheritance`` relationships so object
   diagrams can offer inherited attributes in their forms.

``getAvailableAssociations(sourceId, targetId)``
   Lists associations (excluding inheritance/realisation links) that connect the
   two classes, including associations inherited through parent classes.

``getRelatedClasses(classId)``
   Returns classes reachable via non-inheritance relationships plus classes that
   inherit from, or are inherited by, those related classes. Useful when
   building contextual dropdowns.

``getClassHierarchy(classId)`` and ``getClassById(classId)``
   Debug-oriented helpers that expose the inheritance chain and allow verifying
   that classes are correctly registered.

``clearDiagramData()`` / ``hasClassDiagramData()``
   Maintenance utilities used when switching projects or flushing cached data.

Usage tips
----------

* Always call ``diagramBridge.setClassDiagramData`` after persisting a class
  diagram so other diagrams stay in sync. The project slice already handles this
  when switching diagram types, but the same rule applies in custom
  integrations.
* Guard calls to ``getAvailableClasses`` and related helpers with
  ``hasClassDiagramData()`` to avoid dereferencing ``null`` when the user has
  not created a class diagram yet.
* The bridge stores raw element objects. Avoid mutating objects returned by the
  helpers; clone them first if you need to enrich the data.
