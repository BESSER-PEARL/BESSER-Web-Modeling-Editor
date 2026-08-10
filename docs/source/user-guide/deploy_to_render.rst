Deploying to Render
===================

Beyond running the editor locally, you can publish a project you built in the
Web Modeling Editor straight to the cloud with **one click**, using
`Render <https://render.com>`_ as the host and GitHub as the source of truth.
The editor packages your generated application, pushes it to a GitHub
repository together with a ready-to-use ``render.yaml`` blueprint, and hands you
a Render deploy link -- no manual infrastructure setup required.

Two kinds of project can be deployed this way:

* **Web app** -- a full application generated from a Class diagram + GUI diagram
  (React frontend + FastAPI backend + database).
* **Standalone agent** -- a conversational chatbot generated from an Agent
  diagram (Streamlit frontend + Python backend, single-service blueprint).

Prerequisites
-------------

* A **GitHub account** -- the editor creates the repository in your account, so
  you sign in with GitHub (OAuth) the first time you deploy.
* A **Render account** -- free to create at `render.com <https://render.com>`_.

How it works
------------

The *Deploy* action runs a GitHub-backed pipeline:

1. The active project is generated into deployable code.
2. A GitHub repository is created (or an existing linked one is updated) and the
   generated files -- including a ``render.yaml`` blueprint that declares the
   service(s) -- are pushed to it.
3. Render reads the blueprint and provisions the services.

Because the source lives in your GitHub repo, every redeploy is just another
push, and Render rebuilds automatically.

Deploying step by step
---------------------

1. Build your project in the editor. For a web app you need a **Class diagram**
   and a **GUI diagram**; for a chatbot you need an **Agent diagram**.
2. Open the **Deploy** dialog from the application bar and sign in with GitHub if
   prompted.
3. Choose what to publish:

   * **New repository** -- give it a name and (optionally) a description, and
     pick whether it is public or private.
   * **Existing repository** -- redeploy to a repo you have already linked,
     updating it with your latest changes.

4. Select the **deployment target** (*web app* or *agent*) if both are available
   in your project, then click **Publish to Render**.
5. When the push completes, the result dialog gives you:

   * On the **first deploy** -- a Render **Blueprint** link
     (``render.com/deploy?repo=…``). Click it, connect your Render account, and
     Render provisions the services from ``render.yaml``.
   * On **redeploys** -- the live ``*.onrender.com`` URL(s) of your running
     services.

Environment variables and secrets
--------------------------------

Some services need configuration you should not commit to GitHub. The generated
``render.yaml`` declares these as secrets you fill in on Render's side rather
than hard-coding them. For example, a deployed agent that calls an LLM declares
``OPENAI_API_KEY`` as a secret env var you set in the Render dashboard before the
service can start.

.. seealso::

   :doc:`deploy_locally`
      Run the same project locally with Docker Compose instead of deploying to
      the cloud.
