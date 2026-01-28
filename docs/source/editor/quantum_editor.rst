Quantum Circuit Editor
======================

The Quantum Circuit Editor allows users to design quantum circuits visually within the BESSER Web Modeling Editor. It provides a drag-and-drop interface for placing quantum gates on a grid of qubits, similar to popular tools like Quirk.

Features
--------

* **Interactive Grid**: A grid layout where rows represent qubits and columns represent time steps.
* **Gate Palette**: A comprehensive palette of quantum gates, including:
    * **Logic Gates**: H, X, Y, Z, Swap, Controls.
    * **Frequency/Phase Gates**: RX, RY, RZ, Phase.
    * **Arithmetic Gates**: Adders, Modular Arithmetic.
    * **QFT**: Quantum Fourier Transform gates.
* **Real-time Simulation**: The editor includes a simulation engine that updates the quantum state vector in real-time as you modify the circuit.
* **Example Circuits**: Pre-loaded example circuits (e.g., Bell State, Grover's Algorithm) to help you get started.
* **Code Generation**: Export your visual design to executable Qiskit code.

Usage
-----

1.  **Create a Project**: Start a new project and select "Quantum Circuit" as the diagram type.
2.  **Add Gates**: Drag gates from the toolbar on the left onto the circuit grid.
3.  **Connect Qubits**: Use control gates (dots) to create multi-qubit operations like CNOT.
4.  **Simulate**: Watch the state display update automatically.
5.  **Export**: Use the "Generate Code" menu to download the corresponding Python/Qiskit script.

Component Structure
-------------------

The editor is built using React and integrates with the BESSER web application. Key components include:

* ``QuantumEditorComponent``: The main entry point for the editor.
* ``EditorToolbar``: Contains the palette of available gates.
* ``LogicGates``, ``FrequencyGates``, ``ArithmeticGates``: Specific gate collections.
