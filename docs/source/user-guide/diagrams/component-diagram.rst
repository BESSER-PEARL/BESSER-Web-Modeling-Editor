Component Diagrams
==================

Component diagrams describe the logical structure of a system at the component
level. In the agentic modeling workflow, they are the first architectural view of a multi-agent system:
agentic BPMN lanes become agent Components, pools become Subsystems, and
cross-lane interactions become Component dependencies.

Creating a Component Diagram
----------------------------

Create a Component diagram from the sidebar like any other diagram type, or
open an agentic BPMN diagram and select **Generate > Generate Component
diagram**. Generation creates a new Component diagram every time; existing
Component diagrams are not overwritten.

Palette Elements
----------------

The Component palette provides:

* **Component**: a deployable or logical unit of behaviour. Agent Components
  are identified by their stereotype.
* **Subsystem**: a larger grouping container. Generated diagrams use
  Subsystems for BPMN pools.
* **Interface**: a provided or required service boundary for Components.

Create relationships by connecting elements on the canvas. Component
dependencies can show a stereotype label on the edge.

Stereotypes and Agentic Notation
--------------------------------

Component elements and dependencies have a **Stereotype** field in their popup.
The field accepts free text and also provides presets for common agentic tokens.

For Components, the main role tokens are:

* ``solution``
* ``supervision``
* ``collaboration``
* ``consensus``

A Component with one of these role stereotypes is shown with the agent marker.
Capability Components use stereotypes such as ``skill``, ``tool``, ``llm``,
``db``, and ``rag``. These represent resources used by agents rather than
agents themselves.

For Component dependencies, common stereotypes include:

* ``delegates``
* ``supervises``
* ``revises``
* ``collaborates``
* ``has``
* ``uses``

Derived Component Diagrams
--------------------------

When generated from BPMN, the derivation uses these mappings:

* BPMN pools become Component Subsystems.
* Agentic lanes become agent Components.
* Cross-lane sequence flows become Component dependencies.
* Linked Agent diagrams can contribute tool, skill, LLM, database, and RAG
  capability Components.
* Lane-to-Agent links are kept on the generated agent Components so later
  derivations can keep the implementation connection.

Generated diagrams can show a **Derived from** banner. Derived elements can
also show source links in their popups. These links help trace a Component back
to the BPMN pool, lane, task, or flow that produced it.

Generating a Deployment Diagram
-------------------------------

Open a Component diagram and select **Generate > Generate Deployment diagram**.
The editor creates a new Deployment diagram and records lineage back to the
source Component diagram. If the Component diagram was itself generated from
BPMN, lane copy counts are carried forward to Deployment artifacts.
