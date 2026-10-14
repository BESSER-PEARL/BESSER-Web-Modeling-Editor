Agent Components
================

The **Components** page manages the agent-level resources of the active agent diagram: LLMs,
Intents, Tools, Skills, Workspaces, RAG Databases, SQL Databases, and GUIs. These resources are
shared by all states of the diagram and are referenced by name from state body actions and
transitions (see :doc:`diagrams/agent-diagram`).

To open it, select an agent diagram and click **Components** under **Agent** in the left
sidebar. The page replaces the canvas: a section list on the left (each entry shows how many
items it holds) and the selected section on the right. Click **Add ...** (for example
**Add LLM**) to create an item, and click an item to expand or collapse its fields.

Runtime settings such as the platform, API keys and the ``config.yaml`` file are edited on the
**Agent Customization** page instead (see :doc:`agent-runtime`).

.. contents:: Sections
   :local:
   :depth: 1

LLMs
----

Register the language models available to the agent. Each LLM has:

- **Model Name**: the model identifier (for example ``gpt-4o-mini``), also used to reference
  this LLM from state actions and RAG databases.
- **Provider**: **OpenAI**, **HuggingFace (local)**, **HuggingFace API**, **Replicate**, or
  **Ollama (local)**.
- **Set as default LLM**: use this LLM when a state action does not select one.
- **Num previous messages**: how many previous messages are sent to the model as context.
- **Parameters**: provider-specific parameters as a JSON object.
- **Global context**: optional system-level instructions for this LLM.

When no default LLM is set, the first LLM added becomes the default as soon as you give it a
name. Renaming the default LLM keeps it the default, and removing it clears the default.

Intents
-------

Intents represent what the user wants to do. Each intent has:

- **Intent name**: referenced by *Intent Matched* transitions.
- **Description (optional)**.
- **Training sentences**: example user phrases the intent classifier learns from. Click
  **Add sentence** to add one.

The more varied the training sentences, the more robust the classifier.

Tools
-----

Tools are Python functions that reasoning states can call. Each tool has:

- **Tool name**.
- **Description**: what the tool does, shown to the LLM.
- **Python code**: the implementation. The function receives the ``session`` parameter for
  agent session access; the other arguments are chosen by the LLM at runtime.

Skills
------

Skills are Markdown knowledge documents provided to reasoning states. Each skill has a
**Skill name**, a **Description**, and the **Markdown content** given to the LLM.

Workspaces
----------

Workspaces are filesystem directories the agent can read or write during reasoning. Each
workspace has:

- **Workspace name**.
- **Filesystem path**: absolute path to the directory on the host system.
- **Description**.
- **Writable**: allow the agent to create or modify files.
- **Max read bytes**: limit on the amount of data read in a single operation.

.. note::

   Tools, Skills and Workspaces are only used by a reasoning state. The page shows a warning in
   these sections while the diagram has no reasoning state.

RAG Databases
-------------

RAG (Retrieval-Augmented Generation) databases let the agent answer questions from a
collection of documents. Each RAG database has:

- **Name**: referenced by *RAG* state actions.
- **LLM**: the LLM that answers from the retrieved content; **(use default)** uses the
  default LLM.
- **LLM prompt prefix**: optional text prepended to the prompt sent to the LLM.
- **K (retrieved chunks)**: number of document chunks retrieved per query (default ``4``).
- **Num previous messages**: previous messages included as context (default ``0``).
- **Embedding provider**: **OpenAI** or **Ollama (local)**. With Ollama, two more fields
  appear: **Embedding base URL** (default ``http://localhost:11434``) and **Embedding model**.

Place your PDF (or other supported) documents in the data folder of the generated agent before
running it. The folder is named after the RAG database, in lowercase: a database named
``ProductDocs`` uses ``productdocs/``.

SQL Databases
-------------

SQL databases let the agent query relational databases with the *SQL Query* state action.
Each entry has:

- **Name**: the key of the connection in ``config.yaml``, and the name to enter as the
  **Custom database name** of a *SQL Query* action.
- **Dialect**: PostgreSQL (default), SQLite, MySQL, MariaDB, Microsoft SQL Server or Oracle.
- **Database name**, or **Database file path** for SQLite.
- **Host** and **Port**.
- **Username** and **Password**.

Host, port, username and password are hidden for SQLite, which only needs the file path. SQL
databases are written to the ``db.sql`` section of the agent's ``config.yaml``, which you can
inspect in **Raw YAML** on the :doc:`agent-runtime` page.

.. warning::

   The SQL database settings, including the **Password**, are saved in plain text in the
   project's agent configuration. Anyone who receives an export of the project can read them.
   Use a dedicated database user with limited rights, and remove the password before sharing
   the project.

GUIs
----

GUIs are graphical components the agent can send as chat replies (with a *GUI* state action)
and react to with a *Form Submitted* transition. Click **Create GUI** to add one. Each GUI has:

- **GUI ID (message_id)**: used as ``message_id`` in GUI events and as the form ID in
  *Form Submitted* transitions. A unique ID is generated when the GUI is created.
- **Persist**: keep the GUI visible after the user interacts with it (enabled by default).
- **Is Form**: enables *Form Submitted* transitions for this GUI.
- **Width (optional)**: CSS width of the GUI panel.
- **Open GUI Editor** (or **Edit GUI design** once a design exists): opens the GUI Editor
  described below.

GUI Editor
~~~~~~~~~~

The GUI Editor is a visual, drag-and-drop editor (powered by
`GrapesJS <https://grapesjs.com/>`_) for designing the content of a GUI: forms, buttons, text,
input fields, and layout containers. Click **Save and Exit** to keep the design, or **Cancel**
to discard it.

The editor stores each GUI as an ``AgentGUI`` component of the agent diagram, with its design
attached. When you generate or simulate the agent, the backend converts these components into
BESSER GUI models that the BAF generator uses.

.. seealso::

   :doc:`diagrams/agent-diagram`
      How to use these components in state body actions and transitions.

   :doc:`agent-runtime`
      Platform, API keys and the ``config.yaml`` file of the agent.

   :doc:`agent-simulation`
      Try the agent from the editor.
