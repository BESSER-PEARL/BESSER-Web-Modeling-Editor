"""Write the BESSER backend's OpenAPI schema (FastAPI ``app.openapi()``) to a JSON file.

Usage: python scripts/export-openapi.py OUT.json

Imports BESSER from BESSER_ROOT, else from the BESSER checkout this repository
sits in as the ``besser/utilities/web_modeling_editor/frontend`` submodule.
"""
import json
import os
import sys

root = os.path.abspath(
    os.environ.get("BESSER_ROOT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5)
)
# Without this check a standalone clone silently imports a pip-installed besser
# and writes that release's schema.
if not os.path.isdir(os.path.join(root, "besser")):
    sys.exit(f"export-openapi: no BESSER checkout at {root}; set BESSER_ROOT to one.")
sys.path.insert(0, root)

import besser  # noqa: E402
from besser.utilities.web_modeling_editor.backend.backend import app  # noqa: E402

print(f"export-openapi: using {besser.__file__}", file=sys.stderr)

with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as out:
    json.dump(app.openapi(), out, indent=2, ensure_ascii=False)
    out.write("\n")
