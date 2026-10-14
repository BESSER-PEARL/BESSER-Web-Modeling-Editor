Agent Customization
===================

The **Agent Customization** page holds the runtime settings of the active agent diagram and
builds the agent's ``config.yaml`` file. To open it, select an agent diagram and click
**Agent Customization** under **Agent** in the left sidebar.

The page has two tabs. This page describes the **Agent Runtime** tab; the **Personalization**
tab tailors the agent to a user profile from a User diagram.

The **Agent Runtime** tab has a section list on the left. Each change is saved on the agent
diagram immediately, so the settings travel with the project.

.. warning::

   Tokens, API keys and passwords entered on this page (NLP API keys, Telegram, GitHub and
   GitLab tokens, database passwords) are stored in plain text in the project and written to
   ``config.yaml``. Anyone who receives an export of the project can read them. For the
   :doc:`agent-simulation`, enter LLM API keys in the simulation dialog instead: those are used
   only for the session and are not stored.

.. contents:: Sections
   :local:
   :depth: 1

Agent Runtime
-------------

Found under **Settings** in the section list.

- **Platform**: **WebSocket** or **Telegram**. With WebSocket, tick **Use Streamlit UI** to
  generate the Streamlit chat interface. WebSocket reply actions (Markdown, HTML, Speech,
  Options, and so on) need the WebSocket platform.
- **Intent Recognition**: **Classical** or **LLM-based**.
- **LLM**: shown for LLM-based intent recognition; the LLM used to classify intents.
  **(use default)** uses the default LLM from the :doc:`agent-components` page.

Config File
-----------

The remaining sections, under **Config File**, map to the sections of ``config.yaml``. Fields
are labelled with their YAML key.

Agent
~~~~~

- ``check_transitions_delay``: delay in seconds between each transition evaluation cycle.

NLP
~~~

- ``language`` (ISO 639-1), ``region`` (ISO 3166-1 alpha-2), ``timezone``.
- ``intent_threshold``: confidence threshold for intent predictions.
- ``pre_processing``: enables stemming.
- **API Keys**: **HuggingFace token**, **OpenAI api_key** and **Replicate api_key** for the
  LLM providers.

Platforms
~~~~~~~~~

Each platform has a toggle next to its name in the section list (and an **Enabled** toggle in
the section). Its fields appear once it is enabled.

**WebSocket**
   ``host`` and ``port`` of the WebSocket server; a **Streamlit** group with the ``host`` and
   ``port`` of the Streamlit UI, and a **Chat** group with display settings (``size``,
   ``font``, ``line_spacing``, ``alignment``, ``color``, ``contrast``).

**Telegram**
   ``token``: the bot token for the Telegram API.

**GitHub** / **GitLab**
   ``personal_token`` (personal access token), ``webhook_token`` (secret for webhook
   verification) and ``webhook_port`` (local port exposed to GitHub or GitLab).

**A2A**
   ``port``: local port for agent-to-agent communication.

Database
~~~~~~~~

Two connections, each with its own toggle: **Monitoring** and **Streamlit**. Each takes
``dialect``, ``host``, ``port``, ``database``, ``username`` and ``password``.

The SQL databases the agent queries with *SQL Query* actions are defined on the
:doc:`agent-components` page (**SQL Databases**) and written to ``db.sql``.

Custom YAML
~~~~~~~~~~~

Free YAML appended at the end of the generated ``config.yaml``, for properties the form does not
cover. Syntax errors are shown above the editor.

Raw YAML
~~~~~~~~

A read-only view of the full generated ``config.yaml``. To change it, edit the sections above or
add custom YAML.

.. seealso::

   :doc:`agent-components`
      LLMs, intents, SQL databases and the other agent resources.

   :doc:`agent-simulation`
      Try the agent from the editor.
