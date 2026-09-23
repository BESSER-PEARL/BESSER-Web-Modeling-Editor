BPMN Diagrams
=============

BPMN (Business Process Model and Notation) diagrams let you model the flow of
work across tasks, events, and decision points, optionally partitioned into
pools and lanes to show which participant is responsible for each step. The WME
BPMN editor follows the definition of `BPMN models <https://besser.readthedocs.io/en/latest/buml_language/model_types/bpmn.html>`_
and also supports agentic BPMN annotations used to connect a process model with
agent, Component, and Deployment diagrams.

Pools and Lanes
---------------

A **Pool** represents one participant, such as an organisation, a system, or a
role. Drag a Pool from the sidebar onto the canvas to create it. Pools can be
resized by dragging their borders.

A **Lane** partitions a pool into responsibility zones. Drop a Lane inside an
existing Pool. Flow nodes placed inside a lane are automatically assigned to
that lane's process; you can reassign them by dragging them into another lane.

When a diagram has no pools, all flow nodes belong to a single implicit process.

Agentic Lanes
~~~~~~~~~~~~~

Click a lane and enable **Agentic** when the lane represents an agent in the
process. Agentic lanes show an agent marker in the lane header and expose these
fields:

* **Role**: classifies the agent as Solution, Supervision, Collaboration, or
  Consensus. This role is also used when generating Component dependencies from
  cross-lane sequence flows.
* **Trust score (0-100)**: records the confidence or trust value associated
  with the agentic participant.
* **Copies (>=1)**: records how many copies of the lane agent should exist.
  Values above one are shown as a lane-header count and are carried through
  derived Deployment artifacts.
* **Define BESSER agent** / **Open Agent diagram**: creates or opens the Agent
  diagram that implements the lane. The generated Agent diagram is linked back
  to the lane and can later contribute tools, skills, LLM, database, and RAG
  resources when generating a Component diagram.

Tasks
-----

Tasks are the basic units of work. Seven concrete types are available in the
palette:

* **Default Task**: a generic task with no specific marker.
* **User Task**: performed by a human actor (person icon).
* **Service Task**: executed by a system or service (gear icon).
* **Send Task**: sends a message to an external participant (filled envelope).
* **Receive Task**: waits for a message from an external participant (empty
  envelope).
* **Manual Task**: carried out without system support (hand icon).
* **Script Task**: executes a script (scroll icon).

Double-click any task to rename it. Click the task to open its property popup
and change its type or loop characteristics (none / standard loop / parallel
multi-instance / sequential multi-instance).

Agentic Tasks
~~~~~~~~~~~~~

Enable **Agentic** on a task when the task is part of agentic behaviour. The
task displays an agent marker and can define:

* **Reflection mode**: No reflection, Self-reflection, Cross-reflection, or
  Human-reflection.
* **Reviewer agent**: for cross-reflection, the agentic lane that reviews the
  task.
* **Trust score (0-100)**: the task-level trust value.

Cross-reflection and cross-lane handoffs are used when deriving Agent diagrams
from agentic lanes. Where needed, the derived Agent diagram includes A2A
send/receive metadata for inter-agent communication.

Events
------

Events mark something that happens during a process. Three positions are
available:

* **Start Event**: the entry point of a process (thin circle). Supported
  triggers: none, Message, Timer, Conditional, Signal, Escalation, Error,
  Compensation, Link.
* **Intermediate Event**: occurs between start and end (double circle). Catch
  variants and throw variants are both supported depending on the selected
  event definition.
* **End Event**: the final state of a process (thick circle). Supported
  results: none, Message, Signal, Error, Escalation, Compensation, Terminate.

Click an event to select its trigger or result type in the property popup.

Gateways
--------

Gateways control how sequence flows split and merge:

* **Exclusive (XOR)**: only one outgoing path is taken (X marker).
* **Inclusive (OR)**: one or more paths may be taken (circle marker).
* **Parallel (AND)**: all paths are taken simultaneously (+ marker).
* **Complex**: custom merge/split logic (asterisk marker).
* **Event-based**: the next event to occur determines the path (pentagon
  marker).

One outgoing sequence flow may be marked as the **default flow** on Exclusive,
Inclusive, and Complex gateways, and on any Task. Set it in the flow's property
popup; the canvas shows the BPMN default-flow slash marker.

Agentic Gateways and Governance
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Enable **Agentic** on Inclusive or Parallel gateways to mark a collaboration
block boundary:

* **Diverging** gateways start an agentic collaboration block.
* **Merging** gateways close an upstream agentic collaboration block.

Merging gateways expose **Governance policy (DSL)**. You can write the policy
directly in the editor or choose a **Decision policy** and click **Generate** to
seed a Governance DSL skeleton. If the gateway already has DSL text,
**Regenerate** asks for confirmation before replacing it.

Generated policy choices include Majority, Absolute majority, Leader-driven,
and Consensus. The policy text remains editable after generation. A governance
badge appears on a merging gateway when it has non-empty DSL text.

Governance DSL is saved as part of the BPMN model and round-trips through BPMN
XML export/import in the agentic extension block. The DSL text is stored inside
a CDATA section so line breaks and policy syntax are preserved.

Sequence and Message Flows
--------------------------

**Sequence flows** connect flow nodes within the same process or sub-process.
Draw one by hovering over a source element until the connection handles appear,
then drag to the target.

**Message flows** connect elements across pool boundaries. They can connect
pools to pools, tasks to pools, or tasks to tasks in different pools. Draw them
the same way as sequence flows; the editor detects the cross-pool target
automatically.

Data Elements and Artifacts
---------------------------

* **Data Object**: a piece of data used or produced by a task within a process.
  Connect it to tasks with **Data Associations**.
* **Data Store**: a persistent data repository shared across the whole model.
* **Text Annotation**: attach a free-text note to any element via an
  Association.
* **Group**: a dashed rectangle that visually groups elements without affecting
  flow.

Templates
---------

Open **File > Start from Template** and choose the BPMN category to load a BPMN
starter model. The **Agentic Bug-fixing Process** template demonstrates
agentic lanes, agentic tasks, governance, and the inter-diagram generation path.

Inter-Diagram Generation
------------------------

When a BPMN diagram contains agentic lanes, open the **Generate** menu and
select **Generate Component diagram**. The editor creates a new Component
diagram every time; it does not overwrite existing Component diagrams.

The derivation maps pools to Subsystems, agentic lanes to agent Components, and
cross-lane sequence flows to Component dependencies. Linked Agent diagrams can
contribute capability Components such as tools, skills, LLM, database, and RAG
resources.

Agentic lanes can also create or open their implementation Agent diagram from
the lane popup. The generated Agent diagram is populated from the lane's tasks
and sequence flows and keeps a visible link back to the source lane.

Exporting
---------

To export a BPMN diagram:

1. Open the diagram in the editor.
2. Click **Export** in the top bar.
3. Select **Export as BPMN (.bpmn)**.

The downloaded ``.bpmn`` file is BPMN 2.0.2-conformant and includes Diagram
Interchange (DI) information so the layout is preserved when the file is opened
in Camunda Modeler, bpmn.io, or another conformant tool. WME-specific agentic
fields are stored in an extension namespace so WME can restore them on import.

Importing
---------

**From a BPMN XML file (.bpmn)**

1. Click **Import** in the top bar.
2. Select **Import BPMN (.bpmn)**.
3. Choose a ``.bpmn`` file exported from the WME or from another BPMN tool.

The editor reconstructs pools, lanes, all flow node types, sequence and message
flows, DI layout, and supported WME agentic extension fields.

**From a B-UML Python file (.py)**

1. Click **Import** in the top bar.
2. Select **Import B-UML (.py)**.
3. Choose a ``.py`` file generated by the
   `BESSER BPMN generator <https://besser.readthedocs.io/en/latest/generators/bpmn.html>`_.

The B-UML import executes the Python source to reconstruct the ``BPMNModel``
and converts it to WME JSON. Layout information is not preserved; the editor
auto-positions the elements.

Validation
----------

The WME BPMN editor highlights structural issues as you model:

* Every sequence flow must have a valid source and target within the same
  container.
* Message flows must cross pool boundaries.
* A default flow may only be set on a Task, or on an Exclusive, Inclusive, or
  Complex Gateway.
* Each pool must reference exactly one process.
* Lane membership must be consistent with the enclosing process.
* Agentic merging gateways must belong to a valid upstream agentic
  collaboration block.

Errors are shown in the validation panel. Warnings are shown separately and do
not block export.
