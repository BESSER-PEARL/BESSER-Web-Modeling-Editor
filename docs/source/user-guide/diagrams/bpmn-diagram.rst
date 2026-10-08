BPMN Diagrams
=============

BPMN (Business Process Model and Notation) diagrams let you model the flow of
work across tasks, events, and decision points, optionally partitioned into
pools and lanes to show which participant is responsible for each step. The WME
BPMN editor follows the definition of `BPMN models <https://besser.readthedocs.io/en/latest/buml_language/model_types/bpmn.html>`_.

Projects that use the **Multi-Agent** modeling perspective can additionally
annotate lanes, tasks, and gateways as agentic and derive Agent, Component, and
Deployment diagrams from the process. See `Agentic BPMN`_ below.

Pools and Lanes
---------------

A **Pool** represents one participant (an organisation, a system, or a role).
Drag a Pool from the sidebar onto the canvas to create it. Pools can be
resized by dragging their borders.

A **Lane** partitions a pool into responsibility zones. Drop a Lane inside an
existing Pool. Flow nodes placed inside a lane are automatically assigned to
that lane's process; you can re-assign them by dragging them into another lane.

When a diagram has no pools, all flow nodes belong to a single implicit
process.

Tasks
-----

Tasks are the basic units of work. Seven concrete types are available in the
palette:

*   **Default Task**: a generic task with no specific marker.
*   **User Task**: performed by a human actor (person icon).
*   **Service Task**: executed by a system or service (gear icon).
*   **Send Task**: sends a message to an external participant (filled envelope).
*   **Receive Task**: waits for a message from an external participant (empty envelope).
*   **Manual Task**: carried out without system support (hand icon).
*   **Script Task**: executes a script (scroll icon).

Double-click any task to rename it. Click the task to open its property popup
and change its type or loop characteristics (none / standard loop / parallel
multi-instance / sequential multi-instance).

Events
------

Events mark something that happens during a process. Three positions are
available:

*   **Start Event**: the entry point of a process (thin circle). Drag onto the
    canvas or inside a pool to create. Supported triggers: none (default),
    Message, Timer, Conditional, Signal, Escalation, Error, Compensation, Link.
*   **Intermediate Event**: occurs between start and end (double circle).
    Catch variants (Message, Timer, Conditional, Signal, Link) and throw
    variants (Message, Timer, Signal, Escalation, Compensation, Link) are both
    supported.
*   **End Event**: the final state of a process (thick circle). Supported
    results: none (default), Message, Signal, Error, Escalation, Compensation,
    Terminate.

Click an event to select its trigger or result type in the property popup.

Gateways
--------

Gateways control how sequence flows split and merge:

*   **Exclusive (XOR)**: only one outgoing path is taken (X marker).
*   **Inclusive (OR)**: one or more paths may be taken (circle marker).
*   **Parallel (AND)**: all paths are taken simultaneously (+ marker).
*   **Complex**: custom merge/split logic (asterisk marker).
*   **Event-based**: the next event to occur determines the path (pentagon
    marker).

One outgoing sequence flow may be marked as the **default flow** (diagonal
slash marker) on Exclusive, Inclusive, and Complex gateways, and on any Task.
Set it in the flow's property popup.

Sequence and Message Flows
--------------------------

**Sequence flows** connect flow nodes within the same process or sub-process.
Draw one by hovering over a source element until the blue connection handles
appear, then drag to the target.

**Message flows** connect elements across pool boundaries. They can connect
pools to pools, tasks to pools, or tasks to tasks in different pools. Draw them
the same way as sequence flows; the editor detects the cross-pool target
automatically.

Data Elements
-------------

*   **Data Object**: a piece of data used or produced by a task within a
    process. Connect it to tasks with **Data Associations**.
*   **Data Store**: a persistent data repository shared across the whole model
    (database cylinder icon).

Artifacts
---------

*   **Text Annotation**: attach a free-text note to any element via an
    Association.
*   **Group**: a dashed rectangle that visually groups elements without
    affecting flow.

Exporting
---------

To export a BPMN diagram:

1.  Open the diagram in the editor.
2.  Click **Export** in the top bar.
3.  Select **Export as BPMN (.bpmn)**.

The downloaded ``.bpmn`` file is BPMN 2.0.2-conformant and includes Diagram
Interchange (DI) information so the layout is preserved when the file is opened
in Camunda Modeler, bpmn.io, or any other conformant tool.

Importing
---------

**From a BPMN XML file (.bpmn)**

1.  Click **Import** in the top bar.
2.  Select **Import BPMN (.bpmn)**.
3.  Choose a ``.bpmn`` file exported from the WME or from another BPMN tool.

The editor reconstructs pools, lanes, all flow node types, sequence and message
flows, and DI layout from the file.

**From a B-UML Python file (.py)**

1.  Click **Import** in the top bar.
2.  Select **Import B-UML (.py)**.
3.  Choose a ``.py`` file generated by the
    `BESSER BPMN generator <https://besser.readthedocs.io/en/latest/generators/bpmn.html>`_.

The B-UML import executes the Python source to reconstruct the ``BPMNModel``
and converts it to WME JSON. Layout information is not preserved; the editor
auto-positions the elements.

Validation
----------

The WME BPMN editor highlights structural issues as you model:

*   Every sequence flow must have a valid source and target within the same
    container.
*   Message flows must cross pool boundaries.
*   A default flow may only be set on a Task, or on an Exclusive, Inclusive, or
    Complex Gateway.
*   Each pool must reference exactly one process.
*   Lane membership must be consistent with the enclosing process.

Errors are shown in the validation panel. Warnings (e.g. unreachable flow
nodes) are shown separately and do not block export.

.. _agentic-bpmn:

Agentic BPMN
------------

Agentic BPMN is an opt-in extension for modeling multi-agent systems on top of
an ordinary BPMN process. It lets you mark lanes, tasks, and gateways as
agentic and then derive the architecture of the system step by step: an Agent
diagram per agent, a :doc:`Component diagram <component-diagram>`, a
:doc:`Deployment diagram <deployment-diagram>`, and finally Docker Compose
files.

.. note::
   The **Agentic** toggles on lanes, tasks, and gateways are only shown when
   the BPMN, Agent, Component, and Deployment diagram types are all shown in
   Project Settings ▸ **Modeling Perspectives** (see :doc:`index`), for
   example with the **Multi-Agent** or **Show All** preset. Otherwise the BPMN
   editor behaves as a plain BPMN editor.

Agentic Lanes
~~~~~~~~~~~~~

Click a lane and enable **Agentic** when the lane represents an agent. An
agentic lane shows a bot marker, a role badge, and its trust score in the lane
header, and exposes these fields:

*   **Role**: free text, with **Solution** and **Supervision** as presets. The
    role becomes the stereotype of the agent Component when a Component
    diagram is generated, and decides the kind of dependency derived from a
    cross-lane flow (``supervises``, ``revises``, ``collaborates``, or
    ``delegates``).
*   **Trust score (0-100)**: the trust value associated with the agent.
*   **Copies (≥1)**: how many identical copies of the agent run. Values above
    one are shown as ``×N`` in the lane header and are carried through to the
    artifact names of a derived Deployment diagram.
*   **Define agent behavior** / **Open agent behavior**: creates (or opens) the
    Agent diagram that implements the lane. A newly created Agent diagram is
    populated from the lane: one state per task, transitions from the
    sequence flows inside the lane, an initial node for each entry task, and
    agent-to-agent send/receive steps for flows that cross lane boundaries.

Agentic Tasks
~~~~~~~~~~~~~

Enable **Agentic** on a task when the task is performed by an agent. The task
shows a bot marker instead of its type icon and exposes:

*   **Reflection mode**: No reflection, Self-reflection, Cross-reflection, or
    Human-reflection. A letter marker on the task shows the selected mode.
*   **Reviewer agent**: for Cross-reflection, the agentic lane that reviews the
    task.
*   **Trust score (0-100)**: the task-level trust value.
*   **Define agent behavior** / **Open agent behavior**: creates (or opens) an
    empty Agent diagram linked to the task.

When an Agent diagram is derived from a lane, the reflection mode of each task
shapes the generated states: Self-reflection adds a reflection state after the
task, Human-reflection adds a human review state with *approved* and *rejected*
transitions, and Cross-reflection sends the task's result to the reviewer
agent.

Agentic Gateways and Governance
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Only **Parallel** and **Inclusive** gateways can be made agentic. An agentic
gateway has a **Trust score (0-100)** and a role that delimits a collaboration
block:

*   **Diverging** gateways open an agentic collaboration block.
*   **Merging** gateways close it. The Merging option is only offered when an
    agentic diverging gateway exists upstream. Changing the type of a diverging
    gateway between Parallel and Inclusive updates its merging gateways too.

Merging gateways expose a **Governance policy (DSL)** editor. Write the policy
directly, or choose a **Decision policy** (Majority, Absolute majority,
Leader-driven, or Consensus) and click **Generate** to insert a skeleton. When
the gateway already has a policy, the button reads **Regenerate** and asks
for confirmation before replacing it. A merging gateway with a non-empty policy
shows a governance badge on the canvas. The policy is checked by the backend
when Docker Compose files are generated; an invalid policy is reported with
the name of the gateway.

Agentic fields round-trip through ``.bpmn`` export and import: they are written
to a WME extension namespace that other BPMN tools ignore, and the governance
policy is stored as CDATA so its line breaks are preserved.

From Process to Deployment
~~~~~~~~~~~~~~~~~~~~~~~~~~

1.  **Model the process.** Draw pools and lanes, mark the agent lanes as
    agentic, and add the agentic tasks and gateways. **File ▸ Load Template**
    includes the *Agentic Bug-fixing Process* BPMN template as a starting point.
2.  **Define the agents.** Use **Define agent behavior** on each agentic lane
    to generate its Agent diagram, then refine it in the Agent editor (see
    :doc:`agent-diagram`).
3.  **Generate the Component diagram.** With the BPMN diagram open, choose
    **Generate ▸ Generate Component diagram**. Pools become Subsystems, agentic
    lanes become agent Components, and cross-lane and cross-pool flows become
    Component dependencies. Tools, skills, LLMs, databases, and RAG resources
    configured in linked Agent diagrams are added as capability Components.
    Non-agentic lanes are skipped. The process needs at least one pool with a
    lane. See :doc:`component-diagram`.
4.  **Generate the Deployment diagram.** With the Component diagram open,
    choose **Generate ▸ Generate Deployment diagram**. See
    :doc:`deployment-diagram`.
5.  **Generate Docker Compose.** With the Deployment diagram open, choose
    **Generate ▸ Generate Docker Compose** to download the Compose files.

Each generation step creates a new diagram and never overwrites an existing
one. Derived diagrams show a **Derived from** banner, and derived elements
show a link back to the element they came from.
