State Machine Diagrams
======================

State machine diagrams model the dynamic behavior of a system by showing how objects change state in response to events. They are particularly useful for modeling reactive systems, user interfaces, and protocol specifications.

Palette
-------

The palette contains elements for creating your state machine diagram:

*   **Initial States**
*   **States**
*   **Final States**
*   **Transitions**
*   **Code Blocks**

Getting Started
---------------

States
~~~~~~

To add a state:

1.  Drag and drop the **state** element from the left panel.
2.  Double-click the shape to edit properties.

.. image:: ../../images/wme/state_machine/state_prop.png
  :width: 310
  :alt: State Properties
  :align: center

*   **Name**: The name of the state.
*   **Body**: Define the behavior (actions) of the state.
*   **Fallback Action**: An optional action executed if the state is entered without a specific trigger.

Transitions
~~~~~~~~~~~

To create a transition:

1.  Click the source state.
2.  Drag from a blue connection point to the target state.
3.  Double-click the transition arrow to edit its **Name** and **Parameters**.

.. image:: ../../images/wme/state_machine/transition_prop.png
  :width: 330
  :alt: Transition Properties
  :align: center
