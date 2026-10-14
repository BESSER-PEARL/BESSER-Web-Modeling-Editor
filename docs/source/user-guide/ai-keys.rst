API Keys and the Free Tier
==========================

Both AI features — the :doc:`Modeling Assistant <ai-assistant>` and the
:doc:`Spec-Driven Agent <spec-driven-agent>` — need a language model behind
them. You have three options, and you do not have to decide up front.

.. list-table::
   :header-rows: 1
   :widths: 22 39 39

   * - Option
     - Assistant
     - Spec-Driven Agent
   * - **Nothing** (default)
     - Runs on the service's own credentials, under per-tab rate limits.
     - Uses the keyless **Free** tier when the server offers one.
   * - **Your own key**
     - Used for every request; rate limits stop applying.
     - Billed to your key, within the run budget you set.
   * - **A local / gateway model**
     - Supported (OpenAI-compatible endpoint).
     - Supported. Requires the BESSER backend to run locally.

The free tier
-------------

When the deployment has a hosted open-weight model configured, the Spec-Driven
Agent can use it with **no API key at all**. The first time you ask for a
generation run without a key, the editor quietly opts you in and starts — it
does not interrupt you with a key dialog.

* No key, no account, nothing to enter.
* The model is chosen by the server. Where more than one free model is offered,
  the key dialog shows a radio group to pick between them; the label marks which
  is the default and which is self-hosted.
* Quality is lower than the paid providers. The dialog says so.
* The free tier applies to the **Spec-Driven Agent only**. The assistant has no
  "free" provider — without a key it uses the service's own credentials under
  rate limits.

If the backend does not advertise a free tier (an older or unreachable backend),
the editor asks for a key instead rather than starting a run that would fail.

Where the key dialog lives
--------------------------

There is **one** key dialog, reachable from three places, all writing to the
same store:

* the **key button in the assistant chat header** (chat bubble);
* **API key** in the assistant drawer's bottom bar (it reads *API key set* once
  you have one);
* **Project Settings ▸ AI / LLM API Key**.

You enter the key once and it powers both the assistant and the Spec-Driven
Agent. Saving a real key automatically switches you off the free tier; choosing
*Free* again later switches back.

Supported providers
-------------------

* **Anthropic**, **OpenAI**, **Mistral** — paste the provider's key.
* **Nebius Token Factory** — paste your Nebius key. Serves open-weight models
  (default ``Qwen/Qwen3-30B-A3B-Instruct-2507``) from a fixed endpoint the
  backend pins, so no URL to configure. Spec-Driven Agent only — the modeling
  assistant keeps using its own default model.
* **Local** — any OpenAI-compatible endpoint you run yourself, for example
  ``http://localhost:11434/v1`` for Ollama.
* **PIA** — the LIST PIA gateway, reachable only from the LIST VPN.
* **Free** — the keyless server-hosted tier described above (Spec-Driven Agent
  only).

The *Local* and *PIA* options require the BESSER backend to be running locally,
because the backend — not the browser — makes the model call. The dialog lists
them when the editor is opened on ``localhost``; the backend must also set
``BESSER_LLM_ALLOW_CUSTOM_BASE_URL=true`` (and the modeling agent
``BESSER_AGENT_ALLOW_CUSTOM_BASE_URL=true``) to accept a custom endpoint.

You may optionally pin a specific model; leaving it blank uses the backend's
default for that provider.

What is stored, and where
-------------------------

.. important::
   Your API key is kept **only in this browser tab's** ``sessionStorage``. It is
   closed out when the tab closes. It is never written to ``localStorage``,
   never put into the Redux store, never logged, and never persisted on a BESSER
   server.

The browser never calls the model provider directly. The key travels:

* to the **modeling agent**, as a session value on the assistant's WebSocket
  connection (re-sent automatically if the socket reconnects);
* to the **BESSER backend**, in the body of the Spec-Driven generation request.

Alongside the key, these session-scoped values are stored in the same tab:

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Value
     - Notes
   * - Provider and optional model override
     - Applies to both features.
   * - Base URL
     - Only for the *Local* and *PIA* providers.
   * - Free-tier opt-in and free-model choice
     - Kept separate from the key, so the free tier can never leave a
       placeholder key that would break the assistant.
   * - Run budget (max USD, max minutes)
     - Not secret, but kept next to the key it applies to.

Run budgets
-----------

The key dialog has a collapsible **Spec-Driven Agent settings** section with two
limits for a single generation run:

* **Max spend / run** in USD
* **Max time / run** in minutes

The defaults and the maximum values are read from the backend at page load, and
the backend enforces its own ceilings regardless of what the dialog accepts. If
a run hits either limit it stops with a ``COST_CAP`` or ``TIMEOUT`` notice and
keeps whatever it produced.

Removing your key
-----------------

The dialog's remove action clears the key from the tab immediately. Closing the
tab does the same thing. If a provider rejects the key mid-run
(``INVALID_KEY``), the editor clears it for you so the next run asks again.
