The Spec-Driven Agent
=====================

The **Spec-Driven Agent** turns a BESSER project into a working application. You
ask for it in the :doc:`assistant <ai-assistant>` chat — *"generate the web
app"* — and it produces a downloadable codebase, streaming its progress into the
conversation while it works.

It is a different mechanism from the classic **Generate** menu:

.. list-table::
   :header-rows: 1
   :widths: 25 35 40

   * -
     - Generate menu
     - Spec-Driven Agent
   * - What it does
     - Runs one BESSER generator over one diagram
     - Assembles a whole application, filling gaps a generator cannot cover
   * - How it runs
     - A single HTTP request, result downloaded immediately
     - A long-lived streaming run you watch in the chat
   * - Cost
     - Free, deterministic
     - Uses a language model — the free tier or your own key
   * - Output
     - The generator's artefact
     - A project archive you download, or push straight to GitHub

Where deterministic BESSER generators already cover the work, the agent uses
them — the finished run card tells you what percentage of the result was
produced deterministically rather than by the model.

The end-to-end flow
-------------------

1. **Describe the system.** Ask the assistant for what you want. It builds the
   class diagram (and, for a web app, a GUI no-code diagram and any agent
   diagram) on the canvas.
2. **Review the model.** The agent works from the model, so look at the canvas
   before generating. A *Review the spec* chip closes the chat so you can see
   it.
3. **Ask for the application.** Say *"generate the web app"*. The editor never
   starts a generation run on its own — it always waits for you to ask
   explicitly.
4. **Authorise the run.** See `What you have to confirm`_ below.
5. **Watch it run.** A run card appears in the chat with a live phase list, an
   elapsed-time meter and streamed commentary. You can **Stop** at any moment.
6. **Download or push.** When the run finishes, the card offers **Download** and
   **Push to GitHub**. Nothing is saved to your machine until you click.
7. **Iterate.** Ask for a change — *"add a search page"* — and the agent edits
   the application it just produced instead of rebuilding it from scratch.

What you have to confirm
------------------------

The run is gated so nothing expensive or destructive happens implicitly.

**Explicit request.** A generation run only starts from a message that asks for
one. Creating or editing a model never triggers generation.

**A model to run on.** If the free tier is available and you have no API key,
the first run silently opts you into it and starts — no dialog. If you have
already saved your own key, that key is used and the run starts immediately. The
key dialog only interrupts you when neither is available, in which case it opens
titled **Spec-Driven Agent — Run** with a *Save & run* button. Dismissing it
cancels the run and the assistant says so in the chat.

**Run budget (optional).** Inside that dialog, a collapsed *Spec-Driven Agent
settings* section sets **max spend per run** (USD) and **max time per run**
(minutes). The defaults and the ceilings come from the server, which enforces
them regardless of what you type.

**One run at a time.** Asking for a second run while one is live is refused with
*"Spec-Driven Agent is already running — please wait for it to finish or click
Stop."*

**Download is manual.** A finished run is never written to disk automatically.
The button changes to *Download again* after the first click; the artefact stays
available on the server for about **30 minutes**.

**GitHub push signs you in first.** If you are not connected, clicking *Push to
GitHub* starts the OAuth redirect and reopens the push dialog when you come
back, rather than failing.

Reading the run card
--------------------

While running, the card shows:

* a **phase list** — *Selecting generator*, *Running deterministic generator*,
  *Analysing gaps*, *Customising output*, *Validating* — each ticking off as it
  completes;
* a **Working…** strip with elapsed time against your runtime budget (after
  about 45 seconds it reminds you that big steps take a few minutes);
* streamed prose from the model;
* a red **Stop** button.

When it finishes the card collapses to a single line: *Application ready*, the
generator that was used, the file count, and a clickable *N% deterministic*
badge. **Show steps** expands the detail again.

If the model is switched mid-run (for example because a free-tier quota ran out)
the card says so explicitly rather than silently changing.

When something goes wrong
-------------------------

Errors are reported on the card with a code:

``COST_CAP`` / ``TIMEOUT`` / ``INCOMPLETE``
   The run hit your budget or ran out of road. These are **not** fatal — you
   usually have partial output and can ask the agent to continue.

``INVALID_KEY``
   The stored key was rejected. It is cleared so the next run asks again.

``UPSTREAM_LLM`` / ``INTERNAL`` / ``BAD_REQUEST``
   The model provider or the backend failed. Retry.

``CANCELLED``
   You pressed Stop, or the connection was abandoned.

**If the progress stream goes quiet** for 60 seconds the editor closes it and
tells you the run may still be finishing on the server — it does not pretend the
run froze. The stream reconnects automatically up to four times before giving
up.

**Reloading the page does not cancel a run.** A small pointer (run id and
project id only — no key, prompt or content) is kept so the editor can reattach
to a run in progress and replay the events you missed.

Changing an application you already generated
---------------------------------------------

Ask for a change in the same project and the agent switches to *modify* mode:
it starts from the previous run's output and edits it, instead of regenerating
everything. This works while the previous run is still within the server's
retention window (about 30 minutes by default); after that you get a fresh
build.

Continuing from a GitHub repository
-----------------------------------

A repository BESSER generated can be reopened later:

1. Open the project hub and choose **Continue from GitHub** (sign in if
   prompted).
2. Pick the repository and branch.
3. The editor imports the model that BESSER stored in the repo as a **new
   project**, links the repo, and primes the modify pointer so your next request
   edits that application.

Repositories BESSER did not create are rejected with *"This repo has no BESSER
model — it wasn't created by BESSER."* Importing never overwrites the project
you currently have open.

Pushing the result to GitHub
----------------------------

*Push to GitHub* on a finished run card creates a new repository, or pushes into
one you already linked. If a repository with the chosen name already exists the
dialog tells you to push to it as an existing repo rather than silently
overwriting.

Configuration
-------------

The agent runs on the BESSER Python backend (``BACKEND_URL``), under
``/spec-driven/``. Nothing extra is needed in the frontend build. The backend
decides which models the free tier offers, the cost and runtime ceilings, and
how long finished artefacts are retained; the editor reads all of that from the
backend at page load and never hardcodes it. See :doc:`ai-keys` for what is
stored in your browser.
