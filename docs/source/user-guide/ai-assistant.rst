The AI Assistant
================

The **Modeling Assistant** is the conversational way to build models in the
BESSER Web Modeling Editor: instead of dragging every element onto the canvas by
hand, you describe what you want in plain language and the assistant creates and
edits the diagrams for you. You stay in control — the assistant applies changes
to the live canvas, and you keep refining by chatting.

The assistant is powered by the
`modeling agent <https://github.com/BESSER-PEARL/modeling-agent>`_, a separate
BESSER service the editor connects to over a WebSocket. On the public editor at
`editor.besser-pearl.org <https://editor.besser-pearl.org>`_ the agent is hosted
for you; for a local deployment you point the editor at your own instance (see
`Running it locally`_).

.. note::
   The assistant edits **the model**. Turning a finished model into a running
   application is the job of the :doc:`Spec-Driven Agent <spec-driven-agent>`,
   which you also start from the same conversation.

Opening the assistant
---------------------

On your first visit the editor asks how you want to work — **Model it**
(low-code canvas) or **Describe it** (agentic workspace). Whichever you pick, the
assistant is available afterwards through two surfaces that share one
conversation:

* **The chat bubble.** A floating button in the **bottom-right corner** of the
  editor. Click it to open a compact chat card.
* **The workspace drawer.** A bottom sheet that slides up over the canvas, with
  a drag handle you can pull down to open and push up to close (Enter or Space
  toggles it, Escape closes it). The drawer replaces the floating bubble while
  it is open.

The drawer opens automatically when you create a project in *agentic* mode, or
when you load the editor with ``?agentic`` (or ``?mode=agent``) in the URL.
Whether you left the drawer open or closed is remembered for the rest of the
browser tab. No message is ever sent on your behalf — the assistant waits for
you to type.

A coloured dot next to the title shows the connection status:

* **green** — connected and ready
* **amber** — connecting
* **red** — disconnected (the modeling-agent service is unreachable)

Type a request, press Enter, and watch the assistant apply the result to the
canvas. **Escape** clears the composer and **Arrow Up** recalls your last
message.

What you can ask it to do
-------------------------

The assistant understands natural-language modeling requests such as:

* **Create a model from scratch** — *"Model a library with books, authors and
  members, where a member can borrow many books."*
* **Modify the current diagram** — *"Add an* ``email`` *attribute to Member and
  make it the identifier."*, *"Rename Book to Publication."*, *"Delete the Loan
  class."*
* **Add OCL constraints in plain language** — *"Add a constraint that a
  member cannot borrow more than 5 books."* The assistant authors the B-OCL and
  attaches a constraint box to the target class. (OCL is only emitted when you
  explicitly ask for it.)
* **Add a diagram** — it can create a new diagram tab of a supported type and
  switch the canvas to it.
* **Trigger code generation** — ask it to generate and it launches the same
  BESSER generator pipeline as the *Generate* menu.
* **Build a whole application** — ask for a web app and it hands the project to
  the :doc:`Spec-Driven Agent <spec-driven-agent>`.
* **Export, deploy, or import from GitHub** — the same actions available from
  the top-bar menus.

Suggested **quick actions** appear as one-click chips underneath the
assistant's replies (for example *Generate web app*, *Open the GUI*, *Replace* /
*Keep both* when an import would collide, or *Try again* after a recoverable
error). Most chips simply send their text as your next message; a couple are
purely local — *Review the spec* just closes the chat so you can see the canvas,
and the GUI chips switch the active diagram.

Supported diagram types
-----------------------

The assistant can create and edit eight of the editor's nine diagram types:

* Class diagrams (including OCL constraints)
* Object diagrams
* State machine diagrams
* Agent diagrams
* User diagrams (user profiles)
* GUI (no-code) diagrams
* Quantum circuit diagrams
* BPMN diagrams

**Neural network diagrams are not supported** — the chat bubble is hidden while
an NN diagram is active.

Diagrams are laid out by a deterministic layout engine so results are stable and
readable, not scattered across the canvas.

Voice and file input
--------------------

Beyond typing, you can:

* **Speak your request** — the microphone button appears when your browser
  grants microphone access. Recording stops automatically after 60 seconds. Your
  message first appears as *"🎤 Transcribing…"* and is replaced by the
  transcript once the agent returns it.
* **Attach files** (up to **10 MB each**) — for example a screenshot, a
  hand-drawn sketch, or an existing model to convert into a B-UML diagram. Use
  the paperclip, drag files onto the chat, or paste a long block of text (over
  3000 characters is automatically turned into a ``.txt`` attachment).

Safety and limits
-----------------

**Rate limits.** Requests are throttled per browser tab. Heavier operations
(generation, deploy, export) are throttled more aggressively than plain chat.
When you hit a limit the assistant tells you how long to wait.

**No API key by default.** Out of the box the assistant runs on the service's
own model credentials under those rate limits. Supplying your own key removes
that dependency — see :doc:`ai-keys`.

**Prompt-injection guard.** The assistant's replies can carry structured
actions. Actions with real side effects — anything that changes your model,
imports a repository, exports, deploys, or starts a paid generation run — are
honoured **only** when they arrive as the whole structured reply, never when
found inside ordinary prose. A JSON blob smuggled into a message (for example
through an uploaded file) therefore cannot mutate your project or start a run.

**Undo.** Changes the assistant makes go through the editor's normal undo
stack, so :kbd:`Ctrl+Z` works as usual.

**Report an issue.** The chat header has a *Report an issue* button that opens a
pre-filled GitHub issue containing the recent conversation context.

Privacy
-------

Your messages and the diagram data needed to answer them are sent to the
modeling-agent service. Projects themselves stay in your browser — the assistant
is sent a snapshot of the current project so it can reason about it, not a copy
that is stored. The chat header links to a privacy summary.

Running it locally
------------------

The assistant is optional: the editor works without it, but the chat only
connects when a modeling-agent service is reachable. When running the editor
from source, point it at your agent instance with the ``UML_BOT_WS_URL``
environment variable (default ``ws://localhost:8765``). See
:doc:`../reference/environment` for the full variable list and the
`modeling agent repository <https://github.com/BESSER-PEARL/modeling-agent>`_
for how to run the service.

.. note::
   Code generation, validation and B-UML export triggered from the assistant
   still rely on the BESSER backend at ``http://localhost:9000/besser_api``.
   Start it alongside the editor and the modeling agent for the full
   experience.
