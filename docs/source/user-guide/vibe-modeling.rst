Vibe Modeling (AI Assistant)
============================

**Vibe modeling** is the conversational way to build models in the BESSER Web
Modeling Editor: instead of dragging every element onto the canvas by hand, you
describe what you want in plain language and the **modeling agent** creates and
edits the diagram for you. You stay in control -- the agent proposes changes,
applies them to the live canvas, and you keep refining by chatting.

The assistant is powered by the
`modeling agent <https://github.com/BESSER-PEARL/modeling-agent>`_, a separate
BESSER service the editor connects to over a WebSocket. On the public editor at
`editor.besser-pearl.org <https://editor.besser-pearl.org>`_ the agent is hosted
for you; for a local deployment you point the editor at your own instance (see
`Running it locally`_).

Opening the assistant
---------------------

The assistant appears as a floating chat button in the **bottom-right corner**
of any editor page. Click it to open the chat panel. A colored dot next to the
title shows the connection status:

* **green** -- connected and ready
* **amber** -- connecting
* **red** -- disconnected (the modeling-agent service is unreachable)

Type a request, press Enter, and watch the agent apply the result to the canvas.
Suggested **quick actions** (e.g. *create*, *generate code*, *export*) appear as
one-click chips to speed up common follow-ups.

What you can ask it to do
------------------------

The modeling agent understands natural-language modeling requests such as:

* **Create a model from scratch** -- *"Model a library with books, authors and
  members, where a member can borrow many books."*
* **Modify the current diagram** -- *"Add an* ``email`` *attribute to Member and
  make it the identifier."*, *"Rename Book to Publication."*, *"Delete the Loan
  class."*
* **Add OCL constraints in plain language** -- *"Add a constraint that a
  member cannot borrow more than 5 books."* The agent authors the B-OCL and
  attaches a constraint box to the target class. (OCL is only emitted when you
  explicitly ask for it.)
* **Trigger code generation** -- ask it to generate, and it launches the same
  generation pipeline as the *Generate* menu.

Supported diagram types
----------------------

The modeling agent can create and edit these diagram types:

* Class diagrams (including OCL constraints)
* Object diagrams
* State machine diagrams
* Agent diagrams
* GUI (no-code) diagrams
* Quantum circuit diagrams
* BPMN diagrams

Diagrams are laid out by a deterministic layout engine so results are stable and
readable, not scattered across the canvas.

Voice and file input
--------------------

Beyond typing, you can:

* **Speak your request** -- record a voice message in the browser and the agent
  transcribes and acts on it.
* **Attach a file** (up to 10 MB) -- for example a screenshot, a hand-drawn
  sketch, or an existing model to convert into a B-UML diagram.

Running it locally
-----------------

The assistant is optional: the editor works without it, but the chat widget only
connects when a modeling-agent service is reachable. When running the editor
from source, point it at your agent instance with the ``UML_BOT_WS_URL``
environment variable (default ``ws://localhost:8765``). See
:doc:`../reference/environment` for the full variable list and the
`modeling agent repository <https://github.com/BESSER-PEARL/modeling-agent>`_
for how to run the service.

.. note::
   Code generation and validation triggered from the assistant still rely on the
   BESSER backend at ``http://localhost:9000/besser_api``. Start it alongside the
   editor and the modeling agent for the full experience.
