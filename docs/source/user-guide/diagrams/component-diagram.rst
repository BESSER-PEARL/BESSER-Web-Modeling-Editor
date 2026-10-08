Component Diagrams
==================

Component diagrams describe the logical structure of a system at the component
level: the components it is made of, the subsystems that group them, and the
interfaces and dependencies between them. In the multi-agent workflow, the
Component diagram is the first architectural view derived from an
:ref:`agentic BPMN process <agentic-bpmn>`: agentic lanes become agent
Components, pools become Subsystems, and interactions between lanes become
Component dependencies.

The Component diagram type is part of the **Multi-Agent** modeling perspective
(see :doc:`index`).

Creating a Component Diagram
----------------------------

Create a Component diagram from the sidebar like any other diagram type, or
open an agentic BPMN diagram and select **Generate ▸ Generate Component
diagram**. Generation creates a new Component diagram every time; existing
Component diagrams are not overwritten.

Palette Elements
----------------

The Component palette provides:

*   **Component**: a logical unit of behaviour. Components whose stereotype
    names an agent role are drawn with a bot marker.
*   **Subsystem**: a larger grouping container. Generated diagrams use
    Subsystems for BPMN pools.
*   **Interface**: a service boundary that Components provide or require.

Connect elements on the canvas to create relationships. In the relationship
popup you can switch between **Dependency**, **Provided Interface**, and
**Required Interface**. Dependencies can carry a stereotype, shown as a label
on the edge.

Stereotypes and Agentic Notation
--------------------------------

Components and dependencies have a **Stereotype** field in their popup. The
field accepts free text and offers a **Preset** list with common tokens.

Component presets:

*   Agent roles: ``solution`` and ``supervision``. A Component with one of these
    tokens is treated as an agent and shows the bot marker.
*   Capabilities: ``skill``, ``tool``, ``llm``, ``db``, and ``rag``. These are
    resources used by agents rather than agents themselves.
*   Locality: ``local``, ``external``, and ``hybrid``.

Dependency presets:

*   Between agents: ``delegates``, ``supervises``, ``revises``, and
    ``collaborates``.
*   Between agents and capabilities: ``has``, ``uses``, and ``granted``.
*   For capabilities: ``implements``.

A Component's popup also has a **Realizes** field that links the Component to
classes, interfaces, or enumerations defined in other diagrams of the project.

Derived Component Diagrams
--------------------------

When generated from BPMN, the derivation uses these mappings:

*   BPMN pools with at least one agentic lane become Subsystems. A pool without
    lanes that is the target of a message flow becomes an external Subsystem.
*   Agentic lanes become agent Components. The lane's role becomes the
    Component stereotype. Non-agentic lanes are skipped.
*   Sequence flows between lanes and message flows between pools become
    dependencies. The stereotype of a dependency between two agentic lanes
    follows their roles: a supervision lane handing work to a solution lane gives ``supervises``, the
    reverse gives ``revises``, two solution lanes give ``collaborates``, and
    anything else gives ``delegates``.
*   Tools, skills, LLMs, databases, and RAG resources configured in the Agent
    diagrams linked to a lane or its tasks become capability Components. They
    are grouped by kind, created once per name, and connected to each agent
    that uses them with a ``has`` (skills) or ``uses`` (other resources)
    dependency.
*   The link from a lane to its Agent diagram is kept on the agent Component, so
    a later Deployment derivation can attach the agent implementation.

Generated diagrams show a **Derived from** banner. Derived elements also show
a link in their popups back to the BPMN element that produced them.

Generating a Deployment Diagram
-------------------------------

Open a Component diagram and select **Generate ▸ Generate Deployment diagram**.
The editor creates a new :doc:`Deployment diagram <deployment-diagram>` and
records the source Component diagram. If the Component diagram was itself
generated from BPMN, the lane **Copies** values are carried forward to the
Deployment artifacts.
