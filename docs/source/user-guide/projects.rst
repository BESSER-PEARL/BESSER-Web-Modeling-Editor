Project Management
==================

The Web Modeling Editor organizes your work into **Projects**. A project acts as a container for all your related diagrams, allowing you to manage complex systems effectively.

Projects live **in your browser** (``localStorage``, under keys prefixed
``besser_``). Nothing is stored on a BESSER server, so clearing site data
removes your projects — export or push to GitHub anything you want to keep.

The first thing you see
-----------------------

On a first visit the editor asks how you want to work:

.. figure:: ../images/wme/v8/interface-choice.png
   :width: 640
   :alt: Editor welcome screen with visual modeling and natural language choices

   Choose the visual canvas or the assistant when starting a project.

* **Model it** — the low-code canvas: drag elements from the palette and edit
  them by hand.
* **Describe it** — the agentic workspace: the :doc:`AI assistant
  <ai-assistant>` opens next to the canvas and builds the model from your
  plain-language description.

Tick *Remember my choice* to skip the question next time (stored as
``besser_preferred_interface``). You can also force a mode with a URL
parameter: ``?agentic`` or ``?mode=agent`` opens the assistant workspace,
``?mode=model`` opens the low-code canvas. Either way the model is the same —
the choice only decides which surface opens first, and you can switch at any
time.

Choosing **More options** opens the project hub, which offers four ways to
start:

* **Create Blank** — an empty project with all editors available.
* **From Data** — build a class diagram from data, from one of two sources:

  * *Files (CSV, XLSX)*: upload one or more ``.csv``, ``.xlsx`` or ``.xls``
    files and the backend derives a class diagram from them.
  * *Statistics API (SDMX)*: pick a provider (Eurostat, the ECB, the OECD, the
    IMF, national statistics offices...) or enter the https URL of any SDMX 2.1
    API, then a dataflow id (``une_rt_m``, or ``AGENCY,ID,VERSION`` such as
    ``ECB,EXR,1.0``). The backend reads the dataflow's structure, its dimensions
    and codelists, and turns it into a class diagram: an ``Observation`` class,
    an enumeration per small codelist and a class per large or hierarchical one.
* **Import Project** — load an exported ``.json`` or a B-UML ``.py`` file.
* **Continue from GitHub** — reopen a GitHub repository, BESSER-made or not, and
  keep building on it (see `Continuing from a GitHub repository`_).

Recently opened projects are listed underneath.

Creating a New Project
----------------------

.. image:: ../images/wme/v8/new-project.png
  :width: 600
  :alt: New Project Dialog
  :align: center

1.  Click the **Home** icon 🏠 or select **File > New Project**.
2.  Choose **Low-code** for the visual canvas or **Agentic** for the assistant.
3.  Enter the project details:

    *   **Name**: A descriptive name for your project.
    *   **Description**: (Optional) A brief summary of the project's purpose.
    *   **Owner**: The name of the project owner.
    *   **Modeling Perspective**: Choose Data Modeler, Agent Developer,
        Multi-Agent, Full Web Application, Quantum, or Show All to select the
        diagrams visible in the sidebar. Multi-Agent shows the BPMN, Agent,
        Component, and Deployment diagrams and enables
        :ref:`agentic BPMN <agentic-bpmn>`. You can change this later in
        Settings.

4.  Click **Create Project**.

**Save it on GitHub**, under the project details, is ticked by default once
GitHub is connected (the first-run screen and this form both offer **Connect
GitHub**; you come back to where you were after signing in). The project is
created first, then a **private** repository named after it (``Shop`` becomes
``shop``, or ``shop-2`` when that name is taken) receives its model, and the
project is linked to it and shown as in sync. If the repository cannot be
created, the project is kept and stays unlinked; you can link or create a
repository later from the GitHub menu in the top bar.

Importing Projects
------------------

You can import existing projects to continue your work or use templates.

.. image:: ../images/wme/project/import_project.png
  :width: 600
  :alt: Import Project Dialog
  :align: center

1.  Click **File > Import Project**.
2.  Select the file to import. Supported formats are:
    *   **B-UML (.py)**: The standard Python-based format for BESSER models.
    *   **JSON (.json)**: The internal format used by the web editor.

Importing always creates a **new** project — it never overwrites the one you
have open.

Individual diagrams can also be imported into the current project from the
**File** menu; those accept ``.json``, ``.py``, ``.bpmn`` and ``.xml``, and are
added as a new tab rather than replacing an existing diagram. Two AI-assisted
importers convert external material into a class diagram:

*   **Import Class Diagram from Image** (``.png``, ``.jpg``) — reads a picture
    of a class diagram.
*   **Import Class Diagram from KG** (``.json``, ``.ttl``, ``.rdf``) — reads a
    knowledge graph.

Both of these write into the **active** class diagram.

Diagram tabs
------------

Each diagram type has its own tab strip above the canvas, showing only the
diagrams of the type currently selected in the left sidebar.

*   **Add**: the ``+`` button creates another diagram of the active type. A
    project holds at most **five diagrams per type**; the button disappears at
    the cap.
*   **Rename**: double-click a tab, type, then Enter (Escape cancels).
*   **Delete**: the ``×`` on the tab. The last remaining diagram of a type
    cannot be closed.

Object and GUI No-Code diagrams additionally show a **Linked Diagrams** row
where you pick the class diagram they draw their types from; object diagrams get
a wand button that scaffolds objects from that class diagram. User diagrams show
a validation dot and an **Edit as Form** toggle that swaps the canvas for a
guided form.

Exporting Projects
------------------

To save your work or use it with other BESSER tools:

.. figure:: ../images/wme/v8/export-project.png
   :width: 700
   :alt: Current Export Project dialog with project backup options on the left and diagram assets on the right

   Use **Export as JSON** on the left for a project backup; image exports
   on the right save only the current diagram.

1.  Click **File > Export Project**.
2.  The dialog has two halves.

**Multiple diagrams** — tick the diagram types to include, then:

*   **Export as JSON**: the whole project as ``<Project_Name>.json``. This is
    the file the import flow reads back.
*   **Export as B-UML**: the whole project as a single ``<project>_besser.py``.

**Current diagram** — requires a UML diagram to be open:

*   **Export as SVG**
*   **Export PNG (White)** / **Export PNG (Transparent)**
*   **Export Diagram as JSON**
*   **Export Diagram as B-UML** (the model is validated first)

Project Settings
----------------

You can modify project metadata at any time.

.. image:: ../images/wme/project/project_settings.png
  :width: 600
  :alt: Project Settings
  :align: center

1.  Click the **Settings** icon ⚙️ in the sidebar.
2.  Update the Name, Description, or Owner.
3.  View the unique **Project ID**.

The settings page also holds:

*   **Display** — show instanced objects, show association names, properties
    panel, and the class-diagram notation switch (**UML** or **ER**; this
    changes rendering only, not the model).
*   **AI / LLM API Key** — see :doc:`ai-keys`.
*   **Diagrams** — which diagrams currently hold content, and when each changed.
*   **Modeling Perspectives** — which diagram types appear in the sidebar (see
    :doc:`diagrams/index`).

Language and theme are not here: the language selector and the light/dark toggle
live in the top bar.

GitHub Integration
------------------

The editor supports syncing projects with GitHub repositories, allowing version control
and collaboration on your models.

Connecting to GitHub
~~~~~~~~~~~~~~~~~~~~

1. Click **Connect GitHub** in the top bar.
2. You are redirected to GitHub to authorise the BESSER OAuth app, and sent back
   to the editor signed in. A toast confirms *Signed in as …*.

The editor never sees your GitHub access token: the BESSER backend performs the
OAuth exchange, keeps the token server-side, and hands the browser only an
opaque session id. That session id is held in this browser tab
(``sessionStorage``) and expires after **24 hours**; your username is kept in
``localStorage`` for convenience.

The whole editor shares one sign-in: signing out in the GitHub menu signs out
the chat, the push dialog and the repository browser at once. When you reload,
the editor checks the stored session with the backend before offering
**Connect GitHub** again, so a GitHub action clicked during that check waits for
it instead of sending you to GitHub. If the backend no longer accepts the
session (it expired, or you signed out in another tab), every GitHub control
switches to **Reconnect GitHub**, and a linked project keeps its repository and
your unsaved changes.

The GitHub menu
~~~~~~~~~~~~~~~

Once you are signed in, the same top-bar control is your project's GitHub menu.
It reads **Link to GitHub** while the project has no repository; once linked it
shows the repository's name and a dot for its state (green when in sync, amber
when there are unsaved model changes or new commits on GitHub). Hover it to read
the state in words, and click it for everything you do with the repository:

- **Save to GitHub…**: commit the model, with an optional message.
- **Get latest**: appears when GitHub has commits you do not have.
- **Open a pull request to merge it** / **View the pull request**: appear while
  a save or push waits on its own branch (see `Changes waiting for a pull
  request`_).
- **History…**: the model's earlier versions, with a restore for each.
- **Open on GitHub**: the repository's branch in a new tab.
- **Change repository…** and **Unlink**.
- **How GitHub works in BESSER**: opens the Help guide at its GitHub section,
  which explains linking, what a save writes to the repository, merging, pull
  requests, history and starting from any repository.
- **Sign Out**, under *Signed in as …* at the bottom of the menu.

The chat's *Working on …* line above the conversation opens the same menu.

One repository per project
~~~~~~~~~~~~~~~~~~~~~~~~~~

A project is linked to **one** repository. The GitHub menu, the Spec-Driven
Agent's *Save to GitHub* and *Continue from GitHub* all use that same link, and
the link is also written into the repository, so any browser that opens the repo
finds its project again. Every repository BESSER writes has the same layout:

- ``buml/diagrams.json``: the model, the only file the editor reads back.
- ``buml/*.py``: the same model as B-UML Python source, for reading without the
  editor.
- ``.besser/project.json``: which BESSER project the repository belongs to.
- the app code, when the Spec-Driven Agent built one.

BESSER also tags the repository with the ``besser`` topic, which is how the
repository browser lists your BESSER projects first. Older repositories that
hold a ``besser-project.json`` still open; the first save moves the model to
``buml/diagrams.json`` and removes the old file in the same commit.

Linking a repository
~~~~~~~~~~~~~~~~~~~~

Click **Link to GitHub** in the top bar. For a project without a repository you
can:

- **Create a repository for this project**: name it and choose private or
  public. The first commit holds the model and a README.
- **Link an existing repository…**: the browser lists your BESSER projects first
  (search reaches every repository). It holds every repository you can open:
  your own, those you collaborate on and your organizations'. A repository you
  can only read is marked **Read only** and cannot be linked, since BESSER
  could not save to it. Selecting one shows its model, its diagrams and
  classes, and its last commit with who made it. If it already holds a model
  you choose between loading that model and keeping yours.

**Change repository…** in the menu of a linked project opens the same browser.

Staying in sync
~~~~~~~~~~~~~~~

The top bar shows the linked repository and a dot for its state: in sync,
model changes not saved yet, new commits on GitHub, or both. The editor checks
the repository when you open the menu, when you return to the tab and once a
minute.

- **Save to GitHub…** commits the model. The commit message is optional. If
  someone pushed since your last sync, BESSER merges their commits with yours
  instead of overwriting them, and the editor then shows the merged model. The
  model is merged element by element, not line by line: two people who each
  add a class, or change different classes, both keep their work. Only a value
  both of you changed differently (the same class renamed twice, a class one of
  you deleted and the other edited) is a conflict; moving the same box is not.
  On a conflict your save goes to a ``besser/sync-…`` branch and nothing is
  overwritten (see `Changes waiting for a pull request`_).
- **Get latest** loads the repository's model, and its code as the starting
  point of the next Spec-Driven Agent run. It asks first when you have unsaved
  model changes.

To bring the repository's app code in line with your model, ask the Spec-Driven
Agent in the chat; you review the run, then push it.

Changes waiting for a pull request
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

A save or push that did not land on the branch, because GitHub could not merge
it or because you chose to open a pull request, is remembered with the project,
also after you close the dialog or reload. The GitHub menu then shows it:

- before a pull request exists: **Open a pull request to merge it**. The pull
  request takes the message you saved with, and its description lists the
  model changes (``class Loan added``) and the files. GitHub shows any conflict
  to resolve before merging.
- once it is open: **View the pull request**.
- **Stop tracking it** forgets it here; the branch stays on GitHub.

When the pull request is merged or closed, or its branch deleted, the menu
drops it on its own; after a merge, **Get latest** brings the merged model in.

Going live
~~~~~~~~~~

For a project linked to a repository, **Deploy > Go live from GitHub** puts the
app that is in the repository online
on Render. What goes live is exactly the repository's code, so the app the
Spec-Driven Agent built, with every change it made, is the app people use.

1. BESSER adds Render's deploy file to the repository, written for the app's
   real folders, and commits nothing else.
2. You open Render, sign in with GitHub and click **Apply**, once. A private
   repository needs Render to be given access to it first.
3. From then on every code save to GitHub updates the live app, and saving only
   the model does not.

Go live supports apps with a FastAPI backend and an optional React (Vite)
frontend. For anything else it says why and offers the classic deploy, which
rebuilds the app from the diagrams into a separate repository. Render's free
plan puts an idle app to sleep, and its database resets on each redeploy.

Model history
~~~~~~~~~~~~~

**History…** in the GitHub menu lists recent commits that changed the model.
Each one says who made
it (the Spec-Driven Agent, the editor, or a person on GitHub), when, and what
it changed in the class diagram, for example ``class Loan added``. Restore any
earlier version into the editor; it then counts as an unsaved change.

Sharing as a gist
~~~~~~~~~~~~~~~~~

**File > Share as Secret Gist…** publishes the project JSON as a GitHub gist,
secret by default, and opens it in a new tab. It asks you to connect GitHub
first when you are signed out.

Continuing from a GitHub repository
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Any repository can be reopened from the project hub's **Continue from GitHub**
card, which uses the same repository browser. A repository BESSER generated
opens with its stored model; for any other, BESSER reads the model from its code
and proposes it on the canvas for you to accept (see
:doc:`spec-driven-agent`). Either way the repo is linked at the imported commit,
so the :doc:`Spec-Driven Agent <spec-driven-agent>` can keep editing that
application. If a project in this browser is already linked to
that repository, the hub pulls into that project instead of making a copy.
