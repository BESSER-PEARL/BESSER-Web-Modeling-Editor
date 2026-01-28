Local Projects
==============

The webapp stores user projects entirely in the browser. Each project maintains
one diagram per supported type and tracks the active diagram for the session.
Understanding the layout of this storage makes it easier to add new features or
diagnose issues.

Data model
----------

``packages/webapp/src/main/types/project.ts`` defines the core types:

``BesserProject``
   Project metadata (name, description, owner, timestamps), current diagram type
   (`SupportedDiagramType`), per-diagram settings, and a ``diagrams`` map with a
   ``ProjectDiagram`` entry for each supported type (Class, Object, State
   Machine, Agent).

``ProjectDiagram``
   Holds the diagram ``id``, ``title``, optional ``model`` (``UMLModel``),
   ``lastUpdate`` timestamp, and free-form description. The initial model is a
   basic diagram created via ``createEmptyDiagram``.

``SupportedDiagramType`` / ``toUMLDiagramType``  
   Guard the subset of diagram types available through the project UI.

Persistence
-----------

``ProjectStorageRepository`` (``services/storage/ProjectStorageRepository.ts``)
handles read/write operations:

* Projects are serialised to JSON and stored in ``localStorage`` under keys with
  the ``besser_project_`` prefix.
* ``besser_latest_project`` points to the most recently opened project.
* ``besser_projects`` lists all known project IDs to populate the home modal.
* Helper methods exist to save projects, switch active diagram types, retrieve
  metadata lists, and delete projects safely.

Redux slices
------------

Two slices coordinate project state with the editor:

``projectSlice`` (``services/project/projectSlice.ts``)
   Manages the current project, active diagram, diagram switching, and updates
   to diagram metadata. Async thunks load projects from storage, create new
   projects, and keep the diagram slice in sync. It also updates the diagram
   bridge when object diagrams need class diagram context.

``diagramSlice`` (``services/diagram/diagramSlice.ts``)
   Keeps the editor options, autosave logic, and current diagram instance in
   lockstep with project changes. All edits flow back into ``projectSlice`` via
   the ``updateCurrentDiagramThunk`` thunk.

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
