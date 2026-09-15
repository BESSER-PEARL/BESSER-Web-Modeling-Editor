Diagram Types
=============

The BESSER Web Modeling Editor supports nine diagram types, covering different
aspects of system modeling. A project holds up to **five diagrams of each
type**, each on its own tab.

.. toctree::
   :maxdepth: 1
   :caption: Supported Diagrams:

   class-diagram
   object-diagram
   state-machine-diagram
   agent-diagram
   bpmn-diagram
   gui-diagram
   quantum-circuit-diagram
   nn-diagram

Overview
--------

*   **Class Diagrams**: Define the static structure of your system, including classes, attributes, and relationships.
*   **Object Diagrams**: Illustrate specific instances of your classes at a particular point in time.
*   **State Machine Diagrams**: Model the dynamic behavior of objects as they transition between states.
*   **Agent Diagrams**: Design the flow and behavior of conversational agents.
*   **BPMN Diagrams**: Model business processes with tasks, events, gateways, pools, and lanes.
*   **GUI Diagrams**: Create mockups and designs for graphical user interfaces.
*   **Quantum Circuit Diagrams**: Design quantum circuits with gates and qubits for Qiskit code generation.
*   **Neural Network Diagrams**: Design layered neural networks and generate PyTorch or TensorFlow code.
*   **User Diagrams**: Describe user profiles used to personalise generated
    agents. They can be edited either on the canvas or through the guided
    **Edit as Form** panel on the diagram tab bar, and exported as a user
    profile JSON.

.. note::
   Class, Object, State Machine, Agent, User, Neural Network and BPMN diagrams
   all share the same UML canvas. GUI No-Code diagrams open a GrapesJS
   drag-and-drop page builder, and Quantum Circuit diagrams open a purpose-built
   circuit editor.

Showing fewer diagram types
---------------------------

Project Settings ▸ **Modeling Perspectives** controls which diagram types appear
in the left sidebar. Pick a preset — *Data Modeler* (class + object),
*Agent Developer* (agent + user), *Full Web Application* (class + agent + GUI
no-code), *Quantum*, or *Show All* — or flip the per-type switches directly.
At least one type must stay enabled.

Hiding a type never deletes anything: the diagrams stay in the project, and a
banner above the canvas offers a one-click **Enable** if a hidden type still
holds content or is referenced by a visible diagram. Generators are not
filtered by perspective — every generator that fits the active diagram stays
reachable from the Generate menu.
