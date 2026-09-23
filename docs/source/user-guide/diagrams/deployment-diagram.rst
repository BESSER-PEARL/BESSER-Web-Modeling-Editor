Deployment Diagrams
===================

Deployment diagrams describe the runtime topology of a system: execution nodes,
deployed components, artifacts, interfaces, and communication paths. In the
agentic workflow, Deployment is the second architectural view of a multi-agent system and can be generated
from a Component diagram.

Creating a Deployment Diagram
-----------------------------

Create a Deployment diagram from the sidebar, or open a Component diagram and
select **Generate > Generate Deployment diagram**. Generation creates a new
Deployment diagram each time and does not overwrite existing diagrams.

Palette Elements
----------------

The Deployment palette provides:

* **Node**: an execution environment, device, server, or runtime host.
* **Component**: a deployed component inside a node.
* **Artifact**: a deployable artifact associated with a component. Generated
  diagrams use artifacts to keep the link to an agent implementation.
* **Interface**: a provided or required runtime interface.

Create relationships by connecting elements on the canvas. Deployment
associations can show stereotype labels on the edge.

Stereotypes
-----------

Deployment nodes, components, and associations expose a **Stereotype** field.
Typical node stereotypes include ``node``, ``device``, and
``executionEnvironment``. Association stereotypes can describe the communication
or permission style, such as ``HTTPS`` or ``gRPC``.

Derived Deployment Diagrams
---------------------------

When generated from a Component diagram, the derivation creates a deployment
scaffold from the logical Component view:

* Component Subsystems become deployment grouping nodes.
* Component agents and capabilities become deployed components and artifacts.
* Component dependencies become deployment associations where appropriate.
* Agent implementation references are copied from source Components to their
  Deployment artifacts.
* If the source Component traces back to a BPMN lane with **Copies** greater
  than one, the generated artifact name includes the copy count.

Generated diagrams can show a **Derived from** banner. Derived elements can
also show source links in their popups, helping trace a Deployment element back
to the Component element that produced it.

Docker Compose Generation
-------------------------

When a Deployment diagram is active, open **Generate > Generate Docker Compose**
to request Docker Compose files from the backend. If no artifacts are linked to
Agent diagrams yet, generation can still produce Compose files, but the editor
warns that no agent implementation is attached to an artifact.
