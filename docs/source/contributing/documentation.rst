Maintain the documentation
==========================

Build and preview
-----------------

Use Python 3.12. From the repository root:

.. code-block:: console

   python -m pip install -r docs/requirements.txt
   python docs/check_docs.py
   python -m http.server 8001 --directory docs/build/html

Open ``http://localhost:8001``. Add ``--offline`` when external Python and
Sphinx inventories are unavailable. Build errors and warnings fail the check.
The documentation workflow runs the same check for pull requests.

Write for the reader's task
---------------------------

Start guides should complete one small task. Put prerequisites first,
use numbered steps and exact interface labels, and show the expected result.
Keep complete options in reference pages and deployment details in operations
guides. Link to shared BESSER explanations instead of copying them.

Run new commands and examples. Add pages to a toctree, link within this site
with ``:doc:``, and give screenshots useful alt text. Preview desktop and
phone widths, in light and dark mode. Keep paragraphs short.

Use the BESSER editor brand colours in all three documentation sites:
``hsl(193, 45%, 40%)`` in light mode and ``hsl(195, 52%, 64%)`` in dark mode.
Check the shared stylesheet in the other projects when changing its rules.

Refresh editor screenshots
--------------------------

The repository includes a capture tool that exercises the real editor UI.
Install Playwright and its Chromium browser, then run from the repository root:

.. code-block:: console

   python -m pip install playwright
   python -m playwright install chromium
   python docs/tools/capture_editor_screenshots.py --output docs/build/screenshots

Add ``--assistant`` to send one real modeling request and refresh the assistant
response image. The tool uses a fresh browser profile and records the URL,
capture date, export versions, model validation, and downloads in a manifest.
It waits for UI transitions before capturing dialogs, menus, and replies.

Review the PNGs before copying selected files into ``docs/source/images/wme/``.
Use ``.. figure::`` with alt text and a short caption beside the relevant step.
Keep historical images that existing pages still use. The detailed workflow
and screenshot inventory are in ``docs/SCREENSHOT_HANDOFF.md`` in the repository.

Release checklist
-----------------

Keep release highlights short and describe changes users can observe. Link
to migration steps for breaking changes. Match the documented version to
the coordinated platform release. After merging, verify the Read the Docs
build and hosted tutorial, search, navigation, assets, and cross-project links.
A local build does not publish the site.
