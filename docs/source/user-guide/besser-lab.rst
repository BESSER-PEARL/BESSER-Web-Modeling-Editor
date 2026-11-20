BESSER Lab
==========

**BESSER Lab** is a private instance of the editor in which the BESSER team
develops BESSER itself: the B-UML metamodel, the generators, the editor's
backend, this web editor and the modeling agent. You describe a change, or
start from a GitHub issue; the *lab agent* plans it, you correct the plan, the
agent builds it on ``lab/`` branches and runs the repositories' own checks,
you try the change live, and you open draft pull requests. The lab then shows
the pull requests' CI and review comments in the change's chat until they are
merged.

.. note::
   The lab is a separate build of the editor (``LAB_BUILD=true``, see
   :doc:`../reference/environment`) served by a lab instance of the BESSER
   backend. The public editor has none of these screens. How a lab is set up
   and how it works on the server is in BESSER's documentation ("BESSER Lab"
   and "BESSER Lab in local mode", under the Spec-Driven Agent).

Signing in
----------

The lab's first screen asks you to **Sign in with GitHub**. Only the GitHub
logins on the lab's list can use it: the lab checks your login when you sign
in and on every request. If your login is not on the list, the screen *This
lab is for the BESSER team* names it; ask a lab administrator to add you, or
choose **Sign in with another account** (GitHub then shows its account picker;
sign in to the other account on github.com first). **Open the public editor**
takes you to the public editor.

Nothing the lab does is merged without a person: changes are made on lab
branches and opened as draft pull requests.

The header
----------

The header is the same on every screen:

- **BESSER Lab** and the breadcrumb (**Changes**, then the open change);
- one chip per repository, naming the base branch changes start from and when
  it was last fetched; a **fork** chip when the lab is pointed at a fork
  instead of BESSER-PEARL;
- the month's meter: what your lab runs cost this month, out of your monthly
  budget;
- your account menu: **Settings and usage**, the theme, the language and
  **Sign out**.

The home
--------

The home asks *What do you want to change in BESSER?*

1. Describe the change in the composer, for example "add a Note element to
   class diagrams, with a text body and a link to any class".
2. To start from a GitHub issue, choose **Start from a GitHub issue**, pick
   the repository and type the issue number (**No issue** removes it). The lab
   agent reads the issue, with its comments, before it plans; issue numbers
   written in the message, such as ``#212``, are read too.
3. Choose **Start change** (or press :kbd:`Ctrl+Enter`). The change opens with
   your message sent.

Below the composer:

- **Open changes**: every change in progress, with its phase (*Draft*, *Plan
  ready*, *Running*, *Built*, *Checks failing*, *Stopped early*, *In review*),
  who started it and who else worked on it, its pull requests, its cost so far,
  and a note when its base branch has moved since it started. **Mine** and
  **Everyone** filter the list.
- **Recently merged**: the last closed changes, merged or closed without
  merging.

When the lab cannot start a run now, the home says why before you type: the
lab's runs at once are all in progress (it names them), or your monthly
budget, or the lab's, is spent (it names the date runs start again).

A change
--------

A change is one unit of work: one branch per repository it touches, its
working copy on the server, and one conversation. Every allowed member of the
team can open any change and continue it; the change keeps who started it (its
owner).

The change screen has the **Conversation** on the left and three tabs on the
right: **Model**, **Changes** and **Try it**. Below 1024 px a switch at the
top shows **Chat** or one of the tabs. The header holds the change's title and
phase, who started it, its branch (with a button that copies the branch name),
**Open pull request** (or **Push to the pull requests** once they exist),
**Stop** while a run is in progress, and **More actions**: **Try this change**,
**Update <repository> from <branch>** and, for the owner or an administrator,
**Drop change...**. **New change** starts another one.

When a repository's base branch has moved since the change started, a notice
says by how many commits, with **Update from <branch>**.

The chat and the plan
^^^^^^^^^^^^^^^^^^^^^

Your first message makes the lab agent **plan** the change. It reads the code
the change touches and answers with a plan card (*Plan ready*): the kind of
change, a summary, the steps, the repositories it touches and any **Open
questions**. Each revision is numbered (*Plan v2*, ...). Then either:

- reply with what to change: the lab agent revises the plan; or
- choose **Build this plan**: the lab agent builds it.

When the agent needs an answer before it can plan, the card is *The lab agent
has a question*; reply to answer it. When nothing needs to change, the card
says *No change needed* and no branch is created.

A **build** changes the files in the change's working copy, runs the
repositories' checks for the areas it touched and fixes what fails, for a few
rounds. Its card (*Change built*, or *Change built, checks failing*) shows the
changed files per repository, the checks, the checklist of the change's kind
(each item *Done*, *Missing* or *Could not be judged from the files*), the
agent's own account (*In the lab agent's words*, with any **Departures from
the plan** and what is **Not done**), and what the change has cost so far.
From the card: **View changes**, **Try it** and **Open pull request**.

A run can take many minutes. **Stop** ends it: a check that is running is
interrupted, and a stopped build still reports what it did and the checks that
ran. Only the person who started the run, the change's owner or an
administrator can stop it.

The conversation is kept on the server: a reload, another browser or a
teammate who opens the change sees the same messages and cards, and a run in
progress is followed live. Two people cannot run the same change at once: the
second is told who is running it.

A build may also propose **team notes** (see `Settings and team notes`_): the
card lists them under *Team notes the lab agent proposes*; **Keep as a team
note** (you may edit the title and text first) or **Dismiss** each.

The Model tab
^^^^^^^^^^^^^

A change that extends the metamodel or adds a diagram type comes with a class
diagram of the extension, which the Model tab opens as *Proposed model*. Edit
anything that is off, then **Keep** it or **Discard** it. The next plan
revision and the build start from the diagram as you left it. When the agent
revises its proposal while you are editing, the tab offers **Use the
revision** or **Keep mine**.

The Changes tab
^^^^^^^^^^^^^^^

The Changes tab shows the change's **Pull requests** (once opened) and its
**Last build**: the files, checks and checklist. **View changes** opens the
diff of the working copy against the base branches, file by file:

- click a line number to comment on that line, :kbd:`Shift`-click another to
  select a range, or **Comment on the file**;
- the comments you write are listed under *Comments to send*;
- **Send to the lab agent** sends them all as one message, and the lab agent
  builds what they ask for.

Values that look like secrets are replaced before the diff leaves the server.
A very large file shows without its diff until you open it on its own.

Try it
^^^^^^

**Try this change** runs the change live: its backend, its editor and its
modeling agent, in a preview slot of the lab. The first start of a change
prepares its environments and can take minutes; the tab names the step it is
on. Then the change's editor shows in the tab. Each service's state
(*starting*, *running*, *failed*, *stopped*) is listed with **Restart**,
**Show log** and **Restart all**, and **Open in a new tab** opens the preview
on its own. After each build, the slot shows the new version.

- The lab has few slots (two on a team host). When every slot shows another
  change that someone used in the last 10 minutes, the tab says which change
  and who; try again later.
- In the preview you cannot sign in to GitHub, and it is not the lab: it is the
  change's own editor, to try what the change does.
- The preview's assistant works only once the modeling agent reads its
  settings from the environment; until then the tab says the assistant is not
  available in the preview.
- On a lab running on your own machine (local mode, ``http://``), the editor
  can frame only ``https:`` pages, so the tab opens the preview in a new tab.

Opening pull requests
---------------------

**Open pull request** (in the header or on the run card) opens a dialog:

- **Title**: the pull requests' title, ``feat: <title>`` (``fix:`` for a bug
  fix) by default.
- **Issues**: the issues the change started from. Tick **Closes <repository>
  #<number>** for each issue the change resolves; the others are listed as
  related. GitHub closes an issue when the change reaches the release branch
  (``master``/``main``), not when it merges into ``development``.
- **Open draft pull requests**: the lab commits the work as you, pushes the
  branches with your GitHub sign-in and opens one draft pull request per
  repository the change touched, the editor's first. When several are opened,
  each lists the others in merge order.

The lab refuses, before pushing, a change to ``.github/workflows/`` (your
sign-in cannot push those) or a ``.env`` file holding a credential. When
GitHub no longer accepts your sign-in, the dialog offers **Sign in again**.
Later builds reach GitHub with **Push to the pull requests**. Each pull
request's description carries a section the lab rewrites at every push: the
agent's report, the plan, the checks run in the lab, the issues and who asked
for the change; what reviewers write outside it is kept. The lab runs only the
checks of the areas a change touched, never the repositories' full suites; the
pull request's CI runs those.

The review card
---------------

Once a change has pull requests, what is new on them (CI results, reviews,
comments, merge state) appears in its chat as a review card, one section per
pull request:

- **Checks**, each *Passed*, *Failed*, *Running*, *Skipped* or *Neutral*, with
  **Details** and, for a failed GitHub Actions job, the **End of the log**;
- **Reviews** and **Comments**. Comments of members and collaborators of the
  repository go to the lab agent; a comment marked *Outside contributor* goes
  only if you tick it;
- whether the pull request conflicts with, or is behind, its base branch.

Its actions send the lab agent a build with the task: **Fix CI**, **Address
comments** (with the number of comments it will act on) and **Resolve
conflicts**. **Update from base** brings the branch up to its base branch: on
GitHub when the pull request is open, otherwise in the lab's working copy;
conflicts are left for **Resolve conflicts**. **View changes** opens the diff.

When every pull request is merged and nothing is left unpushed, the lab closes
the change by itself and says so in the chat: the working copy and branches
are removed, the conversation stays, and the change moves to *Recently merged*.
A change whose pull requests were closed without merging is closed with
**Close the change**.

**Drop change...** deletes a change, its working copy and its conversation,
whatever its state; pull requests already opened stay on GitHub. Only its
owner or an administrator can drop it.

Settings and team notes
-----------------------

**Settings and usage** (the account menu) shows:

- **Repositories**: where changes start from, for each repository its
  upstream, base branch, base commit and when it was fetched, with **Refresh
  now**. Open changes keep the base they started from.
- **Limits** (set on the server): per run, per person a month, the lab a
  month, runs at once, preview slots, how often the bases are refreshed, and
  the administrators.
- **Usage**: what you and the lab spent this month, and what each person
  spent.
- **Activity**: what happened in the lab in a month (changes created, opened,
  closed and dropped, runs and their result and cost, pull requests, base
  updates, preview slots), with **Older** and **Newer**.
- **Team notes**: what the lab agent remembers.

Team notes are short notes the lab agent reads when they apply to a change: a
decision the team made, a mistake the agent made and was corrected on, or a
convention that belongs in a repository's docs. Each note shows who approved
it, which repositories and kinds of change it applies to, and how often it was
read; one not read for a long time is marked. **New note**, **Edit** and
**Delete** manage them. For a note that names the file it belongs in, **Move
to docs** starts a change that writes it there, after which the note can be
deleted. When the lab cannot keep notes, the panel says why.
