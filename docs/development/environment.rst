Environment setup
=================

Follow these steps to prepare a development environment.

Prerequisites
-------------

* Node.js 22.10+
* npm 10+
* Git
* Optional: Redis with RedisJSON for backend development
* Optional: Docker for container testing

Initial setup
-------------

::

  git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR.git
  cd BESSER-WEB-MODELING-EDITOR
  npm install

Running services
----------------

Start both the webapp and server::

  npm run dev

This command runs ``npm run start:webapp`` (webpack dev server on port 8888) and
``npm run start:server`` (Express server on port 8080).

Alternative scripts
-------------------

* ``npm run start:webapp`` – launch only the webapp for UI development.
* ``npm run start:server`` – run the server independently.
* ``npm run build:local`` – produce local builds of webapp and server for manual
  testing.

Environment variables
---------------------

Set the following variables in your shell or ``.env`` file:

* ``APPLICATION_SERVER_VERSION`` – ``0`` for webapp-only development, ``1`` when
  testing collaboration flows.
* ``DEPLOYMENT_URL`` – base URL used by the webapp (``http://localhost:8080`` by
  default).
* ``APOLLON_REDIS_URL`` – optional Redis connection string.

Redis in development
--------------------

Run Redis with RedisJSON locally::

  docker run -p 6379:6379 -it redis/redis-stack-server:latest

Then start the server with Redis persistence::

  APOLLON_REDIS_URL="" npm run start:server

Next steps
----------

Proceed to :doc:`workflows` for day-to-day development practices.
