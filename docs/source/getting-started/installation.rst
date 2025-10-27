Installation
============

The repository is a npm workspace that bundles the standalone web application,
collaboration server, shared DTOs, and reusable editor assets. The workspace
requires a modern Node.js runtime and system libraries for building native
modules used by the server.

Prerequisites
-------------

* **Node.js 22.10 or newer** (see ``"engines"`` in :file:`package.json`).
* **npm 10+** (included with Node.js releases from the 22.x line).
* **Python 3 and build tools** such as ``make`` and a C/C++ compiler. These are
  required by transitive dependencies like ``node-canvas`` when the server build
  is enabled.
* **Redis 7 with the RedisJSON module** if you plan to back the server with a
  Redis store.
* **Git** for cloning the repository and managing updates.

On macOS you can install the toolchain via Homebrew::

  brew install node@22 git python3
  xcode-select --install  # command line developer tools

On Ubuntu/Debian systems::

  sudo apt update
  sudo apt install -y curl git build-essential python3
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs

Cloning the repository
----------------------

Clone the project together with its sub-packages::

  git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR.git
  cd BESSER-WEB-MODELING-EDITOR

Installing dependencies
-----------------------

Install workspace dependencies once inside the repository::

  npm install

The workspace pulls the following notable packages:

* ``@besser/wme`` – the modelling engine consumed by the webapp.
* ``@sentry/node`` – optional error telemetry for the server.
* ``concurrently`` – utility to orchestrate multiple npm scripts during
  development builds.
* ``webpack`` and ``ts-loader`` – bundlers for the TypeScript front-end and
  server.

Optional native dependencies
----------------------------

The server bundles conversion and canvas features that rely on ``node-canvas``.
Consult the `node-canvas installation guide <https://github.com/Automattic/node-canvas#compiling>`_
for OS-specific dependencies (``libcairo``, ``pango``, ``jpeg``, ``giflib``).
You only need these libraries when building or running ``npm run build:server``
or ``npm run start:server``.

Keeping the workspace up to date
--------------------------------

To fetch upstream changes::

  git pull origin main
  npm install

When dependencies change, the repository exposes ``npm run update`` to apply
`npm-check-updates <https://www.npmjs.com/package/npm-check-updates>`_ across all
packages and regenerate the lockfile.

Next steps
----------

Continue with :doc:`quickstart` to build and run the editor locally.
