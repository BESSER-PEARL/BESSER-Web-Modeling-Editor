Agent Diagrams
==============

Agent diagrams are used to design conversational agents and their behaviors, supporting the definition of :doc:`agent models <../../../buml_language/model_types/agent>`.

Agent States
------------

AgentStates represent the different conditions or statuses that an agent can be in.

.. image:: ../../images/wme/agent/agent_state.png
  :width: 200
  :alt: Agent State
  :align: center

Double-click an AgentState to edit its body:

.. image:: ../../images/wme/agent/agent_body.png
  :width: 600
  :alt: Agent Body
  :align: center

Options for the body:

*   **Text Reply**: Static text sent as a reply.
*   **LLM Reply**: Generates a reply using a Large Language Model based on user input.
*   **Python Code**: Executes custom Python code (must take ``session`` as an argument).

Transitions
-----------

Transitions define how the agent moves between states. Supported conditions:

*   **When Intent Matched**: Occurs when a specific user intent is recognized.
*   **When No Intent Matched**: Fallback when no intent is recognized.
*   **Variable Operation Matched**: Checks if a session variable meets a condition.
*   **File Received**: Occurs when a specific file type is uploaded.
*   **Auto Transition**: Occurs automatically after the state action completes.

.. image:: ../../images/wme/agent/agent_transition.png
  :width: 400
  :alt: Agent State Transition
  :align: center

Intents
-------

Intents represent the user's goals or vocabulary. Each intent requires a name and a list of training sentences.

.. image:: ../../images/wme/agent/agent_intent.png
  :width: 400
  :alt: Agent Intent
  :align: center

Generating the Agent
--------------------

Once designed, you can generate a deployable agent:

1.  Click **Generate Code**.
2.  Select **BESSER Agent**.
3.  Choose the **Source Language** (of your model) and **Target Language** (for the agent's communication).

.. image:: ../../images/wme/agent/agent_generate_settings.png
  :width: 300
  :alt: Agent Generation Settings
  :align: center

Supported languages include English, German, Spanish, French, Luxembourgish, and Portuguese.
