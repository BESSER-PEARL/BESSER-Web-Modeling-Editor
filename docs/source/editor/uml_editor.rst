UML Editor
==========

The ``packages/library`` workspace exports the reusable UML modelling engine as
``@besser/wme``. It is a React + Zustand + React Flow application that renders
diagrams inside an arbitrary DOM container while exposing a programmatic API for
consumers to load models, listen for changes, and react to collaboration events.

Quick start
-----------

.. code-block:: typescript

   import { BesserEditor, UMLDiagramType, BesserMode } from '@besser/wme';

   const container = document.getElementById('diagram-root')!;

   const editor = new BesserEditor(container, {
     type: UMLDiagramType.ClassDiagram,
     mode: BesserMode.Modelling,
     readonly: false,
     enablePopups: true,
   });

   await editor.ready;  // Wait until React Flow finishes initialising

   editor.subscribeToModelChange((model) => {
     console.log('Model updated', model);
   });

   // Later, clean up:
   editor.destroy();

Architecture overview
---------------------

* **Library entry point** (``packages/library/lib/besser-editor.tsx``) constructs
  the ``BesserEditor`` class. The constructor wires up the React Flow root, the
  Zustand stores, and the Yjs document used for collaboration.
* **Nodes** (``packages/library/lib/nodes/<diagramType>/``) house the per-diagram
  React Flow node components — one folder per diagram (``classDiagram``,
  ``objectDiagram``, ``stateMachineDiagram``, …). The folder's ``index.ts``
  registers each node component under its v4 ``node.type`` string.
* **Edges** (``packages/library/lib/edges/edgeTypes/``) define the edge renderers
  (``ClassDiagramEdge``, ``StateMachineDiagramEdge``, ``AgentDiagramEdge``, …)
  and the shared connection / handle logic.
* **Inspectors** (``packages/library/lib/components/inspectors/<diagramType>/``)
  are the property panels surfaced when a node or edge is selected. Each diagram
  folder has an ``index.ts`` that maps node/edge types to inspector components.
* **Popovers** (``packages/library/lib/components/popovers/``) route inspector
  panels through ``PopoverManager.tsx`` — both the popover and the side panel
  modes.
* **Stores** (``packages/library/lib/store/``) are the canonical Zustand stores
  for diagram state (``diagramStore``), session metadata (``metadataStore``),
  popover state (``popoverStore``), assessment selection, and alignment guides.
* **Utils** (``packages/library/lib/utils/``) host the v3→v4 ``versionConverter``,
  the React Flow / B-UML adapters (``helpers.ts``), the layout helpers, and the
  shared display utilities (``classifierMemberDisplay``, ``multiplicity``,
  ``typeNormalization``).
* **Services** (``packages/library/lib/services/``) keep domain logic out of UI
  components: ``diagramBridge`` for cross-diagram data, ``settingsService`` for
  application settings, ``errors`` for the broadcast error channel, and
  ``userMetaModel`` for the bundled User-Diagram reference metamodel.

Consumers interact only with the public API exported from
``packages/library/lib/index.tsx``. Internal modules may change without notice,
so prefer the documented API surface unless you are contributing to the engine
itself.
