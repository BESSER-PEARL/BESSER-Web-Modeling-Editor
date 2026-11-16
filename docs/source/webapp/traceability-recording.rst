Traceability: what the editor records
=====================================

A project that records traces (``settings.traceabilityEnabled``, on for a project created in the
editor) keeps a *trace file* next to it (see :doc:`local-projects` for where it is stored). Its format
mirrors the backend's traceability metamodel (``besser/BUML/metamodel/traceability``) and is typed in
``shared/types/traceability.ts``: actors, tools, artifacts, operations and the trace links between
artifacts. This page lists what is recorded, by whom, and how the trace is kept bounded.

Schema version
--------------

The trace is version 6 (``TRACE_SCHEMA_VERSION``; 6 added ``revisionOfId`` on a code artifact, a file
version an LLM edited). Older traces, stored or imported, are migrated when read
(``traceMigration.ts``). A trace newer than the editor reads is refused with its own message. When a
backend refuses the version of a trace in a B-UML export, the export is sent again with the trace
written as version 5 (``downgradeTraceFile``); when an older backend leaves the trace out of the file,
the user is told.

Model edits
-----------

Every save of a diagram is compared with the previous version and recorded as a *modeling session*
(change by change: created, updated, deleted, with the feature, old and new value). Layout is never
a change. The comparison reduces each version to a snapshot of the elements that reach the B-UML
model, named by their B-UML metaclass (``Class``, ``State``, ``Task``, ``Conv2D``, ``Qubit``, ``KGClass``,
...):

* class diagrams: ``classModelDiff.ts``;
* GUI diagrams: ``guiModelDiff.ts`` (with the class-diagram elements each component is bound to);
* object, user, state machine, agent, BPMN, neural network, component and deployment diagrams: one
  generic builder, ``snapshotApollonModel`` in ``diagramModelDiff.ts``, driven by a table per type
  (``APOLLON_TABLES``: element type to metaclass, and members folded into their owner, such as an
  intent's training sentences or a layer's attribute elements);
* quantum circuits and knowledge graphs: their own builders in the same file (a gate is known by its
  cell, so moving it is a deletion and a creation).

The workspace store (``updateDiagramModelThunk``, ``updateQuantumDiagramThunk``) records every type;
the GUI, circuit and knowledge-graph editors, which save straight to storage, record their own saves.
Adding a diagram is recorded as its creation.

Who made a change
-----------------

* **The user**: a session of the editor tool, performed by the project owner.
* **The assistant**: a session performed by the owner and the assistant, its elements linked from
  the prompt of the request they answer (and from the requirements the assistant extracted). An edit
  that comes more than 30 s after its turn's last answer (``TURN_GRACE_MS``) answers no request.
  Undoing an assistant edit is the user's edit.
* **A model generator**: a session of a ``ModelGenerator`` tool, never merged with another, for
  everything the editor writes that the user did not draw: template loads, diagram and picture
  imports, the knowledge-graph to class-diagram conversion, the agent personalization restoring a
  base model, the GUI generator, and the inter-diagram derivations (BPMN to components, components
  to deployment, a lane to an agent). ``MODEL_GENERATORS`` in ``traceStore.ts`` names them. The
  element lineage a derivation writes (``project.elementLineage``) is recorded as trace links from
  each source element to the element derived from it (``recordElementLineage``); the KG conversion,
  which reports no lineage, links elements of the same name.

The GUI editor and the store compare a GUI with one baseline (``setGuiBaseline``), so a GUI the
assistant wrote is recorded once, and what the GUI generator produced is recorded when it ends, not
attributed to the user's next auto-save.

The assistant's model
---------------------

Each turn with the assistant is a call to an LLM in a *conversation* operation. A terminal reply of the
modeling agent carries ``llmUsage`` (model, provider, input and output tokens; running totals of the
turn): the turn is then filed under that model with its tokens, and the latest totals win. An agent
that does not report it leaves the turn under a tool named "unknown model (not reported by the
assistant)".

Generation runs
---------------

When the project records traces, every generator goes through the traced endpoints
(``shared/api/traceability.ts``): ``/traceability/generate-output`` for one diagram (the diagram's id names
the model in the trace) and ``/traceability/generate-output-from-project`` for the project generators.
Each returns the same file as the plain endpoint plus a trace fragment, merged into the project trace
(``mergeTraceFragment``): models are matched by element id, artifacts the trace already has (a
requirement) by id, actors by name and tools by name, version and provider; a fragment merged twice is
merged once. When the traced request fails, the plain endpoint is called so the file is still
delivered, and the user is told the trace of this run was not recorded.

A Spec-Driven run is recorded from the ``trace`` its ``done`` event carries; the requirements sent with
the run are RequirementArtifact ids, so its requirement-to-code links join them. A backend that sends
no trace still leaves the run in the trace: one operation built from the stream's events
(``recordSpecDrivenRun``).

Retention
---------

The trace must fit in the browser, so generation runs are bounded per generator (the tools a run
called; ``pruneOldGenerations``):

#. the newest 5 runs keep everything: links, line ranges and files;
#. runs 6 to 20 keep their operation and their whole files, with hashes but no content; their links
   and line ranges are dropped;
#. older runs are removed with every file they wrote.

Independently, only the newest 3 files of each path keep their content (``pruneStoredContents``), and
only the newest one when the storage is full. Modeling sessions and conversations are kept.

Export and import
-----------------

An export of the whole project bundles the whole trace. An export of some diagram types bundles the
part about them (``traceOfDiagrams`` in ``traceSubset.ts``): their elements, the files of the runs that
read them, the prompts and requirements they come from, and the operations, links, actors and tools
about those. Importing a project checks its trace first and stores it only once the project itself
is stored.
