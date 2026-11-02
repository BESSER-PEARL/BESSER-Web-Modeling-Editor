"""Write the BESSER backend's OpenAPI schema (FastAPI ``app.openapi()``) to a JSON file.

Usage: python scripts/export-openapi.py OUT.json

Imports BESSER from BESSER_ROOT, else from the BESSER checkout this repository
sits in as the ``besser/utilities/web_modeling_editor/frontend`` submodule.
"""
import json
import os
import sys

root = os.environ.get("BESSER_ROOT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5)
sys.path.insert(0, os.path.abspath(root))

from besser.utilities.web_modeling_editor.backend.backend import app  # noqa: E402

with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as out:
    json.dump(app.openapi(), out, indent=2, ensure_ascii=False)
    out.write("\n")
