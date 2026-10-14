Troubleshooting
===============

Start with the part of the workflow that failed.

My project disappeared
----------------------

Projects are stored in the browser you used to create them. Check that you
are on the same editor URL and browser profile. Private browsing, clearing
site data, and switching hosts can make that storage unavailable. Import your
exported project JSON to recover a saved copy; see :doc:`projects`.

The Generate menu fails
-----------------------

Run **Quality Check** and fix its model errors first. Confirm that the
generator accepts the active diagram type. A full web application requires
a class diagram and a linked GUI model. For a local editor, check that the
Python backend is running and ``BACKEND_URL`` points to it.

The assistant cannot connect
----------------------------

Reload once and check that the editor and modeling-agent services are reachable.
On a local setup, verify ``UML_BOT_WS_URL`` and that the agent has completed
startup; it can take several minutes before its WebSocket opens. See
:doc:`../reference/environment`.

A run is incomplete or could not be verified
--------------------------------------------

Read the run card's reason and findings. **Incomplete** can mean missing
implementation, a budget limit, or an interruption. **Could not be verified**
means a required check did not run or could not establish the result. You can
download the available files, inspect the report, and request a continuation.
See :doc:`spec-driven-agent` for run controls and retention.

My API key is no longer set
---------------------------

Provider keys are stored in the tab's ``sessionStorage`` and disappear when
that tab closes. Re-enter the key through the assistant's key dialog. A rejected
key can also be cleared so you can replace it. See :doc:`ai-keys`.

Report a problem
----------------

Use **Community > Report a Problem** or the
`issue tracker <https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor/issues>`_.
Include the steps you took, what you expected, and the error message. For a
generation run include its run id and downloaded findings when available.
For a diagram problem include a small exported project that reproduces it.
Remove API keys and private data before attaching files.
