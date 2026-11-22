Deployment Diagrams
===================

Deployment diagrams describe the runtime topology of a system: execution nodes,
deployed components, artifacts, interfaces, and communication paths. In the
multi-agent workflow, the Deployment diagram is the second architectural view
and can be generated from a :doc:`Component diagram <component-diagram>`, which
is itself derived from an :ref:`agentic BPMN process <agentic-bpmn>`.

The Deployment diagram type is part of the **Multi-Agent** modeling perspective
(see :doc:`index`).

Creating a Deployment Diagram
-----------------------------

Create a Deployment diagram from the sidebar, or open a Component diagram and
select **Generate ▸ Generate Deployment diagram**. Generation creates a new
Deployment diagram each time and does not overwrite existing diagrams.

Palette Elements
----------------

The Deployment palette provides:

*   **Node**: an execution environment, device, server, or runtime host. Nodes
    can be nested.
*   **Component**: a deployed component.
*   **Artifact**: a deployable artifact placed inside a node. Generated
    diagrams use artifacts to carry the link to an agent's Agent diagram.
*   **Interface**: a provided or required runtime interface.

Connect elements on the canvas to create relationships. In the relationship
popup you can switch between **Deployment Association**, **Deployment
Dependency**, **Provided Interface**, and **Required Interface**.

Stereotypes
-----------

Nodes have a free-text **Stereotype** field (``node`` by default); typical
values are ``node``, ``device``, and ``executionEnvironment``. Deployment
Components share the Component diagram's stereotype field and presets.
Deployment Associations have a label and a stereotype that can describe the
communication style, such as ``HTTPS`` or ``gRPC``.

Derived Deployment Diagrams
---------------------------

When generated from a Component diagram, the derivation builds a deployment
scaffold from the logical view:

*   Each Subsystem becomes a node containing a ``docker host`` node.
    Components outside any Subsystem are placed in a top-level
    **Docker Host** node. Nested Subsystems are flattened.
*   Each Component becomes an ``executionEnvironment`` node inside the host,
    holding an Artifact, plus a deployed Component linked to that Artifact by
    a dependency. Capability Components (``skill``, ``tool``, ``llm``, ``db``,
    ``rag``) are not deployed separately.
*   Dependencies between Components in different Subsystems become Deployment
    Associations. Their agentic stereotypes are not carried over.
*   The link to the agent's Agent diagram is copied from the source Component
    to its Artifact.
*   If the source Component traces back to a BPMN lane with **Copies** greater
    than one, the Artifact name gets the count as a suffix, for example
    ``Reviewer [3]``.

Generated diagrams show a **Derived from** banner. Derived elements also show
a link in their popups back to the Component element that produced them.

Docker Compose Generation
-------------------------

When a Deployment diagram is active, choose **Generate ▸ Generate Docker
Compose**. The backend generates the Docker Compose files for the project and
the editor downloads them as a ZIP archive. The Deployment diagram must
contain at least one element.

If no Artifact in the diagram is linked to an Agent diagram, the files are
still generated, but the editor warns that no agent implementation is attached.
Run the BPMN to Component to Deployment derivation, after defining the agents
of the agentic lanes, to set up these links. An invalid governance policy on a
merging gateway of the BPMN diagram is reported with the name of the gateway.
