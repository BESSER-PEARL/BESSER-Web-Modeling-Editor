# Editor screenshot handoff

Updated 2026-09-30. The reusable script is
[`tools/capture_editor_screenshots.py`](tools/capture_editor_screenshots.py).
It uses Playwright against the real editor, in a fresh browser context.

## Run from the WME repository root

Use a Python environment with Playwright and its Chromium browser:

```console
python -m pip install playwright
python -m playwright install chromium
python docs/tools/capture_editor_screenshots.py --output docs/build/screenshots
```

The default target is `https://experimental.besser-pearl.org/`. To capture a
local release checkout, start it first and pass
`--editor-url http://127.0.0.1:5173/`. Check the actual branch and deployed
version before documenting it. The script records the URL, UTC capture date,
viewport and exported version metadata in `capture-manifest.json`.

The default command captures six images and performs deterministic validation,
Python generation and JSON backup. It sends no assistant prompt. To also
refresh the assistant result screenshot:

```console
python docs/tools/capture_editor_screenshots.py --output docs/build/screenshots --assistant
```

That option sends one real request through the editor's default hosted
modeling assistant: add `publication_year: int` to Book while keeping Author
and the association unchanged. It waits for the applied attribute and the
Review the model action, then validates the updated model. No existing browser
profile, personal API key or GitHub session is used. If a hosted service is
unavailable, the script fails and captures `capture-error.png`; do not invent a
successful response. Assistant wording can vary.

## What is captured

| File | State | Documentation use |
| --- | --- | --- |
| `interface-choice.png` | Model it / Describe it welcome dialog | First project; project management |
| `new-project.png` | My Library, Low-code, Data Modeler | First project; project management |
| `book-properties.png` | Book with title and pages | First project |
| `book-author-association.png` | written_by with Book `*`, Author `1`, both navigable | First project |
| `generate-python.png` | Generate > OOP > Python Classes | First project; generate-code guide |
| `export-project.png` | Project JSON backup versus current diagram assets | First project; project management |
| `assistant-result.png` | Actual reply and Review the model action | AI assistant guide |

`library-classes.py` and `library-project.json` are verification artifacts, not
images. The script checks their content and Python syntax. Model Quality Check
is not verification that a generated application behaves correctly.

## Review and install the images

The capture uses an English 1440 × 1000 light-mode viewport. It opens dialogs
through ordinary UI actions and captures the actual dialog/card elements.
Association and generator captures focus on their relevant controls to avoid
large empty canvas areas. Coordinates for palette drag/drop and screenshot
regions assume this viewport and interface layout. If the UI changes, adjust
those interactions against the real page; do not force a failing locator or
replace the page with a mock.

Inspect every image before copying only the selected PNGs into
`docs/source/images/wme/v8/` (or a new release folder). Keep the JSON manifest
and downloaded verification files in the build/review folder. Existing PNG
filenames may be reused for a reviewed refresh of the same release.

BESSER's `docs/source/images/editor/` contains copies of the first three images.
Refresh those copies together when applicable. Do not delete historical images
still used by reference pages.

Use `.. figure::` with descriptive alt text and a short task-oriented caption
in `.rst` pages. Prefer widths of 520–700px for dialogs and `100%` for diagrams.
Serve built HTML over HTTP, verify actual image loading and inspect the guide
at 390px phone width as well as desktop. Run `python docs/check_docs.py` and
`git diff --check` before handing over.

The cross-project handoff is in the BESSER repository at
`docs/DOCUMENTATION_HANDOFF.md`. The published contribution guide also explains
the documentation build and maintenance conventions.
