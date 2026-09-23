Agent Components Panel
======================

The Agent Components Panel is a two-column sidebar available when an agent diagram is open. It
provides a centralized view for managing all agent-level resources: LLMs, Intents, Tools, Skills,
Workspaces, RAG Databases, SQL Databases, and GUIs. These resources are shared across all states
in the diagram and referenced by body actions and transitions.

Open the panel from the toolbar or sidebar while an agent diagram is active.

.. contents:: Sections
   :local:
   :depth: 1

LLMs
----

Register the language models available to the agent. Each LLM entry has:

- **Name**: identifier used to reference this LLM in state body actions.
- **Provider**: one of ``openai``, ``huggingface``, ``huggingface_api``, ``replicate``, or
  ``ollama``.
- **Model / Parameters**: provider-specific model identifier (for example ``gpt-4o-mini`` for
  OpenAI).

The first LLM added becomes the agent's default. Click **Set as default** on any entry to change
the default. Body actions that do not specify an LLM use the default automatically.

Intents
-------

Intents represent the user's goals or vocabulary. Each intent requires:

- **Name**: identifier used in *When Intent Matched* transitions.
- **Training sentences**: a list of example user phrases the intent classifier learns from.

Add one or more training sentences per intent. The more varied the examples, the more robust the
classifier.

Tools
-----

Tools are callable Python functions available to reasoning states. Each tool has:

- **Name**: identifier used in the agent's reasoning loop.
- **Description**: natural-language description of what the tool does (shown to the LLM).
- **Code**: Python implementation. The function receives arguments determined by the LLM at
  runtime.

Skills
------

Skills are reusable instruction snippets injected into the reasoning context. Each skill has:

- **Name**: identifier.
- **Content**: the instruction text injected into the LLM's system context.
- **Description**: optional description shown alongside the skill.

Workspaces
----------

Workspaces are file-system locations the agent may read from (and optionally write to). Each
workspace has:

- **Name**: identifier.
- **Path**: relative or absolute path to the workspace directory.
- **Description**: optional description of the workspace contents.
- **Writable**: when enabled, the agent is allowed to write files to this location.
- **Max read bytes**: optional limit on the amount of data read from the workspace in a single
  operation.

RAG Databases
-------------

RAG (Retrieval-Augmented Generation) databases allow the agent to answer questions from a
collection of documents. Each RAG database entry has:

- **Name**: identifier referenced by *RAG Reply* actions.
- **Embedding provider**: ``openai`` or ``ollama``.
- **LLM name**: the LLM used to generate the final answer from retrieved chunks.
- **Other configuration**: splitter settings, hybrid retrieval (BM25) toggle, and optional
  hint prompt.

Place your PDF (or other supported) documents in the generated data folder before running
the agent. The folder is named after the RAG element (for example, a database named
``"Knowledge Base"`` produces ``knowledge_base/``).

SQL Databases
-------------

SQL Database entries let the agent query relational databases using natural language via the
*DB Reply* action. Each entry has:

- **Name**: identifier referenced by *DB Reply* actions.
- **Connection string**: the database connection URL (for example a SQLite file path or a
  PostgreSQL URI).

GUIs
----

GUI entries associate interactive BESSER GUI models with the agent. The agent can send a GUI
panel directly in the chat using a *GUI Reply* action, and then react to user submissions with
a *Form Submitted* transition.

Each GUI entry has:

- **Name / GUI ID**: identifier referenced by ``GUIReplyAction`` in state bodies and by
  *Form Submitted* transitions.
- **GUI Editor**: click the edit button to open the built-in GrapesJS-based GUI builder (see
  `GUI Editor`_ below).

GUI Editor
~~~~~~~~~~

The GUI Editor is a visual, drag-and-drop interface (powered by
`GrapesJS <https://grapesjs.com/>`_) for building the GUI model associated with a given GUI
entry. It supports forms, buttons, text elements, input fields, and layout containers.

Changes made in the GUI Editor are stored directly in the agent's ``gui_models`` dictionary
and are picked up by the BAF generator when generating the agent code.

.. seealso::

   :doc:`diagrams/agent-diagram`
      How to reference GUI entries in state body actions and transitions.
