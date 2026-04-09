Quantum Circuit Diagrams
========================

Quantum circuit diagrams allow you to visually design quantum circuits within the BESSER
Web Modeling Editor. For detailed information about the quantum circuit editor, see
:doc:`../../editor/quantum_editor`.

Palette
-------

The palette provides quantum gates organized into two toolboxes:

**Toolbox 1:**

*   **Probes**: Measure, Control, Anti-Control
*   **Half Turns**: H, X, Y, Z, Swap
*   **Quarter Turns**: S, V and their conjugates
*   **Eighth Turns**: T and its conjugate
*   **Parametrized**: XPow, YPow, ZPow, ExpX, ExpY, ExpZ
*   **Arithmetic**: Increment, Decrement, Add, Subtract, Multiply and more
*   **Compare**: Equality, less-than, greater-than comparators

**Toolbox 2:**

*   **Order**: Interleave, Deinterleave, and reordering gates
*   **Frequency**: QFT, inverse QFT, Phase Gradient
*   **Spinning**: Time-dependent rotation gates
*   **Scalar**: Phase gates
*   **Functions**: Custom function gates

Getting Started
---------------

1.  Create a new project or switch to a Quantum Circuit diagram.
2.  Add qubits by expanding the circuit grid.
3.  Drag gates from the palette onto the grid columns.
4.  Use Control gates (dots) to create multi-qubit operations like CNOT.
5.  The state vector updates in real time as you modify the circuit.

Code Generation
~~~~~~~~~~~~~~~

Quantum circuit diagrams support generation to **Qiskit** Python code. Click
**Generate Code** and select **Qiskit** to download the executable circuit script.
