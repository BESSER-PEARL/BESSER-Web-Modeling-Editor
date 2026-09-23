Agent Diagrams
==============

Agent diagrams are used to design conversational agents and their behaviors, supporting the definition of
`agent models <https://besser.readthedocs.io/en/latest/buml_language/model_types/agent.html>`_.

.. note::

   Agent-level components — LLMs, Intents, Tools, Skills, Workspaces, RAG databases, SQL databases, and
   GUI models — are managed in the :doc:`../agent-components` panel rather than on the diagram canvas
   directly.

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

State Body Actions
~~~~~~~~~~~~~~~~~~

Each state body is a sequence of one or more actions. Select the action type from the button grid at the
top of the body editor.

**Text Reply**

Sends a static text message to the user.

- **Message**: the text to send.
- **Use session vars**: when enabled, ``{key}`` placeholders in the message are replaced at runtime
  with the value stored in the session under that key. The special placeholder ``{user_message}``
  resolves to the current user input.

**LLM Reply**

Generates a reply using a Large Language Model.

- **LLM**: selects a registered LLM (leave blank for the agent default — see :doc:`../agent-components`).
- **System prompt**: optional system-level instruction for the LLM.
- **System prompt uses session vars**: enables ``{key}`` interpolation in the system prompt.
- **Input prompt mode**: ``last_user_message`` (default) passes the user's latest message as the LLM
  input; ``custom`` uses the *Custom input prompt* field instead.
- **Custom input prompt**: template string used when the input mode is ``custom``.
- **Custom input prompt uses session vars**: enables ``{key}`` interpolation in the custom prompt.
- **Store in session**: when set, the LLM reply is stored in the session under this key before being
  sent to the user.
- **Send reply**: uncheck to suppress sending the reply to the user (useful when only storing the
  result in the session).

**LLM Chat Reply**

Like *LLM Reply* but calls the LLM with the full conversation history, making it suitable for
multi-turn dialogue states. Supports the same **System prompt**, **Store in session**, and
**Send reply** controls.

**RAG Reply**

Answers using a configured RAG (Retrieval-Augmented Generation) database.

- **RAG database**: selects a RAG database registered in the :doc:`../agent-components` panel.
- **Prompt**: optional hint prompt prepended to the retrieved context before the LLM call.
- **Input prompt mode / Custom input prompt / session-var interpolation**: same semantics as
  *LLM Reply*.
- **Prompt uses session vars**: enables ``{key}`` interpolation in the hint prompt.
- **Store in session** / **Send reply**: same semantics as *LLM Reply*.

**DB Reply**

Answers from a SQL database by translating the user's request into a SQL query with an LLM.

- **Database**: selects a SQL database registered in the :doc:`../agent-components` panel (or enter
  a custom database name).
- **Query mode**: ``llm_query`` (natural-language to SQL) or direct SQL entry.
- **LLM**: selects the LLM to use for query generation.
- **Store in session** / **Send reply**: same semantics as *LLM Reply*.

**Web Crawl LLM Reply**

Performs a BFS web crawl starting from a URL and queries an LLM with the retrieved content.

- **Initial URL**: the starting URL for the crawl.
- **Max depth** / **Max pages**: limit the crawl breadth.
- **Crawl format**: output format of the crawled content (default: ``markdown``).
- **Base URL prefix**: restricts the crawl to URLs with this prefix.
- **Run crawl**: when unchecked, the cached crawl result from the session is reused (avoids
  re-fetching in subsequent states).
- **No crawl error message**: message sent to the user when no crawl data is available.
- **System message prefix**: text prepended to the LLM system message with the crawled content.
- **System message prefix uses session vars**: enables ``{key}`` interpolation in the prefix.
- **LLM** / **Store in session** / **Send reply**: same semantics as *LLM Reply*.

**GUI Reply**

Sends a BESSER GUI model as an interactive panel directly in the chat conversation (for example,
a form or a dashboard).

- **GUI**: selects a GUI model registered in the :doc:`../agent-components` panel.

When the user submits the GUI form, the agent can react with a *Form Submitted* transition (see
`Transitions`_ below).

**Python Code**

Executes custom Python code. The function must accept ``session`` as its only argument.

Transitions
-----------

Transitions define how the agent moves between states. Supported predefined conditions:

*   **When Intent Matched**: Occurs when a specific user intent is recognized.
*   **When No Intent Matched**: Fallback when no intent is recognized.
*   **Variable Operation Matched**: Checks if a session variable meets a condition (variable name,
    operator, and target value).
*   **File Received**: Occurs when a specific file type is uploaded.
*   **Form Submitted**: Occurs when the user submits a GUI form. Optionally specify a **GUI ID**
    to react only to submissions from a particular ``GUIReplyAction``; leave blank to react to any
    form submission.
*   **Auto Transition**: Occurs automatically after the state action completes.

Custom transitions (using an explicit ``event`` class and free-form condition strings) are also
supported via the **Custom** tab in the transition editor.

.. image:: ../../images/wme/agent/agent_transition.png
  :width: 400
  :alt: Agent State Transition
  :align: center

Intents
-------

Intents represent the user's goals or vocabulary. Each intent requires a name and a list of
training sentences and is managed from the :doc:`../agent-components` panel.

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

To test the agent interactively without leaving the editor, see :doc:`../agent-simulation`.
