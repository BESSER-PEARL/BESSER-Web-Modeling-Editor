Local Projects
==============

The webapp stores user projects entirely in the browser. Each project can contain
**multiple diagrams per type** and tracks the active diagram for each type.
Understanding the layout of this storage makes it easier to add new features or
diagnose issues.

Data model
----------

``packages/webapp/src/main/shared/types/project.ts`` defines the core types:

``BesserProject``
   Project metadata (name, description, owner, timestamps), current diagram type
   (`SupportedDiagramType`), ``currentDiagramIndices`` (tracks the active diagram
   index per type), and a ``diagrams`` map with a **list** of ``ProjectDiagram``
   entries for each supported type (Class, Object, State Machine, Agent, GUI,
   Quantum Circuit).

``ProjectDiagram``
   Holds the diagram ``id``, ``title``, optional ``model`` (``UMLModel``, ``GrapesJSProjectData``, or ``QuantumCircuitData`` depending on diagram type),
   ``lastUpdate`` timestamp, free-form description, and optional ``references``
   (a map of diagram type to referenced diagram ID for cross-diagram resolution).
   The initial model is a basic diagram created via ``createEmptyDiagram``.

``SupportedDiagramType`` / ``toUMLDiagramType``  
   Guard the subset of diagram types available through the project UI.

Persistence
-----------

``ProjectStorageRepository`` (``shared/services/storage/ProjectStorageRepository.ts``)
handles read/write operations:

* Projects are serialised to JSON and stored in ``localStorage`` under keys with
  the ``besser_project_`` prefix.
* ``besser_latest_project`` points to the most recently opened project.
* ``besser_projects`` lists all known project IDs to populate the home modal.
* Helper methods exist to save projects, switch active diagram types, retrieve
  metadata lists, and delete projects safely.

Redux slice
-----------

A single unified slice coordinates project and diagram state with the editor:

``workspaceSlice`` (``app/store/workspaceSlice.ts``)
   Manages the current project, active diagram, diagram switching, editor
   options, autosave logic, and updates to diagram metadata. Async thunks
   load projects from storage, create new projects, and keep the editor
   in sync. It also updates the diagram bridge when object diagrams need
   class diagram context. All diagram edits flow back through the
   ``updateDiagramModelThunk`` thunk.

Adding a new supported diagram type
-----------------------------------

1. Introduce the type in ``SupportedDiagramType`` and update
   ``toSupportedDiagramType`` / ``toUMLDiagramType``.
2. Extend ``createDefaultProject`` to initialise the new diagram.
3. Update `ProjectStorageRepository` to understand the new diagram key if any
   specialised logic applies.
4. Extend the project and diagram slices to handle switching, creation, and
   persistence of the new diagram type.
5. Update UI components (sidebar selectors, templates, modals) to expose the
   diagram to end users.

Troubleshooting tips
--------------------

* Inspect the browser's ``localStorage`` entries prefixed with ``besser_`` to
  confirm projects persist as expected.
* ``loadProjectThunk`` logs warnings when the persisted structure no longer
  matches the expected schema. Resetting the offending project entry usually
  resolves legacy issues.
* When project synchronisation fails, ``updateDiagramThunk`` propagates the
  error—check the console output to identify write failures or serialisation
  issues.
