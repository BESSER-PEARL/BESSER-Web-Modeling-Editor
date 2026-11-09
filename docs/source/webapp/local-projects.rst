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

``BesserProject.assistantConversation``
   Optional. The modeling assistant's conversation (its latest 50 user and
   assistant turns, each cut to 4000 characters), so the user's specification
   is kept with the project. It is saved with the project in the browser and,
   being part of the project file, written to ``buml/diagrams.json`` on a GitHub
   save; provider tokens are redacted from it there like from the rest of the
   model, and the BYOK key stored in the tab is replaced before it is kept at
   all. Opening a project that has no conversation in this browser (below)
   restores it; a field that is not
   a list of turns restores nothing. Generation requests and gists leave it
   out.

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
* ``besser_github_link_<projectId>`` is the project's one GitHub repository
  (``shared/services/storage/projectGitHubLink.ts``): owner, repo and branch,
  the commit last synced (``baseCommitSha``) with a fingerprint of the model at
  that commit, a model BESSER proposed from the repo's code until it is
  accepted, and ``pendingChange``, a save or push waiting on its own branch for
  a pull request. Every GitHub path reads and writes this one record.
* ``besser_assistant_conversation_v2_<projectId>`` is the project's full
  assistant conversation in this browser (``shared/services/storage/assistantStorage.ts``):
  the latest 100 messages within 200K characters, run cards and message
  details included, with the stored BYOK key removed. Every tab that opens the
  project shows it and continues it; a tab already open on the project picks
  up another tab's turns through the ``storage`` event, and its next message
  starts a new agent session that carries the history. A new chat is stored as
  an empty conversation with a new id, so it clears the other tabs too. The 20
  most recently saved conversations are kept, within 1M characters together;
  deleting a project deletes its conversation, and a project save that finds
  storage full drops them all and retries. When a project has none here, the
  text copy in ``assistantConversation`` is restored. Before v8.9.3 the
  conversation lived in ``sessionStorage``, one per tab
  (``besser_assistant_conversation_v1``). The first project a tab opens takes
  that copy once when it is under 48 hours old, the project has no
  conversation in this browser yet, and the project's text copy matches it or
  is absent; otherwise it is dropped.
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
