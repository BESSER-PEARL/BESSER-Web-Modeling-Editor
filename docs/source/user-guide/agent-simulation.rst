Agent Simulation
================

The Agent Simulator lets you chat with a running instance of your agent and watch it move
through its states without leaving the editor. The backend generates the agent code from the
current diagram and runs it in an isolated session on the agent simulator service.

Requirements and limitations
----------------------------

The hosted editor at https://editor.besser-pearl.org provides the simulator. A self-hosted
deployment needs:

- the ``besser-wme-agent-simulator`` service running next to the backend, and
- the same ``AGENT_SIMULATOR_API_TOKEN`` value set on both the backend and the simulator. While
  the token is unset, the simulator refuses every request.

See the `Agent Simulator <https://besser.readthedocs.io/en/latest/utilities/agent_simulator.html>`_
page of the BESSER documentation for the architecture, the security model and all the settings.

With the default settings:

- **GitHub sign-in is required** to start a simulation.
- **Custom Python code is refused**: an agent with a state body in **Custom (Python)** mode
  cannot be simulated; the validation step reports it. Tools written in Python are allowed.
- **One session at a time per user**: stop the running simulation before starting another one.
- **Sessions have a lifetime limit** (15 minutes by default); the session is stopped when it
  expires. The limit is shown under **Resource Limits** in the dialog described below.
- **API keys are used only for the session**: the keys you enter are passed to the agent of
  this session and are not stored. The editor keeps them in memory only so that **Restart** can
  reuse them, and forgets them when the simulation stops.

.. warning::

   Do not share sensitive personal information in the simulation chat. Simulation sessions are
   logged and may be visible to the operators of the editor.

Launching a Simulation
----------------------

1. Open an agent diagram.
2. Click **Simulate Agent** under **Agent** in the left sidebar.
3. The editor validates the agent first (this also checks the requirements above). If
   validation fails, the errors are shown in a notification and the simulation does not start.
4. The **Simulate Agent: <diagram name>** dialog opens (see `Credentials Dialog`_ below).
5. Click **Start Simulation**. The simulator page opens and the agent starts in the background.

Credentials Dialog
------------------

**API Keys**

- **Use my own API keys** (default): enter the keys of the LLM providers your agent uses:

  - **OpenAI API Key** (optional)
  - **HuggingFace API Token** (optional)
  - **Replicate API Key** (optional)

  Only fill in the keys your agent needs.

- **Use editor quota**: shown only when the deployment enables it. The agent then uses the
  editor host's quota instead of your own keys.

**Resource Limits**

Expand this section to see the limits applied to the session: **Memory**, **CPU**, **Disk** and
**Session lifetime**. The deployment sets these values.

Simulation Panel
----------------

The simulator page shows the diagram name in its header (**Simulator: <diagram name>**) and has
two panes separated by a drag handle that resizes them.

Left pane: Diagram and Source
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Two tabs switch the view:

**Diagram**
   A read-only copy of the agent state machine. The current state is highlighted as the agent
   runs, and **View** / **Hide** shows the list of transitions taken so far.

**Source**
   A file explorer of the session's files: the generated ``agent.py`` (selected automatically),
   ``config.yaml`` and support files such as ``tools.py``, plus the files the agent writes while
   it runs. Click a file to view its content, or **Refresh files** to reload the list.

The right end of the tab bar shows the **Last transition:** taken by the agent and the
**Restart** button.

Right pane: Chat and Agent Output
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Chat**
   Type messages and read the agent's replies. Rich replies, such as options or GUIs sent by a
   *GUI* action, are rendered in the conversation.

**Agent Output**
   A collapsible terminal with the live output of the agent process (the last 2,000 lines).
   Expand it to see log messages and errors raised while the agent runs.

Simulation Controls
-------------------

- **Stop simulation** (the close button at the right of the header): ends the session and
  returns to the editor. Leaving the simulator page or switching project also stops the session.
- **Restart** (in the tab bar, tooltip **Restart simulation**): stops the session and starts a new one with the
  same agent and the same API keys.

.. note::

   **Restart** reuses the agent as it was when you launched the simulation. To try changes you
   made to the diagram, stop the simulation and click **Simulate Agent** again.

Status and errors
~~~~~~~~~~~~~~~~~

- While the agent starts, a spinner is shown in the header, **Starting simulation...** appears
  in the tab bar, and the banner **The agent is loading, please wait.** is shown above the
  terminal until the agent produces its first output.
- If the session cannot be started or fails, a **Simulation error** banner shows the reason.
  Click **Close** to end the session. Errors raised by the agent code itself are shown in
  **Agent Output**.

.. seealso::

   :doc:`diagrams/agent-diagram`
      How to model agent states, body actions, and transitions.

   :doc:`agent-components`
      Managing LLMs, intents, tools, and other agent resources.

   :doc:`agent-runtime`
      Platform, NLP settings and the ``config.yaml`` file of the agent.
