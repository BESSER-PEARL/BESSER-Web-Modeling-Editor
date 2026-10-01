"""Sphinx configuration for BESSER WME Standalone documentation."""
from __future__ import annotations

import os
import sys
from datetime import datetime

# -- Path setup --------------------------------------------------------------

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

sys.path.insert(0, REPO_ROOT)

# -- Project information -----------------------------------------------------

project = "BESSER Web Modeling Editor"
copyright = f"{datetime.now():%Y}, BESSER"
author = "BESSER"

# The editor ships with the coordinated BESSER v8 release.
release = "8.0.1"
version = "8.0"
html_title = "BESSER Web Modeling Editor"

# -- General configuration ---------------------------------------------------

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.intersphinx",
    "sphinx.ext.todo",
    "sphinx.ext.viewcode",
]

intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
}

# Templates path
templates_path = ["_templates"]

# List of patterns to ignore when looking for source files.
exclude_patterns = [
    "_build",
    "Thumbs.db",
    ".DS_Store",
    "user-guide/diagram types/*",
    "user-guide/diagram_types.rst",
    "user-guide/project.rst",
    "user-guide/interface.rst",
]

# -- Options for HTML output -------------------------------------------------

html_theme = "sphinx_immaterial"
extensions.append("sphinx_immaterial")
html_logo = "_static/besser_logo_dark.png"
html_static_path = ["_static"]
html_css_files = ["docs.css"]
html_theme_options = {
    "font": False,
    "features": ["navigation.sections", "navigation.top", "search.highlight"],
    "palette": [
        {
            "media": "(prefers-color-scheme: light)",
            "scheme": "default",
            "primary": "cyan",
            "accent": "cyan",
            "toggle": {"icon": "material/weather-night", "name": "Switch to dark mode"},
        },
        {
            "media": "(prefers-color-scheme: dark)",
            "scheme": "slate",
            "primary": "cyan",
            "accent": "cyan",
            "toggle": {"icon": "material/weather-sunny", "name": "Switch to light mode"},
        },
    ],
    "repo_url": "https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor",
    "repo_name": "Source",
    "globaltoc_collapse": True,
    "toc_title": "On this page",
}
html_show_sourcelink = False

# Optional: favicon placed in _static directory
html_favicon = "_static/besser_ico.ico"

# If true, `todo` and `todoList` produce output, else they produce nothing.
todo_include_todos = False

# -- Options for Napoleon ----------------------------------------------------

napoleon_google_docstring = True
napoleon_numpy_docstring = True

# -- Options for source files ------------------------------------------------

source_suffix = {
    ".rst": "restructuredtext",
}

master_doc = "index"

# -- Project-specific settings ----------------------------------------------

primary_domain = "js"

# Provide commonly used replacements
rst_epilog = "\n.. |project| replace:: BESSER Web Modeling Editor\n"
